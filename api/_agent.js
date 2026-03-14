const { sendWhatsAppImage, sendWhatsAppText, sendWhatsAppVideo } = require("./_wa");

// =============================
// ESTÁGIOS DO FUNIL
// =============================

const stages = {
  novo: 0,
  curioso: 1,
  interessado: 2,
  avaliando: 3,
  negociando: 4,
  decisao: 5,
  fechamento: 6
};

function nowISO() {
  return new Date().toISOString();
}

function normalizeText(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function clampHistory(history, max = 20) {
  const h = Array.isArray(history) ? history : [];
  return h.slice(-max);
}

// =============================
// DETECÇÕES
// =============================

function detectStage(text, lead) {
  const t = normalizeText(text);

  if (/comprar|fechar|reservar|pagar|contrato|assin|comprovante/.test(t)) {
    return "fechamento";
  }

  if (/parcelado|entrada|valor|preco|preço|avista|a vista/.test(t)) {
    return "negociando";
  }

  if (/como funciona|multipropriedade|fracao|fração/.test(t)) {
    return "avaliando";
  }

  if (/foto|fotos|imagem|imagens|video|vídeo|tour|mostrar|ver/.test(t)) {
    return "interessado";
  }

  if (/oi|ola|bom dia|boa tarde|boa noite/.test(t)) {
    return "curioso";
  }

  return lead.stage || "novo";
}

function detectPurchaseIntent(text) {
  const t = normalizeText(text);
  return /\b(comprar|fechar|reservar|pagar|contrato|garantir|a vista|avista|parcelado|assinar)\b/.test(t);
}

function detectDocument(text) {
  const t = normalizeText(text);
  return /documento|rg|cpf|cnh|comprovante|assinad/.test(t);
}

function detectMediaInterest(text) {
  const t = normalizeText(text);
  return /\b(foto|fotos|imagem|imagens|video|vídeo|tour|mostrar|ver a casa|me mostra)\b/.test(t);
}

function isGreeting(txt) {
  const t = normalizeText(txt);
  return ["oi", "ola", "bom dia", "boa tarde", "boa noite"].includes(t);
}

// =============================
// MÍDIA
// =============================

const casaMedia = {
  banners: [
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
  ],
  video:
    "https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4"
};

async function sendCasaMedia(phone) {
  await sendWhatsAppText(phone, "Vou te mostrar algumas imagens da Casa Balanço do Mar 😊");

  for (const banner of casaMedia.banners) {
    await sendWhatsAppImage(phone, banner);
  }

  await sendWhatsAppText(phone, "E aqui um vídeo rápido da casa 👇");
  await sendWhatsAppVideo(phone, casaMedia.video);
}

// =============================
// ALERTA LEAD QUENTE
// =============================

async function alertOwner(lead, text) {
  try {
    const ownerPhone = process.env.OWNER_PHONE;
    if (!ownerPhone) return;

    const msg = `🔥 LEAD QUENTE

Cliente: ${lead?.buyer?.full_name || lead.name || "Sem nome"}
Telefone: ${lead.phone}

Mensagem:
${text}`;

    await fetch(process.env.WHATSAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        to: ownerPhone,
        type: "text",
        text: { body: msg }
      })
    });
  } catch (err) {
    console.error("alertOwner error:", err?.message || err);
  }
}

// =============================
// ESTRUTURA DO LEAD
// =============================

function ensureLeadStructures(lead) {
  lead.buyer = lead.buyer || {};
  lead.spouse = lead.spouse || {};
  lead.purchase = lead.purchase || {};
  lead.product = lead.product || {};

  lead.product.name = lead.product.name || "Casa Balanço do Mar";
  lead.product.fraction_value = lead.product.fraction_value || 59890;
  lead.product.maintenance_fee = lead.product.maintenance_fee || 250;
  lead.product.address =
    lead.product.address ||
    "Rua T17, Quadra 26, Lote 02B, Bairro Basevi, Prado – Bahia, CEP 45980-000";
  lead.product.map_link =
    lead.product.map_link ||
    "https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318";
  lead.product.max_guests = lead.product.max_guests || 6;

  return lead;
}

