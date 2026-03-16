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

  // mantém memória da forma de pagamento sem forçar fechamento
  if (/a vista|avista/.test(lower)) {
    lead.purchase.payment_mode = "avista";
  } else if (/parcelado|parcelar|entrada/.test(lower)) {
    lead.purchase.payment_mode = "parcelado";
    if (!lead.purchase.entry_value) lead.purchase.entry_value = 7290;

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
      tx.includes("tem vídeo") ||
      tx.includes("tem um video") ||
      tx.includes("tem um vídeo"),

    photos:
      /(^|\b)(foto|fotos|imagem|imagens)(\b|$)/.test(tx) ||
      tx.includes("tem foto") ||
      tx.includes("tem fotos") ||
      tx.includes("manda foto") ||
      tx.includes("manda fotos"),

  price:
  tx.includes("preco") ||
  tx.includes("preço") ||
  tx.includes("valor") ||
  tx.includes("quanto custa") ||
  tx.includes("qual valor") ||
  tx.includes("valor da fracao") ||
  tx.includes("valor da fração"),

    invest:
      tx.includes("investir") ||
      tx.includes("retorno") ||
      tx.includes("renda") ||
      tx.includes("investimento"),

    visit:
      tx.includes("visitar") ||
      tx.includes("visita"),

    // NEGOCIAÇÃO: não é fechamento
negotiation:
  tx.includes("a vista") ||
  tx.includes("avista") ||
  tx.includes("parcelado") ||
  tx.includes("parcelar") ||
  tx.includes("entrada") ||
  tx.includes("desconto") ||
  tx.includes("beneficio") ||
  tx.includes("benefício") ||
  tx.includes("vantagem") ||
  tx.includes("condicao") ||
  tx.includes("condição") ||
  tx.includes("melhor forma de pagamento") ||
  tx.includes("custo total") ||
  tx.includes("valor") ||
  tx.includes("preco") ||
  tx.includes("preço") ||
  tx.includes("quanto custa") ||
  tx.includes("qual valor"),

    // FECHAMENTO REAL
    buy:
      tx.includes("quero comprar") ||
      tx.includes("quero fechar") ||
      tx.includes("vamos fechar") ||
      tx.includes("reservar") ||
      tx.includes("quero pagar") ||
      tx.includes("como faco pra pagar") ||
      tx.includes("como faço pra pagar") ||
      tx.includes("contrato") ||
      tx.includes("me manda a ficha") ||
      tx.includes("me envie a ficha") ||
      tx.includes("me manda o contrato") ||
      tx.includes("me envie o contrato") ||
      tx.includes("pode seguir") ||
      tx.includes("pode prosseguir") ||
      tx.includes("quero garantir") ||
      tx.includes("vou pagar") ||
      tx.includes("pode emitir"),

    fullMedia:
      tx.includes("me mostra tudo") ||
      tx.includes("me envie tudo") ||
      tx.includes("apresentacao completa") ||
      tx.includes("apresentação completa")
  };
}

// =================================
// DETECÇÃO DE OBJEÇÕES
// =================================
function detectObjection(text = "") {
  const t = normalizeText(text);

  if (t.includes("caro") || t.includes("muito caro")) {
    return `Entendo perfeitamente 😊

Muita gente tem essa primeira impressão.

Mas quando comparam com:

• aluguel de casa de praia  
• custo de hotel todos os anos  
• valorização da região de Prado  

percebem que a fração acaba sendo uma forma muito mais inteligente de garantir férias em família.

Hoje temos apenas 26 frações.

Algumas já foram reservadas.

Por isso muita gente prefere garantir agora e escolher as semanas depois.

O que mais pesou para você quando viu o valor?`;
  }

  if (t.includes("vou pensar")) {
    return `Claro 😊

É uma decisão importante.

Mas deixa eu te perguntar uma coisa rápida:

Você está mais inclinado a:

1️⃣ parcelar  
ou  
2️⃣ aproveitar o valor à vista?

Isso me ajuda a te orientar melhor.`;
  }

  if (t.includes("falar com minha esposa") || t.includes("falar com meu marido")) {
    return `Perfeito 😊

Muitos clientes fazem isso mesmo.

Se quiser, posso te mandar um resumo simples da fração para vocês analisarem juntos.

Assim fica mais fácil decidir.`;
  }

  return null;
}

