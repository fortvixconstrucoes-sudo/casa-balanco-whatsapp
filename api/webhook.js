const { sendWhatsAppImage, sendWhatsAppVideo } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const { sendWhatsAppText } = require("./_wa");
const { generateReply, nowISO, clampHistory } = require("./_agent");

const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");

// ==================================
// BAIXAR ARQUIVO DO WHATSAPP
// ==================================

async function downloadWhatsAppFile(fileId) {

  const meta = await fetch(
    `https://graph.facebook.com/v19.0/${fileId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    }
  );

  const metaJson = await meta.json();

  const file = await fetch(metaJson.url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  const buffer = await file.arrayBuffer();

  return Buffer.from(buffer);
}

// ==================================
// LER PDF
// ==================================

async function readPDF(buffer) {

  const data = await pdf(buffer);

  return data.text;
}

// ==================================
// LER IMAGEM (OCR)
// ==================================

async function readImage(buffer) {

  const result = await Tesseract.recognize(buffer, "por");

  return result.data.text;
}

// ==================================
// EXTRAIR MENSAGEM
// ==================================

function extractIncoming(body) {

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const msg = value?.messages?.[0];
  const contact = value?.contacts?.[0];

  const from = msg?.from;
  const type = msg?.type;
  const text = msg?.text?.body;

  const documentId = msg?.document?.id;
  const imageId = msg?.image?.id;
  const audioId = msg?.audio?.id;

  const profileName = contact?.profile?.name;

 return {
  from,
  type,
  text,
  documentId,
  imageId,
  audioId,
  profileName
};
}

// ==================================
// WEBHOOK
// ==================================

module.exports = async (req, res) => {

  try {

    // ==================================
    // VERIFICAÇÃO DO WEBHOOK
    // ==================================

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

    // ==================================
    // RECEBER MENSAGEM
    // ==================================

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const body = req.body || {};

   const {
  from,
  type,
  text,
  documentId,
  imageId,
  audioId,
  profileName
} = extractIncoming(body);

    if (!from) {
      return res.status(200).json({ ok: true });
    }

    let userText = text || "";

    // ==================================
// LINKS DOS BANNERS
// ==================================

const banners = [
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
]

const videoCasa =
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4"

const t = userText.toLowerCase()

const t = userText.toLowerCase()

// ==================================
// DETECTAR PEDIDO DE FOTOS
// ==================================

const wantsPhotos =
t.includes("foto") ||
t.includes("fotos") ||
t.includes("imagem") ||
t.includes("imagens") ||
t.includes("ver fotos") ||
t.includes("tem fotos")

// ==================================
// DETECTAR PEDIDO DE VIDEO
// ==================================

const wantsVideo =
t.includes("video") ||
t.includes("vídeo") ||
t.includes("tem video") ||
t.includes("tem vídeo")

// ==================================
// CLIENTE PEDIU VIDEO
// ==================================

if(wantsVideo){

await sendWhatsAppText(
from,
"Claro 😊 Vou te mostrar um vídeo rápido da Casa Balanço do Mar."
)

await sendWhatsAppVideo(from,videoCasa)

await sendWhatsAppText(
from,
"Essa casa comporta até 6 pessoas. Você imagina usar mais para férias com a família ou também como investimento?"
)

return res.status(200).json({ ok:true })

}

// ==================================
// CLIENTE PEDIU FOTOS
// ==================================

if(wantsPhotos){

await sendWhatsAppText(
from,
"Perfeito 😊 Vou te mostrar algumas imagens da Casa Balanço do Mar."
)

for(const banner of banners){
await sendWhatsAppImage(from,banner)
}

await sendWhatsAppText(
from,
"E aqui um vídeo rápido da casa para você sentir a experiência."
)

await sendWhatsAppVideo(from,videoCasa)

await sendWhatsAppText(
from,
"Imagine passar uma semana em Prado com sua família em uma casa completa como essa. Você imagina usar mais para férias ou também como investimento?"
)

return res.status(200).json({ ok:true })

}

await sendWhatsAppText(
from,
"Perfeito 😊 Vou te mostrar algumas imagens da Casa Balanço do Mar."
)

for(const banner of banners){
await sendWhatsAppImage(from,banner)
}

await sendWhatsAppText(
from,
"E aqui um vídeo rápido da casa para você sentir a experiência."
)

await sendWhatsAppVideo(from,videoCasa)

await sendWhatsAppText(
from,
"Imagine passar uma semana em Prado com sua família em uma casa completa como essa. Você imagina usar mais para férias ou também como investimento?"
)

return res.status(200).json({ ok:true })

}

    // ==================================
    // LER DOCUMENTO PDF
    // ==================================

    if (type === "document" && documentId) {

      const buffer = await downloadWhatsAppFile(documentId);

      const pdfText = await readPDF(buffer);

      userText =
        "O cliente enviou um documento com os seguintes dados:\n\n" +
        pdfText;
    }

    // ==================================
    // LER IMAGEM (RG / CNH / COMPROVANTE)
    // ==================================

    if (type === "image" && imageId) {

      const buffer = await downloadWhatsAppFile(imageId);

      const imageText = await readImage(buffer);

      userText =
        "O cliente enviou uma imagem de documento com os seguintes dados:\n\n" +
        imageText;
    }

    if (!userText) {
      return res.status(200).json({ ok: true });
    }
    
// ==================================
// LER AUDIO (WHISPER)
// ==================================

if (type === "audio" && audioId) {

  const buffer = await downloadWhatsAppFile(audioId);

  const formData = new FormData();

  formData.append(
    "file",
    new Blob([buffer]),
    "audio.ogg"
  );

  formData.append(
    "model",
    "whisper-1"
  );

  const transcription = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    }
  );

  const tr = await transcription.json();

  userText = tr.text || "";
}
    
    // ==================================
    // DETECTAR LEAD QUENTE
    // ==================================

   const hotSignals = [
     "vou querer",
     "vou fechar",
      "quero",
     "quero sim",
  "quero comprar",
  "quero fechar",
  "quero reservar",
  "quero pagar",
  "quero contrato",
  "à vista",
  "a vista",
  "parcelado",
  "manda contrato",
  "tenho interesse",
  "vamos fechar",
  "quero garantir"
];

    const textLower = userText.toLowerCase();

    const isHotLead = hotSignals.some(signal =>
      textLower.includes(signal)
    );

    // ==================================
    // CARREGAR LEAD
    // ==================================

    let lead = await getLeadByPhone(from);

    if (!lead) {
      lead = {
        phone: from,
        name: null,
        stage: "novo",
        history: [],
        last_message: nowISO(),
        followup1: false,
        followup2: false
      };
    }

    if (!lead.name && profileName) {
      lead.name = profileName;
    }

    // ==================================
    // SALVAR MENSAGEM DO CLIENTE
    // ==================================

    lead.history = clampHistory(
      [
        ...(lead.history || []),
        { role: "user", content: userText, at: nowISO() }
      ],
      18
    );

    lead.last_message = nowISO();

    lead = await upsertLead(lead);

    // ==================================
    // GERAR RESPOSTA
    // ==================================

    const reply = await generateReply({
      lead,
      userText
    });

    // ==================================
    // SALVAR RESPOSTA
    // ==================================

    lead.history = clampHistory(
      [
        ...(lead.history || []),
        { role: "assistant", content: reply, at: nowISO() }
      ],
      18
    );

    lead.last_message = nowISO();

    await upsertLead(lead);

    // ==================================
    // ENVIAR RESPOSTA
    // ==================================

const parts = reply.split("\n\n");

for (const part of parts) {
  if (part.trim()) {
    await sendWhatsAppText(from, part.trim());
  }
}
    // ==================================
    // ALERTA DE LEAD QUENTE
    // ==================================

    if (isHotLead) {

      const alert = `
🚨 LEAD QUENTE

Cliente: ${lead.name || "não informado"}
Telefone: ${from}

Mensagem:
"${userText}"

Entre em contato agora para fechar.
`;

      await sendWhatsAppText(
        "5527998331176",
        alert
      );
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
