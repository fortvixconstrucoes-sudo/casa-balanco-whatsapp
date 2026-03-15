const fetch = global.fetch || require("node-fetch");
const FormData = require("form-data");
const pdf = require("pdf-parse");

const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppText } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const {
  generateReply,
  nowISO,
  clampHistory,
  normalizeText,
  buildMissingDataMessage,
  mergeBuyerDataFromText,
  isAddressRequest
} = require("./_agent");

// =================================
// LINKS FIXOS
// =================================
const CASA_VIDEO_URL =
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4";

const CASA_BANNERS = [
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
  "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
];

const CASA_ADDRESS_TEXT = `📍 A Casa Balanço do Mar fica em:

Rua T17, Quadra 26, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000`;

const CASA_MAP_TEXT = `Localização no mapa:
https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318`;

const FECHAMENTO_INTRO = `Perfeito! Vamos finalizar sua fração 😊`;

// =================================
// DOWNLOAD DE ARQUIVO DO WHATSAPP
// =================================
async function downloadWhatsAppFile(fileId) {
  const meta = await fetch(`https://graph.facebook.com/v19.0/${fileId}`, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  const metaJson = await meta.json().catch(() => ({}));

  if (!meta.ok || !metaJson?.url) {
    throw new Error(`Falha ao obter metadados do arquivo WhatsApp: ${JSON.stringify(metaJson)}`);
  }

  const file = await fetch(metaJson.url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  if (!file.ok) {
    throw new Error("Falha ao baixar arquivo do WhatsApp");
  }

  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer);
}

// =================================
// LEITURA DE PDF
// =================================
async function readPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data?.text || "";
  } catch (err) {
    console.error("PDF READ ERROR:", err?.message || err);
    return "";
  }
}

// =================================
// TRANSCRIÇÃO DE ÁUDIO
// =================================
function guessAudioFilename(mimeType) {
  if (!mimeType) return "audio.ogg";
  if (mimeType.includes("mpeg")) return "audio.mp3";
  if (mimeType.includes("mp4")) return "audio.m4a";
  if (mimeType.includes("wav")) return "audio.wav";
  if (mimeType.includes("ogg")) return "audio.ogg";
  return "audio.ogg";
}

async function transcribeAudio(buffer, mimeType = "audio/ogg") {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY ausente para transcrição de áudio.");
      return "";
    }

    const form = new FormData();
    form.append("file", buffer, {
      filename: guessAudioFilename(mimeType),
      contentType: mimeType
    });
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("AUDIO TRANSCRIPTION ERROR:", json);
      return "";
    }

    return (json?.text || "").trim();
  } catch (err) {
    console.error("AUDIO TRANSCRIPTION EXCEPTION:", err?.message || err);
    return "";
  }
}

// =================================
// EXTRAIR MENSAGEM RECEBIDA
// =================================
function extractIncoming(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // ignora webhook de status
  if (!value?.messages?.length) return null;

  const msg = value.messages[0];
  const contact = value?.contacts?.[0];

  return {
    from: msg?.from,
    type: msg?.type,
    text:
      msg?.text?.body ||
      msg?.caption ||
      msg?.button?.text ||
      msg?.interactive?.button_reply?.title ||
      msg?.interactive?.list_reply?.title ||
      "",
    documentId: msg?.document?.id,
    imageId: msg?.image?.id,
    audioId: msg?.audio?.id,
    audioMimeType: msg?.audio?.mime_type || "audio/ogg",
    profileName: contact?.profile?.name || null
  };
}