// =================================
// RESPOSTAS RÁPIDAS DE NEGOCIAÇÃO
// =================================
function buildNegotiationReply(userText, lead) {
  const t = normalizeText(userText);
  const paymentMode = lead?.purchase?.
  const greeting = `Olá! Seja bem-vindo 😊

Eu posso te mostrar como funciona a Casa Balanço do Mar em Prado.

É uma casa de praia em modelo de multipropriedade onde você garante 2 semanas por ano para sua família.

Quer que eu te mostre:

1️⃣ fotos da casa  
2️⃣ vídeo rápido  
3️⃣ valores da fração`;

  await sendWhatsAppText(from, greeting);

  lead.history = clampHistory(
    [
      ...(lead.history || []),
      { role: "assistant", content: greeting, at: nowISO() }
    ],
    30
  );

  lead.last_message = nowISO();
  await upsertLead(lead);

  return res.status(200).json({ ok: true, route: "greeting" });
}
  
if (
t.includes("a vista") ||
t.includes("avista") ||
t.includes("desconto") ||
t.includes("beneficio") ||
t.includes("benefício") ||
t.includes("vantagem") ||
t.includes("valor") ||
t.includes("preco") ||
t.includes("preço")
)
    return `Perfeito 😊

Hoje a fração da Casa Balanço do Mar está nesta condição:

À vista: R$ 59.890

Ou parcelado com entrada de R$ 7.290.

Muita gente compara com alugar casa de praia.

Mas aqui você garante duas semanas por ano em uma casa completa para sua família.

Quem garante à vista entra em vantagens exclusivas:

✔ desconto imediato de R$ 6.000  
✔ prioridade na escolha das semanas  
✔ garantia da fração antes de novas valorizações  

Além disso temos um bônus especial:

✔ 2 diárias extras em finais de semana  
válidas até setembro de 2026.

Outro ponto importante:

A casa possui apenas 26 frações.

Quem entra primeiro tem mais liberdade para escolher suas semanas no calendário anual.

A maioria dos clientes decide entre entrar à vista ou parcelar para diluir o investimento.

Qual dessas duas opções faria mais sentido para você?`;

  if (t.includes("parcelado") || paymentMode === "parcelado") {
  return `Perfeito 😊

Hoje temos três formas de parcelamento:

Entrada: R$ 7.290

36x de R$ 1.600  
48x de R$ 1.200  
60x de R$ 960  

Qual dessas parcelas ficaria mais confortável para você?`;
}
  
