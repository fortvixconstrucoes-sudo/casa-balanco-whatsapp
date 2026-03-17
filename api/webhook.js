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
  buildContractFormText,
  buildPaymentDataMessage,
  buildMissingDataMessage,
  mergeBuyerDataFromText,
 } = require("./_agent");

const {
  isAddressRequest,
  sendAddress
} = require("./_address");

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

  // pagamento (memória, sem forçar fechamento)
  if (/a vista|avista/.test(lower)) {
    lead.purchase.payment_mode = "avista";
  } else if (/parcelado|parcelar|entrada/.test(lower)) {
    lead.purchase.payment_mode = "parcelado";

    if (!lead.purchase.entry_value) {
      lead.purchase.entry_value = 7290;
    }

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
// DETECÇÃO DE SEMANAS DESEJADAS
// =================================
function detectDesiredWeeks(text = "") {
  const t = normalizeText(text);
  const weeks = [];

  if (t.includes("janeiro")) weeks.push("Janeiro");
  if (t.includes("fevereiro")) weeks.push("Fevereiro");
  if (t.includes("marco") || t.includes("março")) weeks.push("Março");
  if (t.includes("abril")) weeks.push("Abril");
  if (t.includes("maio")) weeks.push("Maio");
  if (t.includes("junho")) weeks.push("Junho");
  if (t.includes("julho")) weeks.push("Julho");
  if (t.includes("agosto")) weeks.push("Agosto");
  if (t.includes("setembro")) weeks.push("Setembro");
  if (t.includes("outubro")) weeks.push("Outubro");
  if (t.includes("novembro")) weeks.push("Novembro");
  if (t.includes("dezembro")) weeks.push("Dezembro");

  if (t.includes("carnaval")) weeks.push("Carnaval");
  if (t.includes("natal")) weeks.push("Natal");
  if (t.includes("reveillon") || t.includes("réveillon")) weeks.push("Reveillon");

  return weeks;
}

// =================================
// DETECÇÃO DE INTENÇÃO
// =================================
function detectIntent(text = "") {
  const tx = normalizeText(text);

  return {
    video:
      /(^|\b)(video|vídeo|tour)(\b|$)/.test(tx) ||
      tx.includes("tem video") ||
      tx.includes("tem vídeo"),

    photos:
      /(^|\b)(foto|fotos|imagem|imagens)(\b|$)/.test(tx) ||
      tx.includes("manda foto") ||
      tx.includes("manda fotos"),

    price:
      tx.includes("preco") ||
      tx.includes("preço") ||
      tx.includes("valor") ||
      tx.includes("quanto custa") ||
      tx.includes("qual valor"),

    invest:
      tx.includes("investir") ||
      tx.includes("retorno") ||
      tx.includes("renda"),

    visit:
      tx.includes("visitar") ||
      tx.includes("visita"),

    negotiation:
      tx.includes("parcelado") ||
      tx.includes("entrada") ||
      tx.includes("desconto") ||
      tx.includes("condicao") ||
      tx.includes("condição"),

    buy:
      tx.includes("quero comprar") ||
      tx.includes("quero fechar") ||
      tx.includes("reservar") ||
      tx.includes("contrato") ||
      tx.includes("quero pagar") ||
      tx.includes("me manda a ficha") ||
      tx.includes("pode seguir") ||
      tx.includes("vou pagar"),

    fullMedia:
      tx.includes("me mostra tudo") ||
      tx.includes("apresentacao completa") ||
      tx.includes("apresentação completa")
  };
}

// =================================
// DETECÇÃO DE OBJEÇÕES
// =================================
function detectObjection(text = "") {
  const t = normalizeText(text);

  if (t.includes("caro")) {
    return `Entendo 😊

Muitos clientes pensam isso no início.

Mas quando comparam com aluguel e hotel todos os anos,
percebem que a fração é mais inteligente.

Hoje temos poucas frações disponíveis.

O que mais pesou para você?`;
  }

  if (t.includes("vou pensar")) {
    return `Claro 😊

Você está mais inclinado a:

1️⃣ à vista  
ou  
2️⃣ parcelado?`;
  }

  return null;
}

// =================================
// NEGOCIAÇÃO
// =================================
function buildNegotiationReply(userText, lead) {
  const t = normalizeText(userText);

  if (t.includes("valor") || t.includes("preco") || t.includes("preço")) {
    return `Hoje a fração está assim:

À vista: R$ 59.890  
ou parcelado com entrada de R$ 7.290.

🎁 Bônus:
2 diárias extras até setembro de 2026.

Você prefere à vista ou parcelado?`;
  }

  if (t.includes("parcelado")) {
    return `Entrada: R$ 7.290

36x de R$ 1.600  
48x de R$ 1.200  
60x de R$ 960  

Qual opção faz mais sentido pra você?`;
  }

  return null;
}

// =================================
// ENVIO DE MÍDIA
// =================================
async function sendAllBanners(to) {
  for (const banner of CASA_BANNERS) {
    await sendWhatsAppImage(to, banner);
  }
}

// =================================
// 🔥 CORREÇÃO CRÍTICA (SEU PROBLEMA)
// =================================
async function handleDirectMediaIntent({ from, lead, detect }) {

  // PRIORIDADE TOTAL
  if (detect.photos) {
    await sendWhatsAppText(from, "Vou te mostrar as fotos da casa 👇");
    await sendAllBanners(from);

    lead.sent_photos = true;
    lead.last_message = nowISO();
    await upsertLead(lead);

    return true;
  }

  if (detect.video) {
    await sendWhatsAppText(from, "Vou te mostrar o vídeo da casa 👇");

    try {
      await sendWhatsAppVideo(from, CASA_VIDEO_URL);
    } catch {
      await sendWhatsAppText(from, "Vou te enviar as fotos enquanto isso 👇");
      await sendAllBanners(from);
    }

    return true;
  }

  if (detect.price) {
    await sendWhatsAppText(
      from,
      `Hoje a fração está:

À vista: R$ 59.890  
ou parcelado com entrada de R$ 7.290.

Você prefere qual condição?`
    );

    return true;
  }

  if (detect.fullMedia) {
    await sendAllBanners(from);
    await sendWhatsAppVideo(from, CASA_VIDEO_URL);
    return true;
  }

  return false;
}

// =================================
// FECHAMENTO
// =================================
async function finalizeSaleFlow(from, lead) {
  const formText = buildContractFormText(lead);
  const paymentText = buildPaymentDataMessage();

  await sendWhatsAppText(from, formText);
  await sendWhatsAppText(from, paymentText);
}
// =================================
// WEBHOOK
// =================================
module.exports = async (req, res) => {
  try {
    // ===============================
    // VERIFICAÇÃO META
    // ===============================
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

    let userText = text || "";
    let sourceLabel = "";

    // =================================
    // ENDEREÇO PRIORIDADE
    // =================================
    if (isAddressRequest(userText)) {
      await sendAddress(sendWhatsAppText, from);
      return res.status(200).json({ ok: true });
    }

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
        stage: "novo"
      };
    }

    // =================================
    // PDF
    // =================================
    if (type === "document" && documentId) {
      const buffer = await downloadWhatsAppFile(documentId);
      const pdfText = await readPDF(buffer);

      lead = mergeBuyerDataFromText(lead, pdfText);
      lead = applyManualFieldExtraction(lead, pdfText);

      userText = pdfText;
      sourceLabel = "documento";
    }

    // =================================
    // AUDIO
    // =================================
    if (type === "audio" && audioId) {
      const buffer = await downloadWhatsAppFile(audioId);
      const transcript = await transcribeAudio(buffer, audioMimeType);

      if (transcript) {
        lead = applyManualFieldExtraction(lead, transcript);
        userText = transcript;
      }

      sourceLabel = "áudio";
    }

    // =================================
    // EXTRAÇÃO
    // =================================
    lead = applyManualFieldExtraction(lead, userText);

    const t = normalizeText(userText);
    const detect = detectIntent(t);

    // =================================
    // 🔥 PRIORIDADE ABSOLUTA (CORREÇÃO)
    // =================================
    const handledMedia = await handleDirectMediaIntent({ from, lead, detect });
    if (handledMedia) {
      return res.status(200).json({ ok: true, route: "media" });
    }

    // =================================
    // SAUDAÇÃO (DEPOIS DA MÍDIA)
    // =================================
    if (
      t === "oi" ||
      t === "ola" ||
      t === "olá" ||
      t === "bom dia" ||
      t === "boa tarde" ||
      t === "boa noite"
    ) {
      const greeting = `Olá! Seja bem-vindo 😊

Posso te mostrar:

• fotos  
• vídeo  
• valor  
• localização  

O que você quer ver primeiro?`;

      await sendWhatsAppText(from, greeting);

      return res.status(200).json({ ok: true });
    }

    // =================================
    // OBJEÇÃO
    // =================================
    const objection = detectObjection(userText);
    if (objection) {
      await sendWhatsAppText(from, objection);
      return res.status(200).json({ ok: true });
    }

    // =================================
    // NEGOCIAÇÃO
    // =================================
    if (detect.negotiation) {
      const reply = buildNegotiationReply(userText, lead);
      if (reply) {
        await sendWhatsAppText(from, reply);
        return res.status(200).json({ ok: true });
      }
    }

    // =================================
    // FECHAMENTO
    // =================================
    if (detect.buy) {
      await finalizeSaleFlow(from, lead);
      return res.status(200).json({ ok: true });
    }

    // =================================
    // IA FINAL
    // =================================
    const reply = await generateReply({ lead, userText });

    await sendWhatsAppText(from, reply);

    // =================================
    // FOLLOW-UP AUTOMÁTICO (SALVA)
    // =================================
    lead.followup = lead.followup || {};
    lead.followup.last_interaction = nowISO();

    await upsertLead(lead);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);

    return res.status(200).json({
      ok: false,
      error: err?.message
    });
  }
};
