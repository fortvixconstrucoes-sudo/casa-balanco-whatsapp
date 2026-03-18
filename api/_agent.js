// =================================
// CORE DO AGENT (VERSÃO FINAL)
// =================================

// =============================
// UTILIDADES
// =============================

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

function clampHistory(history, max = 30) {
  return (history || []).slice(-max);
}

// =============================
// ESTÁGIOS
// =============================

const stages = {
  lead: 0,
  curioso: 1,
  interessado: 2,
  apresentacao: 3,
  negociacao: 4,
  fechamento: 5,
  cliente: 6
};

// =============================
// DETECÇÃO DE ESTÁGIO (INTELIGENTE)
// =============================

function detectStage(text, lead) {
  const t = normalizeText(text);

  if (
    t.includes("comprar") ||
    t.includes("fechar") ||
    t.includes("reservar") ||
    t.includes("quero") ||
    t.includes("valor")
  ) {
    return "fechamento";
  }

  if (
    t.includes("investir") ||
    t.includes("retorno") ||
    t.includes("renda")
  ) {
    return "interessado";
  }

  if (
    t.includes("como funciona") ||
    t.includes("explica") ||
    t.includes("o que é")
  ) {
    return "apresentacao";
  }

  return lead.stage || "lead";
}

// =============================
// SISTEMA DE MEMÓRIA
// =============================

function updateLeadState(lead, text) {
  const stage = detectStage(text, lead);

  return {
    ...lead,
    stage,
    last_message: nowISO()
  };
}

// =============================
// FECHAMENTO AGRESSIVO
// =============================

function buildClosingResponse(lead) {
  const name = lead?.buyer?.full_name?.split(" ")[0] || "";

  return `${name ? name + ", " : ""}vou ser direto com você 😊

Essa oportunidade ainda está em fase inicial.

Isso significa:

• valor abaixo do mercado  
• maior potencial de valorização  
• escolha das melhores semanas  

💰 Hoje você entra com:

R$ 59.890 à vista  
ou entrada de R$ 7.290 + parcelas  

📅 2 semanas por ano garantidas

👉 As frações estão sendo vendidas e isso tende a subir.

Se fizer sentido, já posso garantir a sua agora.

Prefere à vista ou parcelado?`;
}

// =============================
// QUEBRA DE OBJEÇÃO
// =============================

function handleObjection(text) {
  const t = normalizeText(text);

  if (t.includes("caro")) {
    return `Entendo 😊

Mas hoje você entra abaixo do valor futuro.

Quem entra agora é quem mais ganha valorização.`;
  }

  if (t.includes("pensar")) {
    return `Perfeito.

Mas sendo direto com você:

as frações estão sendo vendidas e o valor tende a subir.

Se fizer sentido, posso segurar sua condição agora.`;
  }

  if (t.includes("depois")) {
    return `Pode deixar.

Mas só um ponto importante:

quem entra primeiro escolhe melhor as semanas.

Isso faz muita diferença depois.`;
  }

  return null;
}
// =============================
// PROMPT PRINCIPAL (EVOLUÍDO)
// =============================

function buildSystemPrompt(lead) {
  return `

Você é um consultor de alto padrão, especialista em vendas imobiliárias e multipropriedade.

Você NÃO é um atendente.
Você é um vendedor experiente, elegante e altamente persuasivo.

Seu objetivo:
Converter o cliente em comprador.

------------------------------------

COMPORTAMENTO

• Fale como humano
• Seja direto, mas elegante
• Nunca pareça robô
• Nunca use textos longos
• Use frases curtas
• Use quebra de linha
• Conduza sempre

------------------------------------

ESTRATÉGIA DE VENDA

Você usa:

• autoridade
• escassez
• prova social
• clareza
• condução leve

Nunca empurre agressivo.
Mas também nunca deixe o cliente solto.

------------------------------------

REGRAS DE OURO

• Sempre avance a conversa
• Sempre faça o cliente dar o próximo passo
• Nunca perca controle
• Nunca reinicie conversa
• Nunca responda genérico

------------------------------------

SOBRE O PRODUTO

Casa Balanço do Mar – Prado/BA

Multipropriedade:

• 26 frações
• 2 semanas por ano
• 1 alta + 1 baixa temporada
• sistema rotativo

Casa completa:

• 2 quartos (1 suíte)
• piscina
• área gourmet
• ar condicionado
• equipada

Capacidade máxima: 6 pessoas

Regras importantes:

• não pode levar colchão extra
• não pode exceder 6 pessoas
• não pode retirar itens da casa

------------------------------------

VALOR

R$ 65.890

À vista: R$ 59.890

------------------------------------

DIFERENCIAL

Não é hospedagem.

É patrimônio.

É ter uma casa na praia com custo inteligente.

------------------------------------

LOCAL

Prado – Bahia

• praias lindas
• turismo crescente
• alta valorização
• Abrolhos
• ecoturismo

------------------------------------

FECHAMENTO

Quando cliente demonstrar interesse:

• conduza para decisão
• gere urgência real
• mostre que está acabando
• leve para pagamento

------------------------------------

IMPORTANTE

Você não responde.

Você conduz.

Você não explica demais.

Você vende.

`;
}
// =============================
// GERAÇÃO DE RESPOSTA IA
// =============================