// =============================
// CAMPOS FALTANTES
// =============================

function spouseIsRequired(lead) {
  const marital = normalizeText(lead?.buyer?.marital_status || "");
  return /casado|casada|uniao estavel|união estável|companheiro|companheira/.test(marital);
}

function getMissingBuyerFields(lead) {
  const b = lead.buyer || {};
  const missing = [];

  if (!b.full_name) missing.push("nome completo");
  if (!b.cpf) missing.push("CPF");
  if (!b.rg) missing.push("RG");
  if (!b.birth_date) missing.push("data de nascimento");
  if (!b.marital_status) missing.push("estado civil");
  if (!b.profession) missing.push("profissão");
  if (!b.street) missing.push("endereço completo");
  if (!b.city) missing.push("cidade");
  if (!b.state) missing.push("estado");
  if (!b.cep) missing.push("CEP");
  if (!b.phone) missing.push("telefone");
  if (!b.email) missing.push("e-mail");

  return missing;
}

function getMissingSpouseFields(lead) {
  if (!spouseIsRequired(lead)) return [];

  const s = lead.spouse || {};
  const missing = [];

  if (!s.full_name) missing.push("nome completo do cônjuge");
  if (!s.cpf) missing.push("CPF do cônjuge");
  if (!s.rg) missing.push("RG do cônjuge");
  if (!s.marital_status) missing.push("estado civil do cônjuge");
  if (!s.property_regime) missing.push("regime de bens");

  return missing;
}

// =============================
// UTILIDADES
// =============================

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function buildPaymentDataMessage() {
  return `💳 DADOS PARA PAGAMENTO

Banco: 336 - Banco C6 S.A.
Agência: 0001
Conta corrente: 25014352-6
CNPJ: 48.180.148/0001-81
Nome: NAURU BEACH RESIDENCE & HOTEL
Chave Pix: 48.180.148/0001-81`;
}

function buildMissingDataMessage(lead) {
  const missing = [...getMissingBuyerFields(lead), ...getMissingSpouseFields(lead)];

  if (!missing.length) return null;

  return `Perfeito! Para eu preencher sua ficha completa sem erro, preciso só destes dados:

• ${missing.join("\n• ")}

Pode me enviar por aqui mesmo.`;
}

function buildContractFormText(lead) {
  ensureLeadStructures(lead);

  const buyer = lead.buyer || {};
  const spouse = lead.spouse || {};
  const purchase = lead.purchase || {};
  const product = lead.product || {};

  let paymentText = "A definir";

  if (purchase.payment_mode === "avista") {
    paymentText = "À vista";
  }

  if (purchase.payment_mode === "parcelado") {
    paymentText = `Parcelado | Entrada: R$ ${formatMoney(purchase.entry_value || 7290)} | ${purchase.installments || "-"}x de R$ ${formatMoney(purchase.installment_value || 0)}`;
  }

  return `📄 FICHA DE RESERVA – CASA BALANÇO DO MAR

I – DADOS DO COMPRADOR
Nome completo: ${buyer.full_name || "-"}
CPF: ${buyer.cpf || "-"}
RG: ${buyer.rg || "-"}
Data de nascimento: ${buyer.birth_date || "-"}
Estado civil: ${buyer.marital_status || "-"}
Profissão: ${buyer.profession || "-"}
Endereço: ${buyer.street || "-"}
Cidade: ${buyer.city || "-"}
Estado: ${buyer.state || "-"}
CEP: ${buyer.cep || "-"}
Telefone: ${buyer.phone || lead.phone || "-"}
E-mail: ${buyer.email || "-"}

II – DADOS DO CÔNJUGE
Nome completo: ${spouse.full_name || "-"}
CPF: ${spouse.cpf || "-"}
RG: ${spouse.rg || "-"}
Estado civil: ${spouse.marital_status || "-"}
Regime de bens: ${spouse.property_regime || "-"}

III – EMPREENDIMENTO
${product.name}

IV – IMÓVEL
${product.address}

V – DIREITO DE USO
• 1 semana alta temporada
• 1 semana baixa temporada
• Capacidade máxima: até ${product.max_guests} hóspedes

VI – VALORES
Valor promocional à vista: R$ ${formatMoney(product.fraction_value)}
Taxa de manutenção: R$ ${formatMoney(product.maintenance_fee)}/mês
Forma de pagamento: ${paymentText}

VII – ORIENTAÇÃO FINAL
Confira os dados, assine e me devolva esta ficha junto com o comprovante de pagamento para confirmarmos sua fração.`;
}

