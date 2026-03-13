const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppText } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const {
  generateReply,
  nowISO,
  clampHistory,
  normalizeText,
  sendCasaMedia,
  mergeBuyerDataFromText,
  buildContractFormText,
  buildPaymentDataMessage,
  buildMissingDataMessage
} = require("./_agent");

const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");

// =================================
// DOWNLOAD ARQUIVO WHATSAPP
// =================================
async function downloadWhatsAppFile(fileId) {
  const meta = await fetch(`https://graph.facebook.com/v19.0/${fileId}`, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  const metaJson = await meta.json();

  const file = await fetch(metaJson.url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer);
}

// =================================
// LER PDF
// =================================
async function readPDF(buffer) {
  const data = await pdf(buffer);
  return data.text;
}

// =================================
// OCR IMAGEM
// =================================
async function readImage(buffer) {
  const result = await Tesseract.recognize(buffer, "por");
  return result.data.text;
}

// =================================
// EXTRAIR MENSAGEM
// =================================
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

  const profileName = contact?.profile?.name;

  return {
    from,
    type,
    text,
    documentId,
    imageId,
    profileName
  };
}

// =================================
// EXTRAÇÃO DE DADOS DO CLIENTE
// =================================
function applyManualFieldExtraction(lead, userText) {
  const txt = userText || "";
  const lower = normalizeText(txt);

  lead.buyer = lead.buyer || {};
  lead.spouse = lead.spouse || {};
  lead.purchase = lead.purchase || {};

  const email = txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email && !lead.buyer.email) lead.buyer.email = email[0];

  const cpf = txt.match(/\b\d{3}\.?\d{3}\.?\d{3}\-?\d{2}\b/);
  if (cpf && !lead.buyer.cpf) lead.buyer.cpf = cpf[0];

  const cep = txt.match(/\b\d{5}\-?\d{3}\b/);
  if (cep && !lead.buyer.cep) lead.buyer.cep = cep[0];

  const birth = txt.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  if (birth && !lead.buyer.birth_date) lead.buyer.birth_date = birth[0];

  const rg = txt.match(/\brg[:\s]*([0-9.\-xX]{5,20})/i);
  if (rg && !lead.buyer.rg) lead.buyer.rg = rg[1].trim();

  if (/solteiro|solteira/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "Solteiro(a)";
  }
  if (/casado|casada/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "Casado(a)";
  }
  if (/uniao estavel|uni[aã]o est[aá]vel/.test(lower) && !lead.buyer.marital_status) {
    lead.buyer.marital_status = "União estável";
  }

  const modeAvista = /a vista|avista/.test(lower);
  const modeParcelado = /parcelado|parcelar|entrada/.test(lower);

  if (modeAvista) {
    lead.purchase.payment_mode = "avista";
  } else if (modeParcelado) {
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

  return lead;
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

    const { from, type, text, documentId, imageId, profileName } = extractIncoming(body);

    if (!from) {
      return res.status(200).json({ ok: true });
    }

    let userText = text || "";
    const t = normalizeText(userText);

    // ===============================
    // INTENÇÕES
    // ===============================
    const detect = {
      video: /video|vídeo|tour/.test(t),
      photos: /foto|imagem/.test(t),
      address: /endereco|endereço|onde fica|localizacao|localização|mapa/.test(t),
      price: /preco|preço|valor|quanto custa/.test(t),
      invest: /investir|retorno|renda|investimento/.test(t),
      visit: /visitar|visita/.test(t),
      buy: /quero comprar|quero fechar|vamos fechar|reservar|quero pagar|como faco pra pagar|como faço pra pagar/.test(t)
    };

    // ===============================
    // CARREGAR LEAD
    // ===============================
    let lead = await getLeadByPhone(from);

    if (!lead.name && profileName) {
      lead.name = profileName;
    }

    if (!lead.buyer) lead.buyer = {};
    if (!lead.buyer.phone) lead.buyer.phone = from;

    // ===============================
    // SCORE
    // ===============================
    if (detect.price) lead.score += 2;
    if (detect.invest) lead.score += 3;
    if (detect.buy) lead.score += 6;

    if (lead.score >= 6) lead.stage = "fechamento";
    else if (lead.score >= 3) lead.stage = "interessado";
    else if (lead.score >= 1) lead.stage = "curioso";

    // ===============================
    // DOCUMENTO
    // ===============================
    if (type === "document" && documentId) {
      const buffer = await downloadWhatsAppFile(documentId);
      const pdfText = await readPDF(buffer);

      lead = mergeBuyerDataFromText(lead, pdfText);
      lead = applyManualFieldExtraction(lead, pdfText);

      userText = `Cliente enviou documento com dados para cadastro.

Dados identificados:
${pdfText}

Verifique o que falta na ficha e peça apenas os dados faltantes.`;
    }

    // ===============================
    // IMAGEM / OCR
    // ===============================
    if (type === "image" && imageId) {
      const buffer = await downloadWhatsAppFile(imageId);
      const imgText = await readImage(buffer);

      lead = mergeBuyerDataFromText(lead, imgText);
      lead = applyManualFieldExtraction(lead, imgText);

      userText = `Cliente enviou imagem com dados pessoais.

Dados identificados:
${imgText}

Verifique o que falta na ficha e peça apenas os dados faltantes.`;
    }

    // ===============================
    // EXTRAÇÃO MANUAL DO TEXTO
    // ===============================
    lead = applyManualFieldExtraction(lead, userText);

    // ===============================
    // MÍDIA
    // ===============================
    if (detect.video && !lead.sent_video) {
      await sendWhatsAppText(from, "Vou te mostrar um vídeo rápido da casa 😊");
      await sendWhatsAppVideo(
        from,
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4"
      );
      lead.sent_video = true;
      lead.last_message = nowISO();
      await upsertLead(lead);
      return res.status(200).json({ ok: true });
    }

    if (detect.photos && !lead.sent_photos) {
      await sendWhatsAppText(from, "Vou te mostrar algumas imagens da casa 👇");

      const banners = [
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
        "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
      ];

      for (const banner of banners) {
        await sendWhatsAppImage(from, banner);
      }

      lead.sent_photos = true;
      lead.last_message = nowISO();
      await upsertLead(lead);
      return res.status(200).json({ ok: true });
    }

    if (detect.address) {
      await sendWhatsAppText(
        from,
        `📍 A Casa Balanço do Mar fica em:

Rua T17, Quadra 26, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000`
      );

      await sendWhatsAppText(
        from,
        `Localização no mapa:
https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318`
      );

      lead.sent_map = true;
      lead.last_message = nowISO();
      await upsertLead(lead);
      return res.status(200).json({ ok: true });
    }

    // ===============================
    // MÍDIA COMPLETA
    // ===============================
    if (/me mostra tudo|me envie tudo|apresentacao completa|apresentação completa/.test(t) && !lead.media_sent) {
      await sendCasaMedia(from);
      lead.media_sent = true;
      lead.sent_photos = true;
      lead.sent_video = true;
      lead.last_message = nowISO();
      await upsertLead(lead);
      return res.status(200).json({ ok: true });
    }

    // ===============================
    // PROPOSTA AUTOMÁTICA
    // ===============================
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
    }

    // ===============================
    // HISTÓRICO
    // ===============================
    lead.history = clampHistory(
      [
        ...(lead.history || []),
        { role: "user", content: userText, at: nowISO() }
      ],
      30
    );

    lead.last_message = nowISO();
    lead = await upsertLead(lead);

    // ===============================
    // IA
    // ===============================
    const reply = await generateReply({ lead, userText });

    // marca fluxo de fechamento
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

    // ===============================
    // ENVIO RESPOSTA
    // ===============================
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
