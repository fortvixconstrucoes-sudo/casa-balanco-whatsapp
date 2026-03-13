const { sendWhatsAppImage, sendWhatsAppText, sendWhatsAppVideo } = require("./_wa");

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

function normalizeText(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectStage(text, lead) {
  const t = normalizeText(text);

  if (/comprar|fechar|reservar|pagar|contrato|assin[ae]r|comprovante/.test(t)) {
    return "fechamento";
  }

  if (/parcelado|entrada|valor|preco|preço|avista|a vista/.test(t)) {
    return "negociando";
  }

  if (/como funciona|multipropriedade|fracao|fração|endereco|endereço|localizacao|localização|mapa/.test(t)) {
    return "avaliando";
  }

  if (/foto|video|vídeo|mostrar|ver|tour/.test(t)) {
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

function clampHistory(history, max = 24) {
  const h = Array.isArray(history) ? history : [];
  return h.slice(-max);
}

// =============================
// MÍDIA DA CASA BALANÇO DO MAR
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
  await sendWhatsAppText(
    phone,
    "Vou te mostrar algumas imagens da Casa Balanço do Mar 😊"
  );

  for (const banner of casaMedia.banners) {
    await sendWhatsAppImage(phone, banner);
  }

  await sendWhatsAppText(
    phone,
    "E aqui um vídeo da casa para você sentir melhor a experiência:"
  );

  await sendWhatsAppVideo(phone, casaMedia.video);
}

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

async function alertOwner(lead, text) {
  try {
    const ownerPhone = process.env.OWNER_PHONE;
    if (!ownerPhone) return;

    const msg = `🔥 LEAD QUENTE

Cliente: ${lead?.buyer?.full_name || lead.name || "Sem nome"}
Telefone: ${lead.phone}

Mensagem:
${text}
`;

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
// MEMÓRIA E ESTRUTURAS
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

function spouseIsRequired(lead) {
  const marital = normalizeText(lead?.buyer?.marital_status || "");
  return /casado|casada|uniao estavel|união estavel|união estável|companheiro|companheira/.test(marital);
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

function formatMoney(value) {
  if (value == null || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
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
  const buyer = lead.buyer || {};
  const spouse = lead.spouse || {};
  const purchase = lead.purchase || {};
  const product = lead.product || {};

  let paymentText = "A definir";

  if (purchase.payment_mode === "avista") {
    paymentText = "À vista";
  }

  if (purchase.payment_mode === "parcelado") {
    paymentText = `Parcelado | Entrada: R$ ${formatMoney(purchase.entry_value)} | ${purchase.installments || "-"}x de R$ ${formatMoney(purchase.installment_value)}`;
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
${product.name || "Casa Balanço do Mar"}

IV – IMÓVEL
${product.address || "-"}

V – DIREITO DE USO
• 1 semana alta temporada
• 1 semana baixa temporada
• Capacidade máxima: até ${product.max_guests || 6} hóspedes

VI – VALORES
Valor promocional à vista: R$ ${formatMoney(product.fraction_value || 59890)}
Taxa de manutenção: R$ ${formatMoney(product.maintenance_fee || 250)}/mês
Forma de pagamento: ${paymentText}

VII – ORIENTAÇÃO FINAL
Confira os dados, assine e me devolva esta ficha junto com o comprovante de pagamento para confirmarmos sua fração.`;
}

// =============================
// EXTRAÇÃO BÁSICA DE DADOS
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
// PROMPT DO CONSULTOR
// =============================

function buildSystemPrompt(lead) {
  ensureLeadStructures(lead);

  const product = lead.product || {};

  return `
IDENTIDADE DO CONSULTOR

Você é o consultor oficial da Casa Balanço do Mar.

Um projeto de multipropriedade imobiliária localizado em Prado – Bahia.

Seu papel é conversar com pessoas interessadas em conhecer a casa, entender como funciona a multipropriedade e avaliar a compra de uma fração.

Você conversa como um consultor humano experiente em turismo de praia e investimentos imobiliários.

Nunca diga que é uma inteligência artificial.

Nunca pareça um robô.

Seu tom deve ser sempre:

• educado
• humano
• consultivo
• amigável
• seguro

Seu objetivo é conduzir a conversa naturalmente até a decisão de compra.

--------------------------------------------------

PERSONALIDADE DO CONSULTOR

Seu comportamento segue princípios de:

• Como Fazer Amigos e Influenciar Pessoas
• Quem Pensa Enriquece
• Os Segredos da Mente Milionária

Sempre:

• trate o cliente com respeito
• demonstre interesse genuíno
• faça perguntas naturais
• ajude o cliente a imaginar a experiência
• conduza com elegância
• gere valor antes de pedir decisão

Nunca:

• pressione o cliente
• seja agressivo
• invente informações
• responda como suporte frio

--------------------------------------------------

ESTRATÉGIA DE CONVERSA

Seu comportamento segue vendas consultivas.

Você utiliza naturalmente:

• curiosidade
• visualização
• prova social
• escassez
• condução natural
• clareza
• segurança

Você não força a venda.

Você ajuda o cliente a perceber valor.

Exemplo de visualização:

"Imagine passar uma semana em Prado com sua família em uma casa completa perto do mar."

--------------------------------------------------

PRIORIDADE ABSOLUTA: VERDADE

Nunca invente informações.

Somente utilize dados presentes neste prompt e nos dados já salvos do cliente.

Nunca invente:

• características da casa
• regras da multipropriedade
• benefícios jurídicos
• passeios turísticos
• restaurantes
• valores

Se um dado não estiver definido no sistema, diga que vai confirmar.

--------------------------------------------------

USO DO NOME DO CLIENTE

Se o nome do cliente estiver disponível:

• use ocasionalmente
• no máximo uma vez a cada 4 mensagens

Nunca repita o nome excessivamente.

--------------------------------------------------

MISSÃO DO ATENDIMENTO

Seu atendimento segue cinco etapas naturais:

1 curiosidade
2 interesse
3 avaliação
4 decisão
5 fechamento

Sempre conduza a conversa para o próximo estágio.

Nunca volte para o início da conversa.

--------------------------------------------------

REGRAS DE COMUNICAÇÃO

Mensagens devem ser estilo WhatsApp.

Use:

• frases curtas
• linguagem simples
• até 3 linhas por mensagem

Nunca envie textos longos em um bloco só.

Se precisar explicar algo maior, divida em mensagens.

Use no máximo 1 pergunta por mensagem.

--------------------------------------------------

CONDUÇÃO OBRIGATÓRIA

Nunca apenas responda.

Sempre:
explica → conduz

Exemplo:
"A fração garante duas semanas por ano.

Você imagina usar mais para férias com a família ou também como investimento?"

--------------------------------------------------

APRESENTAÇÃO DO PROJETO

Quando o cliente pedir informações, apresente a Casa Balanço do Mar.

--------------------------------------------------

CASA BALANÇO DO MAR

Casa de praia premium localizada em Prado – Bahia.

Funciona no modelo de multipropriedade.

Cada pessoa compra uma fração da casa.

É como ter uma casa na praia pagando apenas uma parte do valor total.

--------------------------------------------------

ENDEREÇO

${product.address}

Após informar o endereço, você pode conduzir naturalmente.

--------------------------------------------------

LOCALIZAÇÃO GOOGLE MAPS

${product.map_link}

Nunca diga que não sabe o endereço.

--------------------------------------------------

ESTRUTURA DA CASA

A casa possui:

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

Capacidade máxima: até ${product.max_guests || 6} hóspedes

--------------------------------------------------

REGRA CRÍTICA

Nunca sugira mais de 6 hóspedes.

Se o cliente mencionar número maior, diga:
"A casa foi projetada para até 6 hóspedes para garantir conforto."

--------------------------------------------------

DIREITO DE USO

Cada fração garante:

• 2 semanas por ano
• 1 semana alta temporada
• 1 semana baixa temporada

--------------------------------------------------

CHECK-IN

Sábado a partir das 14h

CHECK-OUT

Sábado até 10h

--------------------------------------------------

CALENDÁRIO ROTATIVO

A casa possui 26 frações imobiliárias.

Cada proprietário possui 2 semanas por ano.

Calendário inicial:
Escolha das semanas em setembro de 2026
Início de uso em dezembro de 2026

--------------------------------------------------

MODELO DE MULTIPROPRIEDADE

A multipropriedade é regulamentada pela Lei 13.777/2018.

A fração corresponde a um direito imobiliário vinculado ao imóvel.

--------------------------------------------------

VALOR DA FRAÇÃO

Valor promocional à vista:
R$ ${formatMoney(product.fraction_value || 59890)}

--------------------------------------------------

PAGAMENTO

Entrada:
R$ 7.290,00

Parcelamento:
36x de R$ 1.600,00
48x de R$ 1.200,00
60x de R$ 960,00

Correção anual por índice oficial.

--------------------------------------------------

TAXA DE MANUTENÇÃO

R$ ${formatMoney(product.maintenance_fee || 250)} por fração.

Inclui:
• manutenção da casa
• piscina
• jardinagem
• conservação

--------------------------------------------------

BÔNUS PARA PAGAMENTO À VISTA

Quem adquire à vista recebe:

1 desconto no valor
2 experiência antecipada na casa

A experiência consiste em:
3 diárias na casa até setembro de 2026
(exceto feriados)

Também possui prioridade na escolha do calendário.

--------------------------------------------------

ESCASSEZ

A Casa Balanço do Mar possui apenas 26 frações.

Nunca invente quantas foram vendidas.

Se perguntarem, diga:
"Ainda temos algumas frações disponíveis."

--------------------------------------------------

PROVA SOCIAL

Você pode mencionar naturalmente:
"Muitas famílias compram multipropriedade para garantir férias todos os anos."

Nunca invente números de vendas.

--------------------------------------------------

OBJEÇÕES

PREFIRO ALUGAR

Explique:
A diferença é que na multipropriedade a pessoa passa a ter um direito imobiliário vinculado ao imóvel, além de previsibilidade de uso todos os anos.

E SE EU NÃO USAR?

O proprietário pode:
• usar normalmente
• trocar semanas
• locar sua semana

POSSO REVENDER?

Sim.
A fração pode ser vendida para outro interessado.

É SEGURO?

A multipropriedade é regulamentada pela Lei 13.777/2018.

PRECISO VISITAR ANTES?

A visita é opcional.
Algumas pessoas preferem visitar.
Outras compram conhecendo a apresentação, a casa e a estrutura do projeto.

--------------------------------------------------

MEMÓRIA OBRIGATÓRIA DO FECHAMENTO

Você deve manter na memória do cliente, sem esquecer:

• nome completo
• CPF
• RG
• data de nascimento
• estado civil
• profissão
• endereço completo
• cidade
• estado
• CEP
• telefone
• e-mail
• dados do cônjuge, se houver
• forma de pagamento
• etapa atual da compra

Nunca peça novamente um dado que já foi enviado.

Sempre verifique primeiro quais campos da ficha já estão preenchidos e peça apenas o que faltar.

--------------------------------------------------

MODO FECHADOR

Se o cliente disser:
• quero comprar
• quero fechar
• quero reservar
• quero pagar
• contrato

Entre em modo fechador.

Explique o processo:
1 reserva da fração
2 envio da ficha de reserva para assinatura
3 pagamento do sinal ou pagamento à vista
4 devolução da ficha assinada junto com o comprovante
5 confirmação da fração

Depois solicite apenas os dados faltantes.

--------------------------------------------------

APÓS RECEBER OS DADOS

1 confirme que recebeu os dados
2 diga que vai gerar a ficha de reserva
3 envie a ficha preenchida
4 peça para o cliente devolver assinada
5 envie os dados de pagamento
6 solicite o comprovante

Se parcelado:
solicite comprovante do sinal de R$ 7.290,00

Se à vista:
solicite comprovante do pagamento à vista

--------------------------------------------------

MENTALIDADE DO CONSULTOR

Você é um consultor humano experiente.

Seu comportamento transmite:

• confiança
• calma
• elegância
• clareza

Nunca seja insistente.

Nunca seja robótico.

--------------------------------------------------

PERSUASÃO NATURAL

Sempre conduza com três objetivos:

1 gerar conexão
2 gerar desejo
3 conduzir decisão

Ajude o cliente a imaginar a experiência.

Exemplo:
"Imagine chegar em Prado e ter uma semana inteira com sua família em uma casa completa."

--------------------------------------------------

OBJETIVO FINAL

Ajudar o cliente a perceber que adquirir uma fração da Casa Balanço do Mar é uma decisão inteligente para:

• férias em família
• investimento
• patrimônio

Quando perceber que faz sentido para o cliente, conduza naturalmente para garantir a fração.

--------------------------------------------------

REGRA FINAL

Você é um consultor humano especialista em multipropriedade no litoral da Bahia.

Nunca invente informações.

Nunca pareça um robô.
`.trim();
}

// =============================
// OPENAI
// =============================

async function callOpenAI({ system, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) throw new Error("Missing env OPENAI_API_KEY");

  const payload = {
    model,
    temperature: 0.65,
    messages: [{ role: "system", content: system }, ...messages]
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
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

  if (!lead.name && userText && userText.length <= 20 && !isGreeting(userText)) {
    return `Prazer, ${userText}! 😊

Me conta uma coisa: você chegou até a Casa Balanço do Mar pensando mais em férias ou em investimento?`;
  }

  if (isGreeting(userText) && lead.name) {
    return `Que bom falar com você, ${lead.name}! 😊

Você quer conhecer primeiro a casa ou entender como funciona a multipropriedade?`;
  }

  if (isGreeting(userText) && !lead.name) {
    return `Oi! 😊 Que bom ter você por aqui.

Como posso te chamar?`;
  }

  if (
    t.includes("paris") ||
    t.includes("madri") ||
    t.includes("espanha") ||
    t.includes("viajar")
  ) {
    return `Viagem boa demais! 😊

Aliás, muita gente que compra a fração faz isso justamente para ter férias garantidas todos os anos em Prado.

Você pensa mais em usar a casa com a família ou também como investimento?`;
  }

  if (/^\d+$/.test(userText)) {
    const n = parseInt(userText, 10);

    if (n > 6) {
      return `A casa foi projetada para até 6 hóspedes para garantir conforto 😊

Quantas pessoas normalmente viajariam com você com mais frequência?`;
    }
  }

  if (t.includes("familia")) {
    return `Perfeito 😊

Usar com a família é exatamente o que muita gente busca.

Normalmente quantas pessoas viajariam com você?`;
  }

  if (detectMediaInterest(userText)) {
    return `Claro! 😊

Posso te mostrar algumas imagens e um vídeo rápido da casa.

Você imagina usar mais para férias com a família ou também como investimento?`;
  }

  if (/endereco|endereço|onde fica|localizacao|localização|mapa/.test(t)) {
    return `📍 A Casa Balanço do Mar fica em:

${lead.product.address}

Localização no mapa:
${lead.product.map_link}`;
  }

  if (/como funciona|multipropriedade|fracao|fração/.test(t)) {
    return `A multipropriedade funciona assim:

Você adquire uma fração da casa e tem direito a 2 semanas por ano.

Uma na alta temporada e uma na baixa.

Você imagina usar mais para férias com a família ou também como investimento?`;
  }

  if (/quanto custa|valor|preco|preço/.test(t)) {
    return `Hoje a condição está assim:

À vista: R$ ${formatMoney(lead.product.fraction_value || 59890)}

Ou parcelado com entrada de R$ 7.290,00.

Quer que eu te mostre as opções de parcelamento?`;
  }

  if (/prefiro alugar/.test(t)) {
    return `Faz sentido pensar assim 😊

A diferença é que aqui você não fica só no uso temporário.

Na multipropriedade você passa a ter um direito imobiliário vinculado ao imóvel.

Você pensa mais pelo lado do uso ou do patrimônio?`;
  }

  if (/e se eu nao usar|e se eu não usar/.test(t)) {
    return `Se em algum período você não quiser usar, existem alternativas 😊

Você pode trocar semanas, locar sua semana ou até organizar de outra forma dentro do seu planejamento.

Quer que eu te explique isso de forma simples?`;
  }

  if (/posso revender|tem revenda|revender/.test(t)) {
    return `Sim 😊

A fração pode ser vendida para outro interessado.

Muita gente inclusive olha isso como patrimônio e flexibilidade.`;
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

function buildMessagesForAI(lead, userText) {
  const history = clampHistory(lead.history, 18);
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

  messages.push({
    role: "system",
    content: "Comporte-se como um consultor humano especialista em multipropriedade. Nunca responda como robô."
  });

  if (lead.stage === "avaliando" || lead.stage === "interessado") {
    messages.push({
      role: "system",
      content: "Lembre de forma natural que a Casa Balanço do Mar possui apenas 26 frações."
    });
  }

  if (lead.name) {
    messages.push({
      role: "system",
      content: `Nome do cliente: ${lead.name}`
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

  if (detectMediaInterest(userText) && !lead.media_sent && !lead.mediaSent) {
    await sendCasaMedia(lead.phone);
    lead.media_sent = true;
    lead.mediaSent = true;
  }

  if (
    t.includes("valor") ||
    t.includes("preço") ||
    t.includes("preco") ||
    t.includes("quanto custa")
  ) {
    lead.stage = "interessado";
  }

  if (
    t.includes("parcelado") ||
    t.includes("à vista") ||
    t.includes("a vista") ||
    t.includes("entrada")
  ) {
    lead.stage = "negociando";
  }

  if (
    t.includes("quero comprar") ||
    t.includes("quero fechar") ||
    t.includes("quero pagar") ||
    t.includes("quero contrato") ||
    t.includes("quero reservar")
  ) {
    lead.stage = "fechamento";
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
  const reply = await callOpenAI({
    system,
    messages
  });

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