// =============================
// EXTRAÇÃO DE DADOS
// =============================

function mergeBuyerDataFromText(lead, text = "") {
  ensureLeadStructures(lead);

  const src = text || "";

  const cpf = src.match(/\b\d{3}\.?\d{3}\.?\d{3}\-?\d{2}\b/);
  if (cpf && !lead.buyer.cpf) lead.buyer.cpf = cpf[0];

  const email = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email && !lead.buyer.email) lead.buyer.email = email[0];

  const cep = src.match(/\b\d{5}\-?\d{3}\b/);
  if (cep && !lead.buyer.cep) lead.buyer.cep = cep[0];

  const birth = src.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  if (birth && !lead.buyer.birth_date) lead.buyer.birth_date = birth[0];

  return lead;
}

// =============================
// FOLLOWUP / RECOVERY
// =============================

function buildFollowUp(lead) {
  const stage = lead.stage;

  if (stage === "curioso") {
    return "Você chegou a ver as imagens da Casa Balanço do Mar?";
  }

  if (stage === "interessado") {
    return "Queria saber se você conseguiu ver o vídeo da casa 😊";
  }

  if (stage === "avaliando") {
    return "Muita gente leva um tempinho para entender bem como funciona a multipropriedade. Quer que eu te explique de forma simples?";
  }

  if (stage === "negociando") {
    return "Você chegou a pensar se faria mais sentido à vista ou parcelado?";
  }

  if (stage === "decisao") {
    return "Se fizer sentido para você, posso te mostrar como garantir sua fração.";
  }

  if (stage === "fechamento") {
    return "Se quiser, eu já posso te enviar a ficha preenchida para conferência e assinatura.";
  }

  return "Oi! Só passando para saber se você conseguiu ver as informações da Casa Balanço do Mar 😊";
}

function buildRecoveryMessage() {
  const msgs = [
    "Muita gente começa apenas curiosa e depois percebe que a multipropriedade resolve férias todos os anos.",
    "Você chegou a entender como funciona a fração da Casa Balanço do Mar?",
    "Se quiser posso te mostrar novamente as imagens da casa.",
    "Se fizer sentido para você, posso retomar exatamente de onde paramos 😊"
  ];

  return msgs[Math.floor(Math.random() * msgs.length)];
}

// =============================
// PROMPT DO CONSULTOR
// =============================