// =================================
// EXTRAÇÃO MANUAL DE DADOS
// =================================
function applyManualFieldExtraction(lead, userText) {
  const txt = userText || "";
  const lower = normalizeText(txt);

  lead.buyer = lead.buyer || {};
  lead.spouse = lead.spouse || {};
  lead.purchase = lead.purchase || {};

  const email = txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) lead.buyer.email = email[0];

  const cpf = txt.match(/\b\d{3}\.?\d{3}\.?\d{3}\-?\d{2}\b/);
  if (cpf && !lead.buyer.cpf) lead.buyer.cpf = cpf[0];

  const cep = txt.match(/\b\d{5}\-?\d{3}\b/);
  if (cep && !lead.buyer.cep) lead.buyer.cep = cep[0];

  const birth = txt.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  if (birth && !lead.buyer.birth_date) lead.buyer.birth_date = birth[0];

  const rgLabel = txt.match(/\brg[:\s]*([0-9.\-xX]{5,20})/i);
  if (rgLabel && !lead.buyer.rg) lead.buyer.rg = rgLabel[1].trim();

  const phoneMatch = txt.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}\-?\d{4})/);
  if (phoneMatch && !lead.buyer.phone) lead.buyer.phone = phoneMatch[0].trim();

  if (/solteiro|solteira/.test(lower) && !lead.buyer.marital_status) lead.buyer.marital_status = "Solteiro(a)";
  if (/casado|casada/.test(lower) && !lead.buyer.marital_status) lead.buyer.marital_status = "Casado(a)";
  if (/uniao estavel|uni[aã]o est[aá]vel/.test(lower) && !lead.buyer.marital_status) lead.buyer.marital_status = "União estável";
  if (/divorciado|divorciada/.test(lower) && !lead.buyer.marital_status) lead.buyer.marital_status = "Divorciado(a)";

  if (/a vista|avista/.test(lower)) {
    lead.purchase.payment_mode = "avista";
  } else if (/parcelado|parcelar|entrada/.test(lower)) {
    lead.purchase.payment_mode = "parcelado";
    lead.purchase.entry_value = 7290;

    if (/36x/.test(lower)) {
      lead.purchase.installments = 36;
      lead.purchase.installment_value = 1600;
    } else if (/48x/.test(lower)) {
      lead.purchase.installments = 48;
      lead.purchase.installment_value = 1200;
    } else if (/60x/.test(lower)) {
      lead.purchase.installments = 60;
      lead.purchase.installment_value = 960;
    }
  }

  if (!lead.buyer.phone) lead.buyer.phone = lead.phone;

  return lead;
}

// =================================
// MÍDIA
// =================================
async function sendAllBanners(to) {
  for (const banner of CASA_BANNERS) {
    await sendWhatsAppImage(to, banner);
  }
}