if (
  t.includes("acho que sim") ||
  t.includes("quero") ||
  t.includes("vou fechar") ||
  t.includes("vamos fechar") ||
  t.includes("vou pegar") ||
  t.includes("vou comprar")
) {
  return `Perfeito 😊

Então vamos garantir sua fração.

Agora preciso apenas de alguns dados para preencher sua ficha de reserva.

Assim que eu montar, te envio para conferência e assinatura.

Pode me enviar:

• nome completo  
• CPF  
• RG  
• data de nascimento  
• profissão  
• endereço completo`;
}
  if (t.includes("tem desconto a vista") || t.includes("tem desconto à vista")) {
    return `Hoje a condição promocional mais enxuta já é a do à vista 😊

Ela foi pensada justamente para quem quer entrar com o menor custo total e garantir a fração de forma imediata.

Se quiser, eu também posso te mostrar a diferença prática para o parcelado.`;
  }

  if (t.includes("compensa mais a vista") || t.includes("compensa mais à vista")) {
    return `Depende do que pesa mais para você 😊

Se o foco for menor custo total e resolver tudo agora, o à vista costuma ser a escolha mais estratégica.

Se o foco for fluxo de caixa e entrada menor, o parcelado traz mais flexibilidade.`;
  }

  if (t.includes("parcelado")) {
    return `Claro 😊

Hoje temos estas condições de parcelamento:

Entrada: R$ 7.290,00
36x de R$ 1.600,00
48x de R$ 1.200,00
60x de R$ 960,00

Se quiser, eu também posso te dizer qual opção costuma fazer mais sentido para o seu perfil.`;
  }

  if (
    t.includes("a vista") ||
    t.includes("avista") ||
    paymentMode === "avista"
  ) {
    return `Perfeito 😊

À vista você entra pelo menor custo total da operação, elimina parcelas futuras e já garante sua fração imediatamente.

É a opção que normalmente faz mais sentido para quem quer decidir de forma mais estratégica e enxuta.

Você quer que eu te mostre por que muitos clientes preferem o à vista?`;
  }

  return null;
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

  const closingIntentRegex =
    /quero pagar|como faco pra pagar|como faço pra pagar|contrato|quero fechar|quero comprar|vamos fechar|reservar|me manda a ficha|me envie a ficha|me manda o contrato|me envie o contrato|pode seguir|pode prosseguir|quero garantir|vou pagar|pode emitir/;

  if (!closingIntentRegex.test(t)) {
    return false;
  }

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
    // PRIORIDADE MÁXIMA: ENDEREÇO
    // =================================
    
    if (isAddressRequest(userText)) {
  await sendAddress(sendWhatsAppText, from);
  return res.status(200).json({ ok: true, route: "address" });
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

    lead.buyer = lead.buyer || {};
    lead.spouse = lead.spouse || {};
    lead.purchase = lead.purchase || {};

    if (!lead.buyer.phone) {
      lead.buyer.phone = from;
    }

    if (!lead.name && profileName) {
      lead.name = profileName;
    }

    // =================================
    // DOCUMENTO PDF
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
    // REMOVIDO OCR/TESSERACT PARA NÃO QUEBRAR NO VERCEL
    // =================================
    if (type === "image" && imageId) {
      await sendWhatsAppText(
        from,
        "Recebi sua imagem 😊\n\nSe for ficha ou documento, pode me enviar em PDF ou escrever os dados aqui que eu preencho para você."
      );
      return res.status(200).json({ ok: true, route: "image-received" });
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
    // ENDEREÇO APÓS PDF / ÁUDIO
    // =================================
    if (isAddressRequest(userText)) {
      await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
      await sendWhatsAppText(from, CASA_MAP_TEXT);

      lead.sent_map = true;
      lead.last_message = nowISO();
      await upsertLead(lead);

      return res.status(200).json({ ok: true, route: "address-after-media" });
    }

    // =================================
    // EXTRAÇÃO GERAL
    // =================================
    lead = applyManualFieldExtraction(lead, userText);

    if (!userText || !userText.trim()) {
      return res.status(200).json({ ok: true, route: "empty-message" });
    }

    const t = normalizeText(userText);
    // =================================
// DETECÇÃO DE SAUDAÇÃO
// =================================
if (
  t === "oi" ||
  t === "ola" ||
  t === "olá" ||
  t === "opa" ||
  t === "bom dia" ||
  t === "boa tarde" ||
  t === "boa noite"
) {
  const greeting = `Olá! Seja bem-vindo 😊

Eu posso te mostrar rapidamente:

• fotos da casa  
• vídeo da casa  
• valor da fração  
• localização em Prado

O que você gostaria de ver primeiro?`;

  await sendWhatsAppText(from, greeting);

  lead.history = clampHistory(
    [
      ...(lead.history || []),
      { role: "assistant", content: greeting, at: nowISO() }
    ],
    30
  );

  lead.last_message = nowISO();
  await upsertLead(lead);

  return res.status(200).json({ ok: true, route: "greeting" });
}
    const detect = detectIntent(t);

    // verificar objeção do cliente
const objectionReply = detectObjection(userText);

if (objectionReply) {
  await sendWhatsAppText(from, objectionReply);
  return res.status(200).json({ ok: true, route: "objection" });
}
    
    // salvar semanas desejadas pelo cliente
const desiredWeeks = detectDesiredWeeks(userText);

if (desiredWeeks.length) {
  lead.desired_weeks = Array.from(
    new Set([...(lead.desired_weeks || []), ...desiredWeeks])
  );
}

    if (detect.price) lead.score = (lead.score || 0) + 2;
    if (detect.invest) lead.score = (lead.score || 0) + 3;
    if (detect.negotiation) lead.score = (lead.score || 0) + 2;
    if (detect.buy) lead.score = (lead.score || 0) + 6;

    // classificação do lead
if (lead.score >= 12) {
  lead.rank = "comprador";
} else if (lead.score >= 8) {
  lead.rank = "quente";
} else if (lead.score >= 4) {
  lead.rank = "interessado";
} else if (lead.score >= 2) {
  lead.rank = "curioso";
} else {
  lead.rank = "frio";
}
    // estágio mais inteligente
    if (detect.buy) {
      lead.stage = "fechamento";
    } else if (detect.negotiation) {
      lead.stage = "negociando";
    } else if (lead.score >= 3) {
      lead.stage = "interessado";
    } else if (lead.score >= 1) {
      lead.stage = "curioso";
    } else {
      lead.stage = lead.stage || "novo";
    }

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
    // FLUXO DIRETO DE DOCUMENTO / ÁUDIO
    // =================================
    if (sourceLabel === "documento" || sourceLabel === "áudio") {
      const handledDocProgress = await handleDocumentDrivenProgress({
        from,
        lead,
        sourceLabel
      });

      if (handledDocProgress) {
        return res.status(200).json({ ok: true, route: "document-progress" });
      }
    }

    // =================================
    // FLUXOS DIRETOS DE MÍDIA
    // =================================
    const handledMedia = await handleDirectMediaIntent({ from, lead, detect });
    if (handledMedia) {
      return res.status(200).json({ ok: true, route: "media" });
    }

    // =================================
    // NEGOCIAÇÃO DIRETA
    // =================================
    if (detect.negotiation && !detect.buy) {
      const negotiationReply = buildNegotiationReply(userText, lead);

      if (negotiationReply) {
        lead.history = clampHistory(
          [
            ...(lead.history || []),
            { role: "assistant", content: negotiationReply, at: nowISO() }
          ],
          30
        );

        lead.last_message = nowISO();
        await upsertLead(lead);

        const parts = negotiationReply.split("\n\n");
        for (const part of parts) {
          if (part.trim()) {
            await sendWhatsAppText(from, part.trim());
          }
        }

        return res.status(200).json({ ok: true, route: "negotiation" });
      }
    }

    // =================================
    // FLUXO DIRETO DE FECHAMENTO
    // =================================
    const handledClosing = await handleDirectClosing({ from, lead, t });
    if (handledClosing) {
      return res.status(200).json({ ok: true, route: "closing" });
    }

    // =================================
    // PROPOSTA AUTOMÁTICA
    // Só quando houver sinal claro de compra
    // =================================
    if (detect.buy && !lead.proposal_sent) {
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

      return res.status(200).json({ ok: true, route: "proposal" });
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

    // preparar follow-up automático
lead.followup = lead.followup || {};
lead.followup.last_interaction = nowISO();

    const parts = reply.split("\n\n");
    for (const part of parts) {
      if (part.trim()) {
        await sendWhatsAppText(from, part.trim());
      }
    }

    return res.status(200).json({ ok: true, route: "ai" });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);

    return res.status(200).json({
      ok: false,
      error: err?.message
    });
  }
};