function buildSystemPrompt(lead) {
  ensureLeadStructures(lead);

  const product = lead.product || {};

  return `
IDENTIDADE DO CONSULTOR

Você é o consultor oficial da Casa Balanço do Mar.

Converse como um consultor humano experiente.
Nunca diga que é IA.
Nunca pareça robô.

OBJETIVO

Seu papel é:
• gerar conexão
• despertar desejo
• explicar com clareza
• tratar objeções
• conduzir até a decisão de compra

TOM

Seu tom deve ser:
• humano
• elegante
• consultivo
• seguro
• amigável

PERSONALIDADE COMERCIAL

Seu comportamento segue princípios de:
• Como Fazer Amigos e Influenciar Pessoas
• Quem Pensa Enriquece
• Os Segredos da Mente Milionária

Você deve:
• demonstrar interesse genuíno
• conduzir com naturalidade
• gerar valor antes de pedir decisão
• usar visualização
• usar prova social sem inventar números
• usar escassez de forma sutil
• responder com confiança

Nunca:
• pressione em excesso
• pareça insistente
• invente informações
• responda como suporte frio

REGRAS DE COMUNICAÇÃO

Mensagens em estilo WhatsApp.
Frases curtas.
Máximo 3 linhas por mensagem.
No máximo 1 pergunta por mensagem.
Sempre explique e conduza.

VERDADE E DADOS FIXOS

Nunca invente informações.

Você nunca deve dizer que não sabe:
• endereço
• localização
• mapa
• valor
• formas de pagamento
• taxa de manutenção
• estrutura da casa

Use sempre os dados fixos do sistema.

DADOS DO PROJETO

Empreendimento:
${product.name}

Endereço:
${product.address}

Mapa:
${product.map_link}

Estrutura:
• 2 quartos (1 suíte)
• sala integrada
• cozinha americana planejada
• área gourmet
• churrasqueira
• piscina
• mesa de madeira maciça
• geladeira inox
• cooktop
• depurador
• ar condicionado
• decoração estilo praia

Capacidade máxima:
até ${product.max_guests} hóspedes

Multipropriedade:
• 26 frações
• 2 semanas por ano
• 1 alta temporada
• 1 baixa temporada

Valor promocional à vista:
R$ ${formatMoney(product.fraction_value)}

Parcelado:
Entrada de R$ 7.290,00
36x de R$ 1.600,00
48x de R$ 1.200,00
60x de R$ 960,00

Taxa de manutenção:
R$ ${formatMoney(product.maintenance_fee)}/mês

SEGURANÇA JURÍDICA

A multipropriedade é regulamentada pela Lei 13.777/2018.

OBJEÇÕES

Se o cliente disser que prefere alugar:
explique que na multipropriedade ele passa a ter direito imobiliário vinculado ao imóvel, previsibilidade de uso e possibilidade de patrimônio.

Se perguntar "e se eu não usar?":
explique que pode usar, trocar semanas, locar sua semana ou organizar de outra forma.

Se perguntar sobre revenda:
explique que a fração pode ser vendida para outro interessado.

Se perguntar se é seguro:
explique que a multipropriedade é regulamentada pela Lei 13.777/2018.

Se perguntar se precisa visitar antes:
explique que a visita é opcional. Algumas pessoas visitam, outras fecham após conhecer a apresentação e a estrutura.

PROVA SOCIAL E ESCASSEZ

Você pode mencionar naturalmente:
"Muitas famílias compram multipropriedade para garantir férias todos os anos."

Você pode mencionar naturalmente que existem apenas 26 frações.

Nunca invente quantas já foram vendidas.

VISUALIZAÇÃO

Ajude a pessoa a imaginar a experiência.

Exemplo:
"Imagine chegar em Prado e já ter seu período garantido em uma casa completa para curtir com a família."

MEMÓRIA DO FECHAMENTO

Considere sempre os dados já salvos do cliente e não peça novamente o que já foi enviado.

Se faltarem dados, peça apenas o que falta.

Se já estiver tudo completo, conduza para assinatura e pagamento.

OBJETIVO FINAL

Levar o cliente a perceber que a fração é uma decisão inteligente para:
• férias em família
• investimento
• patrimônio
`.trim();
}

// =============================
// OPENAI
// =============================

async function callOpenAI({ system, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) throw new Error("Missing env OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      messages: [{ role: "system", content: system }, ...messages]
    })
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${JSON.stringify(json)}`);
  }

  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI empty response");

  return text;
}

// =============================
// RESPOSTAS RÁPIDAS
// =============================

function quickSmartReply({ lead, userText }) {
  const t = normalizeText(userText);

  if (!lead.name && userText && userText.length <= 24 && !isGreeting(userText) && !/@/.test(userText)) {
    return `Prazer, ${userText}! 😊

Você imagina usar mais a Casa Balanço do Mar para férias com a família ou também como investimento?`;
  }

  if (isGreeting(userText) && lead.name) {
    return `Que bom falar com você, ${lead.name}! 😊