async function handleDirectMediaIntent({ from, lead, t }) {
  if (/me mostra tudo|me envie tudo|apresentacao completa|apresentação completa/.test(t)) {
    await sendWhatsAppText(from, "Vou te enviar a apresentação completa da casa 👇");
    await sendAllBanners(from);

    try {
      await sendWhatsAppVideo(from, CASA_VIDEO_URL);
      lead.sent_video = true;
    } catch (err) {
      console.error("FULL MEDIA VIDEO FAIL:", err?.message || err);
      await sendWhatsAppText(from, "O vídeo não carregou agora, mas já te enviei as imagens para você conhecer a casa.");
    }

    lead.media_sent = true;
    lead.sent_photos = true;
    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  if (/(^|\b)(video|tour)(\b|$)|tem video|tem um video/.test(t)) {
    await sendWhatsAppText(from, "Vou te mostrar um vídeo rápido da casa 👇");

    try {
      await sendWhatsAppVideo(from, CASA_VIDEO_URL);
      lead.sent_video = true;
    } catch (err) {
      console.error("VIDEO SEND FAIL:", err?.message || err);
      await sendWhatsAppText(from, "O vídeo não carregou agora. Vou te enviar as imagens da casa para não te deixar esperando.");
      await sendAllBanners(from);
      lead.sent_photos = true;
    }

    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  if (/(^|\b)(foto|fotos|imagem|imagens)(\b|$)|tem foto|tem fotos|manda foto|manda fotos/.test(t)) {
    await sendWhatsAppText(from, "Vou te mostrar algumas imagens da casa 👇");
    await sendAllBanners(from);

    lead.sent_photos = true;
    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  return false;
}

// =================================
// FECHAMENTO
// =================================
async function handleDirectClosing({ from, lead, t }) {
  if (/a vista|avista/.test(t)) {
    lead.purchase = lead.purchase || {};
    lead.purchase.payment_mode = "avista";
  }

  if (/parcelado|parcelar|entrada/.test(t)) {
    lead.purchase = lead.purchase || {};
    lead.purchase.payment_mode = "parcelado";
    if (!lead.purchase.entry_value) lead.purchase.entry_value = 7290;
  }

  const missingMsg = buildMissingDataMessage(lead);

  if (/quero pagar|como faco pra pagar|como faço pra pagar|contrato|quero fechar|quero comprar|reservar|a vista|avista|parcelado/.test(t)) {
    if (missingMsg) {
      await sendWhatsAppText(from, `${FECHAMENTO_INTRO}

${missingMsg}`);

      lead.last_message = nowISO();
      await upsertLead(lead);
      return true;
    }
  }

  return false;
}

// =================================
// WEBHOOK
// =================================
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === verifyToken) {
        return res.status(200).send(challenge);
      }

      return res.status(403).send("Forbidden");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const incoming = extractIncoming(req.body || {});

    if (!incoming || !incoming.from) {
      return res.status(200).json({ ok: true });
    }

    const {
      from,
      type,
      text,
      documentId,
      imageId,
      audioId,
      audioMimeType,
      profileName
    } = incoming;

    let lead = await getLeadByPhone(from);

    if (!lead) {
      lead = {
        phone: from,
        name: profileName || null,
        buyer: {},
        spouse: {},
        purchase: {},
        history: [],
        score: 0,
        stage: "novo",
        sent_map: false,
        sent_video: false,
        sent_photos: false,
        media_sent: false
      };
    }

    lead.phone = from;
    lead.name = lead.name || profileName || null;
    lead.buyer = lead.buyer || {};
    lead.spouse = lead.spouse || {};
    lead.purchase = lead.purchase || {};

    if (!lead.buyer.phone) {
      lead.buyer.phone = from;
    }

    let userText = text || "";
    let sourceLabel = "";

    // PRIORIDADE ABSOLUTA: TEXTO PURO DE ENDEREÇO
    if (isAddressRequest(userText)) {
      await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
      await sendWhatsAppText(from, CASA_MAP_TEXT);

      lead.sent_map = true;
      lead.last_message = nowISO();
      lead.history = clampHistory(
        [
          ...(lead.history || []),
          { role: "user", content: userText, at: nowISO() },
          { role: "assistant", content: `${CASA_ADDRESS_TEXT}\n\n${CASA_MAP_TEXT}`, at: nowISO() }
        ],
        30
      );
      await upsertLead(lead);

      return res.status(200).json({ ok: true });
    }

    // DOCUMENTO
    if (type === "document" && documentId) {
      const buffer = await downloadWhatsAppFile(documentId);
      const pdfText = await readPDF(buffer);

      lead = mergeBuyerDataFromText(lead, pdfText);
      lead = applyManualFieldExtraction(lead, pdfText);

      userText = pdfText || "Cliente enviou documento PDF para cadastro.";
      sourceLabel = "documento";
    }

    // IMAGEM
    // OCR removido para não quebrar a Vercel
    if (type === "image" && imageId) {
      userText = text || "Cliente enviou imagem.";
      sourceLabel = "imagem";
    }

    // ÁUDIO
    if (type === "audio" && audioId) {
      const buffer = await downloadWhatsAppFile(audioId);
      const transcript = await transcribeAudio(buffer, audioMimeType);

      if (transcript) {
        lead = applyManualFieldExtraction(lead, transcript);
        userText = transcript;
      } else {
        userText = "Cliente enviou áudio, mas não foi possível transcrever automaticamente.";
      }

      sourceLabel = "áudio";
    }

    // PRIORIDADE ABSOLUTA: ENDEREÇO APÓS PDF/ÁUDIO
    if (isAddressRequest(userText)) {
      await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
      await sendWhatsAppText(from, CASA_MAP_TEXT);

      lead.sent_map = true;
      lead.last_message = nowISO();
      lead.history = clampHistory(
        [
          ...(lead.history || []),
          { role: "user", content: sourceLabel ? `[${sourceLabel}] ${userText}` : userText, at: nowISO() },
          { role: "assistant", content: `${CASA_ADDRESS_TEXT}\n\n${CASA_MAP_TEXT}`, at: nowISO() }
        ],
        30
      );
      await upsertLead(lead);

      return res.status(200).json({ ok: true });
    }

    lead = applyManualFieldExtraction(lead, userText);

    if (!userText || !userText.trim()) {
      return res.status(200).json({ ok: true });
    }

    const t = normalizeText(userText);

    if (/preco|valor|quanto custa/.test(t)) lead.score = (lead.score || 0) + 2;
    if (/investir|retorno|renda|investimento/.test(t)) lead.score = (lead.score || 0) + 3;
    if (/quero comprar|quero fechar|reservar|quero pagar|contrato|a vista|avista|parcelado/.test(t)) lead.score = (lead.score || 0) + 6;

    if (lead.score >= 6) lead.stage = "fechamento";
    else if (lead.score >= 3) lead.stage = "interessado";
    else if (lead.score >= 1) lead.stage = "curioso";

    lead.history = clampHistory(
      [
        ...(lead.history || []),
        {
          role: "user",
          content: sourceLabel ? `[${sourceLabel}] ${userText}` : userText,
          at: nowISO()
        }
      ],
      30
    );

    lead.last_message = nowISO();
    lead = await upsertLead(lead);

    const handledMedia = await handleDirectMediaIntent({ from, lead, t });
    if (handledMedia) {
      return res.status(200).json({ ok: true });
    }

    const handledClosing = await handleDirectClosing({ from, lead, t });
    if (handledClosing) {
      return res.status(200).json({ ok: true });
    }

    const reply = await generateReply({ lead, userText });

    lead.history = clampHistory(
      [
        ...(lead.history || []),
        { role: "assistant", content: reply, at: nowISO() }
      ],
      30
    );

    lead.last_message = nowISO();
    await upsertLead(lead);

    const parts = reply.split("\n\n");
    for (const part of parts) {
      if (part.trim()) {
        await sendWhatsAppText(from, part.trim());
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(200).json({ ok: false, error: err?.message });
  }
};