async function callOpenAI({ messages, system }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        { role: "system", content: system },
        ...messages
      ]
    })
  });

  const data = await response.json();

  return data?.choices?.[0]?.message?.content || "";
}
// =============================
// RESPOSTA RÁPIDA INTELIGENTE (ANTI ROBÔ)
// =============================

function quickSmartReply(text) {
  const t = normalizeText(text);

  if (t.includes("como funciona")) {
    return `Funciona assim 😊

Você garante 2 semanas por ano.

Uma alta e uma baixa temporada.

É tipo ter uma casa na praia sem pagar tudo sozinho.

Você usaria mais com família ou investimento?`;
  }

  if (t.includes("onde fica") || t.includes("localizacao")) {
    return `Fica em Prado – Bahia 😊

Região linda, turística e em crescimento.

Se quiser te mando a localização exata no mapa.`;
  }

  if (t.includes("valor") || t.includes("preco")) {
    return buildClosingResponse({});
  }

  if (t.includes("foto")) {
    return `Vou te mostrar as imagens da casa 👇`;
  }

  if (t.includes("video")) {
    return `Vou te mostrar um vídeo rápido da casa 👇`;
  }

  return null;
}

// =============================
// DETECÇÃO DE INTENÇÃO
// =============================

function detectIntent(text) {
  const t = normalizeText(text);

  return {
    isPrice: t.includes("valor") || t.includes("preco"),
    isInterest:
      t.includes("quero") ||
      t.includes("interesse") ||
      t.includes("gostei"),
    isDoubt:
      t.includes("como") ||
      t.includes("funciona") ||
      t.includes("explica"),
    isMedia:
      t.includes("foto") || t.includes("video"),
    isBuy:
      t.includes("comprar") ||
      t.includes("fechar") ||
      t.includes("reservar")
  };
}

// =============================
// MOTOR PRINCIPAL DE RESPOSTA
// =============================

async function generateReply({ lead, userText }) {
  const system = buildSystemPrompt(lead);

  const history = (lead.history || []).map(h => ({
    role: h.role,
    content: h.content
  }));

  const messages = [
    ...history,
    {
      role: "user",
      content: userText
    }
  ];

  const response = await callOpenAI({
    system,
    messages
  });

  return response;
}

// =============================
// DADOS DE PAGAMENTO
// =============================

function buildPaymentDataMessage() {
  return `Perfeito 😊

Segue os dados para pagamento:

Banco: 336 - C6 Bank  
Agência: 0001  
Conta: 25014352-6  
CNPJ: 48.180.148/0001-81  
Nome: Nauru Beach Residence & Hotel  

PIX: 48.180.148/0001-81  

Assim que fizer o pagamento, me envie o comprovante para confirmarmos sua fração.`;
}

// =============================
// FICHA DE CONTRATO
// =============================

function buildContractFormText(lead) {
  const b = lead.buyer || {};

  return `📄 FICHA DE CADASTRO

Nome: ${b.full_name || ""}
CPF: ${b.cpf || ""}
RG: ${b.rg || ""}
Telefone: ${b.phone || ""}
Email: ${b.email || ""}
Endereço: ${b.street || ""}

Confira os dados acima.

Se estiver tudo certo, me devolva a ficha preenchida para gerar o contrato.`;
}

// =============================
// DADOS FALTANTES
// =============================