Você quer conhecer primeiro a casa ou entender como funciona a multipropriedade?`;
  }

  if (isGreeting(userText) && !lead.name) {
    return `Oi! 😊 Que bom ter você por aqui.

Como posso te chamar?`;
  }

  if (/endereco|endereço|onde fica|localizacao|localização|mapa/.test(t)) {
    return `📍 A Casa Balanço do Mar fica em:

${lead.product.address}

Localização no mapa:
${lead.product.map_link}`;
  }

  if (/como funciona|multipropriedade|fracao|fração/.test(t)) {
    return `A multipropriedade funciona assim:

Você adquire uma fração da casa e garante 2 semanas por ano.

Uma na alta e uma na baixa temporada.

Você imagina usar mais para férias com a família ou também como investimento?`;
  }

  if (/quanto custa|valor|preco|preço/.test(t)) {
    return `Hoje a condição está assim:

À vista: R$ ${formatMoney(lead.product.fraction_value)}

Ou parcelado com entrada de R$ 7.290,00.

Quer que eu te mostre as opções de parcelamento?`;
  }

  if (/prefiro alugar/.test(t)) {
    return `Faz sentido pensar nisso 😊

A diferença é que aqui você não fica só no uso temporário.

Na multipropriedade você passa a ter um direito imobiliário vinculado ao imóvel.

Você olha mais pelo uso ou pelo patrimônio?`;
  }

  if (/e se eu nao usar|e se eu não usar/.test(t)) {
    return `Se em algum período você não quiser usar, existem alternativas 😊

Você pode trocar semanas, locar sua semana ou reorganizar seu calendário.

Quer que eu te explique isso de forma simples?`;
  }

  if (/posso revender|tem revenda|revender/.test(t)) {
    return `Sim 😊

A fração pode ser vendida para outro interessado.

Muita gente inclusive vê isso como patrimônio e flexibilidade.`;
  }

  if (/seguro|lei|juridico|jurídico/.test(t)) {
    return `Sim, existe segurança jurídica 😊

A multipropriedade é regulamentada pela Lei 13.777/2018.

Isso dá base legal ao modelo e mais tranquilidade para quem compra.`;
  }

  if (/visitar|visita|conhecer antes/.test(t)) {
    return `A visita é opcional 😊

Algumas pessoas preferem visitar primeiro.

Outras fecham após conhecer a apresentação, a casa e a estrutura do projeto.`;
  }

  if (/familia|família/.test(t)) {
    return `Perfeito 😊

Usar com a família é exatamente o que muita gente busca.

Normalmente quantas pessoas viajariam com você com mais frequência?`;
  }

  if (/como faco pra pagar|como faço pra pagar|quero pagar|vamos pagar/.test(t)) {
    const missingMsg = buildMissingDataMessage(lead);

    if (missingMsg) {
      return `Perfeito! Vou te passar o processo completo para garantir sua fração 😊

1. Eu preencho sua ficha
2. Te envio para conferência e assinatura
3. Você me devolve assinada
4. Me envia junto o comprovante de pagamento
5. Confirmamos sua fração

${missingMsg}`;
    }

    return `${buildContractFormText(lead)}

Perfeito! Estou te enviando a ficha preenchida.

Confira, assine e me devolva assinada junto com o comprovante de pagamento para confirmarmos sua fração.

${buildPaymentDataMessage()}`;
  }

  return null;
}

// =============================
// MENSAGENS PARA IA
// =============================

function buildMessagesForAI(lead, userText) {
  const history = clampHistory(lead.history, 16);
  const messages = [];

  messages.push({
    role: "system",
    content: `ESTÁGIO ATUAL DO CLIENTE: ${lead.stage}`
  });

  messages.push({
    role: "system",
    content: `DADOS JÁ SALVOS DO CLIENTE:

Nome: ${lead.buyer?.full_name || lead.name || "-"}
CPF: ${lead.buyer?.cpf || "-"}
RG: ${lead.buyer?.rg || "-"}
Data de nascimento: ${lead.buyer?.birth_date || "-"}
Estado civil: ${lead.buyer?.marital_status || "-"}
Profissão: ${lead.buyer?.profession || "-"}
Endereço: ${lead.buyer?.street || "-"}
Cidade: ${lead.buyer?.city || "-"}
Estado: ${lead.buyer?.state || "-"}
CEP: ${lead.buyer?.cep || "-"}
Telefone: ${lead.buyer?.phone || lead.phone || "-"}
E-mail: ${lead.buyer?.email || "-"}

DADOS DO CÔNJUGE:
Nome: ${lead.spouse?.full_name || "-"}
CPF: ${lead.spouse?.cpf || "-"}
RG: ${lead.spouse?.rg || "-"}
Estado civil: ${lead.spouse?.marital_status || "-"}
Regime de bens: ${lead.spouse?.property_regime || "-"}

FORMA DE PAGAMENTO:
Modo: ${lead.purchase?.payment_mode || "-"}
Entrada: ${lead.purchase?.entry_value || "-"}
Parcelas: ${lead.purchase?.installments || "-"}
Valor parcela: ${lead.purchase?.installment_value || "-"}`
  });

  if (lead.stage === "avaliando" || lead.stage === "interessado") {
    messages.push({
      role: "system",
      content: "Lembre de forma natural que a Casa Balanço do Mar possui apenas 26 frações."
    });
  }

  for (const item of history) {
    if (item?.role && item?.content) {
      messages.push({
        role: item.role,
        content: item.content
      });
    }
  }

  messages.push({
    role: "user",
    content: userText
  });

  return messages;
}

// =============================
// GERAÇÃO DE RESPOSTA
// =============================

async function generateReply({ lead, userText }) {
  ensureLeadStructures(lead);

  const t = normalizeText(userText);
  const detectedStage = detectStage(userText, lead);

  if (stages[detectedStage] > stages[lead.stage || "novo"]) {
    lead.stage = detectedStage;
  }

  if (detectPurchaseIntent(userText) || lead.stage === "fechamento") {
    alertOwner(lead, userText).catch(() => {});
  }

  const fast = quickSmartReply({ lead, userText });
  if (fast) return fast;

  const missingMsg = buildMissingDataMessage(lead);

  if (/quero comprar|quero fechar|reservar|contrato/.test(t) && missingMsg) {
    return `Perfeito! Vamos seguir com sua reserva 😊

${missingMsg}`;
  }

  if (/quero comprar|quero fechar|reservar|contrato/.test(t) && !missingMsg) {
    return `${buildContractFormText(lead)}

Perfeito! Estou te enviando a ficha preenchida.

Confira, assine e me devolva assinada junto com o comprovante de pagamento para confirmarmos sua fração.

${buildPaymentDataMessage()}`;
  }

  if (detectDocument(userText) && !missingMsg) {
    return `${buildContractFormText(lead)}

Perfeito! Recebi seus dados 😊

Confira, assine e me devolva a ficha assinada junto com o comprovante de pagamento para confirmarmos sua fração.

${buildPaymentDataMessage()}`;
  }

  if (detectDocument(userText) && missingMsg) {
    return `Perfeito! Recebi parte dos seus dados 😊

${missingMsg}`;
  }

  const system = buildSystemPrompt(lead);
  const messages = buildMessagesForAI(lead, userText);
  const reply = await callOpenAI({ system, messages });

  return reply;
}

module.exports = {
  stages,
  casaMedia,
  nowISO,
  normalizeText,
  detectStage,
  detectPurchaseIntent,
  detectDocument,
  detectMediaInterest,
  buildFollowUp,
  buildRecoveryMessage,
  alertOwner,
  isGreeting,
  clampHistory,
  sendCasaMedia,
  ensureLeadStructures,
  spouseIsRequired,
  getMissingBuyerFields,
  getMissingSpouseFields,
  buildPaymentDataMessage,
  buildMissingDataMessage,
  buildContractFormText,
  mergeBuyerDataFromText,
  generateReply
};
