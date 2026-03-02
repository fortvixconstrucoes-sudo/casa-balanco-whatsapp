import OpenAI from "openai";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: message },
  };

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

function buildSystemPrompt() {
  return `
Você é o Consultor Estratégico Oficial da Casa Balanço do Mar, multipropriedade em Prado/BA.

Seu objetivo é converter leads qualificados em fechamento com atendimento humano.

REGRAS:

- Nunca enviar PDF.
- Nunca enviar contrato.
- Documentos apenas no fechamento com humano.
- Sempre conduzir para ligação ou validação humana.
- Pagamento à vista possui prioridade estratégica na escolha das semanas no calendário rotativo.
- Seja firme, elegante e direto.
- Sempre finalizar com pergunta.
`;
}

async function generateAgentReply(userMessage) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userMessage }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  }

  if (req.method === "POST") {
    const body = req.body;

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message && message.text) {
      const from = message.from;
      const userMessage = message.text.body;

      const agentReply = await generateAgentReply(userMessage);

      await sendWhatsAppMessage(from, agentReply);
    }

    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).end();
}
