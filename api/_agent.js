function nowISO() {
  return new Date().toISOString();
}

function normalizeText(s) {
  return (s || "").trim().toLowerCase();
}

function isGreeting(txt) {
  const t = normalizeText(txt);
  return ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(t);
}

function clampHistory(history, max = 18) {
  const h = Array.isArray(history) ? history : [];
  return h.slice(-max);
}

function buildSystemPrompt() {
  return `
Você é o atendente premium da "Casa Balanço do Mar" (Prado/BA).
Seu objetivo é: atender com elegância + criar confiança + conduzir para a apresentação e a venda da fração.

REGRAS DE TOM (OBRIGATÓRIO):
- Nunca seja robótico.
- Evite repetir "Olá" em toda mensagem.
- Mensagens curtas, humanas, com ritmo de WhatsApp.
- Faça 1 pergunta por vez (no máximo 2 quando necessário).
- Use o nome da pessoa quando souber (sem exagero).
- Sempre avance a conversa (sem loop, sem redundância).

MEMÓRIA:
- O telefone é o ID do cliente.
- Se o nome não estiver salvo, pergunte UMA vez e salve.
- Se já tiver nome, não pergunte de novo.
- Sempre retome o assunto de onde parou.

PRODUTO (dados oficiais):
- Casa Balanço do Mar — Prado/BA.
- Multipropriedade: compra de fração anual (2 semanas/ano: 1 alta + 1 baixa).
- CHECK-IN: terça-feira às 14h
- CHECK-OUT: terça-feira até 10h
- Valor da fração: R$ 65.890
- Valor à vista: R$ 59.890
- (Se perguntarem) Taxa de manutenção: R$ 250/mês (por fração).
- (Se perguntarem) Energia: por consumo.

ESTRATÉGIA DE VENDA (sem dizer que é estratégia):
1) Acolher rápido + validar.
2) Descobrir intenção (férias, investimento, família, renda, uso próprio).
3) Entregar 2-3 benefícios específicos (não texto longo).
4) Fazer a pergunta que fecha o próximo passo:
   - "Quer que eu te mande a apresentação com fotos e calendário?"
   - "Prefere ver valores à vista ou parcelado?"
   - "Posso te mandar as opções de semanas disponíveis?"

CONTEÚDO TURÍSTICO (use quando fizer sentido):
- Prado/BA é base excelente para praias e passeios.
- Próximo de Porto Seguro e do eixo Arraial/Trancoso.
- Passeios comuns: praias (Paixão, Tororão, Guaratiba), Corumbau (distrito), Cumuruxatiba.
- Abrolhos (saídas geralmente pela região de Caravelas).
Não invente números exatos de distância/tempo se não tiver certeza; diga "em média" ou "depende do trajeto".

FORMATO DE RESPOSTA:
- Gere apenas o texto final que será enviado no WhatsApp.
  `.trim();
}

async function callOpenAI({ system, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("Missing env OPENAI_API_KEY");

  // Chat Completions simples por compatibilidade
  const payload = {
    model,
    temperature: 0.6,
    messages: [
      { role: "system", content: system },
      ...messages
    ]
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

function quickSmartReply({ lead, userText }) {
  const t = normalizeText(userText);

  // Captura nome quando a pessoa manda só o nome (ex: "Calleno")
  if (!lead.name && userText && userText.length <= 20 && !isGreeting(userText)) {
    return `Prazer, ${userText}! 😊 Me diz rapidinho: você está buscando **férias** (usar a casa) ou quer entender a **multipropriedade/investimento**?`;
  }

  // Se for só "oi" e já temos nome: não repetir olá, já puxar assunto
  if (isGreeting(userText) && lead.name) {
    return `${lead.name}, me conta: você quer conhecer mais a casa ou entender como funciona a multipropriedade?`;
  }

  // Se for só "oi" e não tem nome: pedir nome de forma natural
  if (isGreeting(userText) && !lead.name) {
    return `Oi! 😊 Que bom ter você por aqui. Como posso te chamar?`;
  }

  return null;
}

async function generateReply({ lead, userText }) {
  const system = buildSystemPrompt();

  // 1) resposta rápida (evita “robô” e evita repetição)
  const fast = quickSmartReply({ lead, userText });
  if (fast) return fast;

  // 2) monta contexto com memória curta e forte (sem exagero)
  const history = clampHistory(lead.history, 18);

  const messages = [];
  if (lead.name) {
    messages.push({
      role: "user",
      content: `Contexto: O nome do cliente é ${lead.name}. Telefone: ${lead.phone}.`
    });
  } else {
    messages.push({
      role: "user",
      content: `Contexto: Ainda não sabemos o nome do cliente. Telefone: ${lead.phone}.`
    });
  }

  // Transforma histórico em mensagens
  for (const item of history) {
    if (item && item.role && item.content) {
      messages.push({ role: item.role, content: item.content });
    }
  }

  // Mensagem atual
  messages.push({ role: "user", content: userText });

  // 3) chama IA
  const reply = await callOpenAI({ system, messages });
  return reply;
}

module.exports = { generateReply, nowISO, clampHistory };
