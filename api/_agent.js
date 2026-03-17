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
// PERFIL DO CLIENTE
// =============================

function detectProfile(text = "") {
  const t = normalizeText(text);

  if (/familia|família|filho|esposa|marido|ferias|descanso/.test(t)) {
    return "familia";
  }

  if (/investimento|renda|retorno|alugar|valorizar/.test(t)) {
    return "investidor";
  }

  return "indefinido";
}

// =============================
// ESCASSEZ REAL
// =============================

const TOTAL_FRACTIONS = 26;

function getRemainingFractions(lead) {
  if (!lead.soldFractions) {
    lead.soldFractions = 9;
  }
  return TOTAL_FRACTIONS - lead.soldFractions;
}
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
// PERFIL DO CLIENTE
// =============================

function detectProfile(text = "") {
  const t = normalizeText(text);

  if (/familia|família|filho|esposa|marido|ferias|descanso/.test(t)) {
    return "familia";
  }

  if (/investimento|renda|retorno|alugar|valorizar/.test(t)) {
    return "investidor";
  }

  return "indefinido";
}

// =============================
// ESCASSEZ REAL
// =============================

const TOTAL_FRACTIONS = 26;

function getRemainingFractions(lead) {
  if (!lead.soldFractions) {
    lead.soldFractions = 9;
  }
  return TOTAL_FRACTIONS - lead.soldFractions;
}
// =============================
// PRODUTO
// =============================

function ensureLeadStructures(lead) {
  lead.buyer = lead.buyer || {};
  lead.product = lead.product || {};

  lead.product.name = "Casa Balanço do Mar";
  lead.product.fraction_value = 59890;
  lead.product.maintenance_fee = 250;
  lead.product.max_guests = 6;

  return lead;
}

// =============================
// 🔥 REGRAS INTERNAS (NOVO)
// =============================

function buildRulesMessage() {
  return `📋 Regras da Casa:

• Máximo de 6 pessoas
• Proibido levar colchões extras
• Não é permitido exceder a capacidade
• Pode levar itens pessoais (cadeira, etc)
• Deve retirar tudo ao sair
• Não deixar objetos pessoais
• Respeitar estrutura da casa
• Proibido retirar itens da casa

Tudo foi pensado para manter padrão alto de conforto.`;
}

// =============================
// 🌴 TURISMO PRADO (NOVO)
// =============================

function buildTourismMessage() {
  return `Prado é um dos lugares mais incríveis da Bahia 🌴

• Praias tranquilas
• Clima leve
• Ambiente familiar

E você ainda fica perto de:

• Corumbau (caribe brasileiro)
• Cumuruxatiba (super charmoso)
• Abrolhos (baleias)

É mais que uma casa…
é um estilo de vida.`;
}
// =============================
// VENDA INTELIGENTE
// =============================

function quickSmartReply({ lead, userText }) {
  const t = normalizeText(userText);
  const remaining = getRemainingFractions(lead);

  if (/valor/.test(t)) {
    return `Hoje está R$ 59.890 à vista.

Mas vou ser direto…

Restam apenas ${remaining} frações.

E isso muda totalmente a escolha de semanas.`;
  }

  if (/como funciona/.test(t)) {
    return `Você garante 2 semanas por ano.

Sem comprar o imóvel inteiro.

E com uso garantido todos os anos.`;
  }

  if (/familia/.test(t)) {
    return `Perfeito pra família.

Casa pronta, piscina, tranquilidade.

Sem depender de aluguel todo ano.`;
  }

  if (/investimento/.test(t)) {
    return `Muita gente entra pelo investimento.

Poucas frações + alta demanda.

Tende a valorizar.`;
  }

  if (/fechar|comprar|quero/.test(t)) {
    return `Excelente decisão 👏

Me envia:

• Nome
• CPF

Que já te coloco dentro hoje.`;
  }

  return null;
}
// =============================
// OPENAI
// =============================

async function callOpenAI({ system, messages }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: system }, ...messages]
    })
  });

  const json = await res.json();
  return json.choices[0].message.content;
}

// =============================
// RESPOSTA FINAL
// =============================

async function generateReply({ lead, userText }) {
  ensureLeadStructures(lead);

  if (!lead.profile) {
    lead.profile = detectProfile(userText);
  }

  if (/comprar|fechar/.test(userText)) {
    alertOwner(lead, userText);
  }

  const fast = quickSmartReply({ lead, userText });
  if (fast) return fast;

  const system = `
Você é um consultor especialista em multipropriedade.

Venda de forma natural, elegante e confiante.

Use escassez, valor e condução leve.
`;

  const messages = [{ role: "user", content: userText }];

  return await callOpenAI({ system, messages });
}

// =============================
// EXPORT
// =============================

module.exports = {
  generateReply,
  sendCasaMedia,
  buildFollowUp,
  buildRecoveryMessage
};