function buildMissingDataMessage(lead) {
  const b = lead.buyer || {};
  const missing = [];

  if (!b.full_name) missing.push("nome completo");
  if (!b.cpf) missing.push("CPF");
  if (!b.rg) missing.push("RG");
  if (!b.street) missing.push("endereço");

  if (!missing.length) return null;

  return `Para finalizar, preciso de:

• ${missing.join("\n• ")}`;
}

// =============================
// EXTRAÇÃO DE DADOS
// =============================

function mergeBuyerDataFromText(lead, text) {
  const b = lead.buyer || {};

  const cpf = text.match(/\d{3}\.?\d{3}\.?\d{3}\-?\d{2}/);
  if (cpf) b.cpf = cpf[0];

  const email = text.match(/[^\s]+@[^\s]+\.[^\s]+/);
  if (email) b.email = email[0];

  const phone = text.match(/(?:\+?55)?\d{10,11}/);
  if (phone) b.phone = phone[0];

  if (!b.full_name && text.length < 60) {
    b.full_name = text.trim();
  }

  lead.buyer = b;
  return lead;
}

// =============================
// FLUXO DE FECHAMENTO
// =============================

async function handleClosingFlow(lead) {
  const missing = buildMissingDataMessage(lead);

  if (missing) {
    return `${FECHAMENTO_INTRO}

${missing}`;
  }

  return `Perfeito 😊

Já posso gerar seu contrato.

Vou te enviar a ficha para conferência.`;
}

// =============================
// CONFIRMAÇÃO DE VENDA
// =============================

function buildConfirmationMessage() {
  return `Perfeito! 🎉

Sua fração está em processo de confirmação.

Assim que validarmos pagamento e documentação, você já garante sua unidade.

Se precisar de qualquer coisa, estou por aqui.`;
}
// =============================
// FOLLOW-UP AUTOMÁTICO
// =============================

function buildFollowUp(lead) {
  const now = Date.now();
  const last = lead.lastInteraction || 0;
  const diff = now - last;

  const oneHour = 1000 * 60 * 60;
  const twelveHours = oneHour * 12;
  const oneDay = oneHour * 24;
  const threeDays = oneDay * 3;

  if (diff > threeDays) {
    return `Oi! 😊

As últimas frações estão praticamente fechando.

Se ainda fizer sentido pra você, posso te ajudar a garantir a sua.`;
  }

  if (diff > oneDay) {
    return `Passando pra te lembrar 😊

A Casa Balanço do Mar tem tido bastante procura.

Quer que eu te mostre as condições atualizadas?`;
  }

  if (diff > twelveHours) {
    return `Conseguiu ver a apresentação da casa? 😊`;
  }

  if (diff > oneHour) {
    return `Oi! Só passando pra ver se ficou alguma dúvida 😊`;
  }

  return null;
}

// =============================
// ATUALIZA TEMPO DO LEAD
// =============================

function touchLead(lead) {
  lead.lastInteraction = Date.now();
  return lead;
}

// =============================
// PROCESSAMENTO PRINCIPAL
// =============================

async function processMessage({ from, text, lead }) {
  try {
    // Atualiza interação
    lead = touchLead(lead);

    // Atualiza dados do comprador
    lead = mergeBuyerDataFromText(lead, text);

    // Gera resposta principal
    let reply = await generateReply({
      lead,
      userText: text
    });

    // Se estiver em fechamento
    if (lead.stage === "fechamento") {
      const closing = await handleClosingFlow(lead);
      if (closing) reply = closing;
    }

    return {
      reply,
      lead
    };
  } catch (err) {
    console.error("AGENT ERROR:", err);

    return {
      reply: "Tive um pequeno problema aqui 😅 mas já estou te ajudando novamente.",
      lead
    };
  }
}

// =============================
// ENVIO DE MÍDIAS (GARANTE FUNCIONAMENTO)
// =============================

async function sendMediaPack(from) {
  try {
    await sendWhatsAppImage(from, process.env.IMG_1);
    await sendWhatsAppImage(from, process.env.IMG_2);
    await sendWhatsAppImage(from, process.env.IMG_3);
    await sendWhatsAppVideo(from, process.env.VIDEO_1);
  } catch (e) {
    console.log("Erro ao enviar mídia:", e.message);
  }
}

// =============================
// EXPORT FINAL
// =============================

module.exports = {
  processMessage,
  buildFollowUp,
  sendMediaPack
};
