const fetch = global.fetch || require("node-fetch");
const FormData = require("form-data");
const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");

const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppText } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const {
  generateReply,
  nowISO,
  clampHistory,
  normalizeText,
  buildContractFormText,
  buildPaymentDataMessage,
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
    throw new Error(
      `Falha ao obter metadados do arquivo WhatsApp: ${JSON.stringify(metaJson)}`
    );
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
// OCR DE IMAGEM
// =================================
async function readImage(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, "por");
    return result?.data?.text || "";
  } catch (err) {
    console.error("OCR ERROR:", err?.message || err);
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

  const msg = value?.messages?.[0];
  if (!msg) return {};

  const contact = value?.contacts?.[0];

  const from = msg?.from;
  const type = msg?.type;
  const text =
    msg?.text?.body ||
    msg?.caption ||
    msg?.button?.text ||
    msg?.interactive?.button_reply?.title ||
    msg?.interactive?.list_reply?.title ||
    "";

  const documentId = msg?.document?.id;
  const imageId = msg?.image?.id;
  const audioId = msg?.audio?.id;
  const audioMimeType = msg?.audio?.mime_type || "audio/ogg";

  const profileName = contact?.profile?.name;

  return {
    from,
    type,
    text,
    documentId,
    imageId,
    audioId,
    audioMimeType,
    profileName
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

  const phoneMatch = txt.match(
    /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}\-?\d{4})/
  );
  if (phoneMatch && !lead.buyer.phone) {
    lead.buyer.phone = phoneMatch[0].trim();
  }

  if (/solteiro|solteira/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "Solteiro(a)";
  }
  if (/casado|casada/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "Casado(a)";
  }
  if (/uniao estavel|uni[aã]o est[aá]vel/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "União estável";
  }
  if (/divorciado|divorciada/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "Divorciado(a)";
  }

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

  if (!lead.buyer.phone) {
    lead.buyer.phone = lead.phone;
  }

  if (!lead.buyer.street) {
    const addressLine = txt.match(
      /\b(?:rua|avenida|av\.?|travessa|rodovia|estrada|alameda|loteamento|praça)\b[^\n]{8,140}/i
    );
    if (addressLine) {
      lead.buyer.street = addressLine[0].trim();
    }
  }

  const lines = txt
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const line of lines) {
    const l = normalizeText(line);

    if ((l.startsWith("nome:") || l.startsWith("nome completo:")) && !lead.buyer.full_name) {
      lead.buyer.full_name = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("profissao:") || l.startsWith("profissão:")) {
      lead.buyer.profession = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("endereco:") || l.startsWith("endereço:")) {
      lead.buyer.street = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("cidade:")) {
      lead.buyer.city = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("estado:")) {
      lead.buyer.state = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("telefone:") || l.startsWith("celular:")) {
      lead.buyer.phone = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("email:") || l.startsWith("e-mail:")) {
      lead.buyer.email = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("conjuge:") || l.startsWith("cônjuge:")) {
      lead.spouse.full_name = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("estado civil do conjuge:") || l.startsWith("estado civil do cônjuge:")) {
      lead.spouse.marital_status = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("cpf do conjuge:") || l.startsWith("cpf do cônjuge:")) {
      lead.spouse.cpf = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("rg do conjuge:") || l.startsWith("rg do cônjuge:")) {
      lead.spouse.rg = line.split(":").slice(1).join(":").trim();
    }

    if (l.startsWith("regime de bens:")) {
      lead.spouse.property_regime = line.split(":").slice(1).join(":").trim();
    }
  }

  if (
    !lead.buyer.full_name &&
    txt &&
    txt.length <= 60 &&
    !txt.includes("@") &&
    !/\d{3}\.?\d{3}\.?\d{3}/.test(txt) &&
    !/oi|ola|bom dia|boa tarde|boa noite/i.test(txt)
  ) {
    const words = txt.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      lead.buyer.full_name = txt.trim();
    }
  }

  return lead;
}

// =================================
// DETECÇÃO DE INTENÇÃO
// =================================
function detectIntent(t) {
  const tx = normalizeText(t);

  return {
    video:
      /(^|\b)(video|tour)(\b|$)/.test(tx) ||
      tx.includes("tem video") ||
      tx.includes("tem um video"),

    photos:
      /(^|\b)(foto|fotos|imagem|imagens)(\b|$)/.test(tx) ||
      tx.includes("tem foto") ||
      tx.includes("tem fotos") ||
      tx.includes("manda foto") ||
      tx.includes("manda fotos"),

    price:
      tx.includes("preco") ||
      tx.includes("valor") ||
      tx.includes("quanto custa"),

    invest:
      tx.includes("investir") ||
      tx.includes("retorno") ||
      tx.includes("renda") ||
      tx.includes("investimento"),

    visit:
      tx.includes("visitar") ||
      tx.includes("visita"),

    buy:
      tx.includes("quero comprar") ||
      tx.includes("quero fechar") ||
      tx.includes("vamos fechar") ||
      tx.includes("reservar") ||
      tx.includes("quero pagar") ||
      tx.includes("como faco pra pagar") ||
      tx.includes("como faço pra pagar") ||
      tx.includes("contrato") ||
      tx.includes("a vista") ||
      tx.includes("avista") ||
      tx.includes("parcelado"),

    fullMedia:
      tx.includes("me mostra tudo") ||
      tx.includes("me envie tudo") ||
      tx.includes("apresentacao completa") ||
      tx.includes("apresentação completa")
  };
}

