const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppText } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const { generateReply, nowISO, clampHistory } = require("./_agent");

const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");


// ==================================
// NORMALIZAR TEXTO PT-BR
// ==================================

function normalize(txt = "") {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


// ==================================
// BAIXAR ARQUIVO WHATSAPP
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
// LER IMAGEM OCR
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
    // VERIFICAÇÃO WEBHOOK
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
    // LINKS DA CASA
    // ==================================

    const banners = [
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
    ];

    const videoCasa =
      "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4";


    const t = normalize(userText);


    // ==================================
    // DETECTORES INTELIGENTES
    // ==================================

   const detect = {

video:/\b(video|videos|vídeo|vídeos|tour)\b/.test(t)
  
photos:/\b(foto|fotos|imagem|imagens)\b/.test(t),

media:/\b(ver|mostrar|mostra|me mostra|quero ver|tem foto|tem video)\b/.test(t),

interest:/\b(interesse|tenho interesse|quero saber|quero entender|como funciona)\b/.test(t),

hotLead:/\b(comprar|fechar|reservar|pagar|contrato|a vista|parcelado)\b/.test(t)

}

    // ==================================
    // CLIENTE PEDIU VIDEO
    // ==================================

if(detect.video){

await sendWhatsAppText(
from,
"Tenho sim 😊 Vou te mostrar um vídeo rápido da Casa Balanço do Mar."
)

await sendWhatsAppVideo(from,videoCasa)

await sendWhatsAppText(
from,
"A casa acomoda confortavelmente até 6 hóspedes. Você imagina usar mais para férias com a família ou também como investimento?"
)

return res.status(200).json({ok:true})

}

    // ==================================
    // CLIENTE PEDIU FOTOS
    // ==================================

  if(detect.photos || detect.media){

await sendWhatsAppText(
from,
"Vou te mostrar algumas imagens da Casa Balanço do Mar 👇"
)

for(const banner of banners){
await sendWhatsAppImage(from,banner)
}

await sendWhatsAppVideo(from,videoCasa)

return res.status(200).json({ok:true})

}

    // ==================================
    // LER PDF
    // ==================================

    if (type === "document" && documentId) {

      const buffer = await downloadWhatsAppFile(documentId);
      const pdfText = await readPDF(buffer);

      userText =
        "O cliente enviou um documento com os seguintes dados:\n\n" + pdfText;
    }


    // ==================================
    // LER IMAGEM
    // ==================================

    if (type === "image" && imageId) {

      const buffer = await downloadWhatsAppFile(imageId);
      const imageText = await readImage(buffer);

      userText =
        "O cliente enviou uma imagem de documento com os seguintes dados:\n\n" + imageText;
    }


    if (!userText) {
      return res.status(200).json({ ok: true });
    }


    // ==================================
    // DETECTAR LEAD QUENTE
    // ==================================

    const isHotLead = detect.hotLead;


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
    // SALVAR MENSAGEM
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
    // GERAR RESPOSTA IA
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
    // ALERTA LEAD QUENTE
    // ==================================

    if (isHotLead) {

      const alert = `🚨 LEAD QUENTE

Cliente: ${lead.name || "não informado"}
Telefone: ${from}

Mensagem:
"${userText}"
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