// =================================
// MÍDIA DIRETA
// =================================
async function sendAllBanners(to) {
  for (const banner of CASA_BANNERS) {
    await sendWhatsAppImage(to, banner);
  }
}

async function handleDirectMediaIntent({ from, lead, detect }) {
  if (detect.fullMedia) {
    await sendWhatsAppText(from, "Vou te enviar a apresentação completa da casa 👇");
    await sendAllBanners(from);

    try {
      await sendWhatsAppVideo(from, CASA_VIDEO_URL);
      lead.sent_video = true;
    } catch (err) {
      console.error("FULL MEDIA VIDEO FAIL:", err?.message || err);
      await sendWhatsAppText(
        from,
        "O vídeo não carregou agora, mas já te enviei as imagens para você conhecer a casa."
      );
    }

    lead.media_sent = true;
    lead.sent_photos = true;
    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  if (detect.video) {
    await sendWhatsAppText(from, "Vou te mostrar um vídeo rápido da casa 👇");

    try {
      await sendWhatsAppVideo(from, CASA_VIDEO_URL);
      lead.sent_video = true;
    } catch (err) {
      console.error("VIDEO SEND FAIL:", err?.message || err);
      await sendWhatsAppText(
        from,
        "O vídeo não carregou agora. Vou te enviar as imagens da casa para não te deixar esperando."
      );
      await sendAllBanners(from);
      lead.sent_photos = true;
    }

    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  if (detect.photos) {
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
// FECHAMENTO DIRETO
// =================================
async function finalizeSaleFlow(from, lead) {
  const formText = buildContractFormText(lead);
  const paymentText = buildPaymentDataMessage();

  await sendWhatsAppText(from, "Perfeito! Agora já tenho os dados necessários para finalizar 😊");
  await sendWhatsAppText(from, formText);
  await sendWhatsAppText(
    from,
    "Confira os dados acima. Se estiver tudo certo, me devolva a ficha assinada junto com o comprovante de pagamento para confirmarmos sua fração."
  );
  await sendWhatsAppText(from, paymentText);

  lead.contract_sent = true;
  lead.signed_form_requested = true;
  lead.payment_requested = true;
  lead.payment_proof_requested = true;
  lead.last_message = nowISO();
  await upsertLead(lead);
}

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

  if (
    /quero pagar|como faco pra pagar|como faço pra pagar|contrato|quero fechar|quero comprar|reservar|a vista|avista|parcelado/.test(
      t
    )
  ) {
    if (missingMsg) {
      await sendWhatsAppText(from, `${FECHAMENTO_INTRO}

${missingMsg}`);

      lead.last_message = nowISO();
      await upsertLead(lead);
      return true;
    }

    await finalizeSaleFlow(from, lead);
    return true;
  }

  return false;
}

async function handleDocumentDrivenProgress({ from, lead, sourceLabel }) {
  const missingMsg = buildMissingDataMessage(lead);

  if (missingMsg) {
    await sendWhatsAppText(
      from,
      `Perfeito! Recebi seu ${sourceLabel} e atualizei os dados 😊

${missingMsg}`
    );

    lead.last_message = nowISO();
    await upsertLead(lead);
    return true;
  }

  await sendWhatsAppText(
    from,
    `Perfeito! Recebi seu ${sourceLabel} e agora já temos os dados necessários para concluir 😊`
  );

  await finalizeSaleFlow(from, lead);
  return true;
}

// =================================
// RESPOSTA TRAVADA DE ENDEREÇO
// =================================
async function replyWithAddress(from, lead = null) {
  await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
  await sendWhatsAppText(from, CASA_MAP_TEXT);

  if (lead) {
    lead.sent_map = true;
    lead.last_message = nowISO();
    lead.history = clampHistory(
      [
        ...(lead.history || []),
        {
          role: "assistant",
          content: `${CASA_ADDRESS_TEXT}\n\n${CASA_MAP_TEXT}`,
          at: nowISO()
        }
      ],
      30
    );
    await upsertLead(lead);
  }
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

    const body = req.body || {};
    const incoming = extractIncoming(body);

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
        buyer: {},
        spouse: {},
        purchase: {},
        history: [],
        score: 0,
        stage: "novo"
      };
    }

    lead.buyer = lead.buyer || {};
    lead.spouse = lead.spouse || {};
    lead.purchase = lead.purchase || {};

    if (!lead.buyer.phone) {
      lead.buyer.phone = from;
    }

    if (!lead.name && profileName) {
      lead.name = profileName;
    }

    let userText = text || "";
    let sourceLabel = "";

    // =================================
    // PRIORIDADE MÁXIMA: TEXTO PURO DE ENDEREÇO
    // =================================
    if (isAddressRequest(userText)) {
      lead.history = clampHistory(
        [
          ...(lead.history || []),
          { role: "user", content: userText, at: nowISO() }
        ],
        30
      );
      await replyWithAddress(from, lead);
      return res.status(200).json({ ok: true });
    }

    // =================================
    // DOCUMENTO
    // =================================
    if (type === "document" && documentId) {
      const buffer = await downloadWhatsAppFile(documentId);
      const pdfText = await readPDF(buffer);

      lead = mergeBuyerDataFromText(lead, pdfText);
      lead = applyManualFieldExtraction(lead, pdfText);

      userText = pdfText || "Cliente enviou documento PDF para cadastro.";
      sourceLabel = "documento";
    }

    // =================================
    // IMAGEM
    // =================================
    if (type === "image" && imageId) {
      const buffer = await downloadWhatsAppFile(imageId);
      const imgText = await readImage(buffer);

      if (imgText && imgText.trim().length > 12) {
        lead = mergeBuyerDataFromText(lead, imgText);
        lead = applyManualFieldExtraction(lead, imgText);
        userText = imgText;
        sourceLabel = "imagem";
      } else {
        userText = text || "Cliente enviou imagem.";
      }
    }

    // =================================
    // ÁUDIO
    // =================================
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

    // =================================
    // PRIORIDADE MÁXIMA: ENDEREÇO APÓS OCR/PDF/ÁUDIO
    // =================================
    if (isAddressRequest(userText)) {
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
      await replyWithAddress(from, lead);
      return res.status(200).json({ ok: true });
    }

    // =================================
    // EXTRAÇÃO GERAL
    // =================================
    lead = applyManualFieldExtraction(lead, userText);

    if (!userText || !userText.trim()) {
      return res.status(200).json({ ok: true });
    }

    const t = normalizeText(userText);
    const detect = detectIntent(t);

    if (detect.price) lead.score = (lead.score || 0) + 2;
    if (detect.invest) lead.score = (lead.score || 0) + 3;
    if (detect.buy) lead.score = (lead.score || 0) + 6;

    if (lead.score >= 6) lead.stage = "fechamento";
    else if (lead.score >= 3) lead.stage = "interessado";
    else if (lead.score >= 1) lead.stage = "curioso";

    // =================================
    // HISTÓRICO USER
    // =================================
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

    // =================================
    // FLUXO DIRETO DE DOCUMENTO / IMAGEM / ÁUDIO
    // =================================
    if (sourceLabel) {
      const handledDocProgress = await handleDocumentDrivenProgress({
        from,
        lead,
        sourceLabel
      });

      if (handledDocProgress) {
        return res.status(200).json({ ok: true });
      }
    }

    // =================================
    // FLUXOS DIRETOS DE MÍDIA
    // =================================
    const handledMedia = await handleDirectMediaIntent({ from, lead, detect });
    if (handledMedia) {
      return res.status(200).json({ ok: true });
    }

    // =================================
    // FLUXO DIRETO DE FECHAMENTO
    // =================================
    const handledClosing = await handleDirectClosing({ from, lead, t });
    if (handledClosing) {
      return res.status(200).json({ ok: true });
    }

    // =================================
    // PROPOSTA AUTOMÁTICA
    // =================================
    if ((lead.stage === "fechamento" || detect.buy) && !lead.proposal_sent) {
      await sendWhatsAppText(
        from,
        `Perfeito 😊

Vou te apresentar a condição atual da fração:

Valor promocional à vista: R$ 59.890,00

Ou parcelado:

Entrada: R$ 7.290,00
36x de R$ 1.600,00
48x de R$ 1.200,00
60x de R$ 960,00

Cada fração garante 2 semanas por ano.

Se fizer sentido para você, eu sigo agora com sua ficha.`
      );

      lead.proposal_sent = true;
      lead.last_message = nowISO();
      await upsertLead(lead);
      return res.status(200).json({ ok: true });
    }

    // =================================
    // IA CONSULTIVA
    // =================================
    const reply = await generateReply({ lead, userText });

    if (/ficha preenchida|assine e me devolva/i.test(reply)) {
      lead.contract_sent = true;
      lead.signed_form_requested = true;
    }

    if (/dados para pagamento|chave pix|conta corrente/i.test(reply)) {
      lead.payment_requested = true;
      lead.payment_proof_requested = true;
    }

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

    return res.status(200).json({
      ok: false,
      error: err?.message
    });
  }
};
