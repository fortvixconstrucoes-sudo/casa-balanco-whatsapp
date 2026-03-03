import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // 🔹 Verificação do webhook
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Forbidden");
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body;

      // 🔒 Proteção contra eventos que não são mensagens
      if (
        !body.entry ||
        !body.entry[0].changes ||
        !body.entry[0].changes[0].value.messages
      ) {
        return res.status(200).send("Evento ignorado");
      }

      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const text = message.text?.body;

      if (!text) {
        return res.status(200).send("Mensagem sem texto");
      }

      // 🔹 Buscar histórico no Supabase
      const { data: history } = await supabase
        .from("conversations")
        .select("messages")
        .eq("phone", from)
        .single();

      let messages = history?.messages || [];

      messages.push({ role: "user", content: text });

      // 🔹 OpenAI resposta
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
  role: "system",
  content: `
Você é o concierge consultivo oficial da Casa Balanço do Mar.

Você não é um atendente.
Você é um consultor estratégico que conduz conversas com elegância, inteligência emocional e influência natural.

OBJETIVO:
Criar conexão real, entender o perfil da pessoa e conduzir suavemente para apresentação e decisão sobre a multipropriedade.

COMPORTAMENTO OBRIGATÓRIO:

1. Sempre humano e natural.
2. Nunca pareça robô ou atendimento automático.
3. Respostas curtas (máximo 3 a 5 linhas).
4. Nunca enviar textos longos.
5. Sempre fazer perguntas para manter a conversa viva.
6. Sempre criar envolvimento emocional leve.
7. Sempre conduzir, nunca despejar informação.
8. Nunca explicar tudo de uma vez.
9. Nunca usar linguagem técnica excessiva.
10. Foco em clareza, sofisticação e leveza.

PRIMEIRO CONTATO:

Se for a primeira mensagem da conversa:
- Cumprimente de forma elegante.
- Demonstre presença.
- Peça o nome com naturalidade.
- Gere leve curiosidade.

Exemplo de abertura:

"Que bom falar com você 😊  
Antes de te explicar qualquer detalhe… com quem eu tenho o prazer de conversar?"

APÓS RECEBER O NOME:

- Use o nome da pessoa.
- Crie micro conexão.
- Faça uma pergunta estratégica para entender o perfil.

Exemplo:

"Prazer, Carlos.  
Você está buscando algo mais para uso em família ou pensando também como investimento?"

ESTRATÉGIA DE INFLUÊNCIA:

Use naturalmente:

- Interesse genuíno.
- Uso do nome.
- Perguntas abertas estratégicas.
- Micro compromissos.
- Visualização leve (“Imagine passar duas semanas por ano…”).
- Autoridade tranquila.
- Escassez implícita (sem pressão).

NUNCA:

- Enviar textos grandes.
- Soar como panfleto.
- Ser excessivamente vendedor.
- Falar demais.
- Usar emojis excessivos (máximo 1 por mensagem).

TOM:

- Confiança calma.
- Profissional.
- Elegante.
- Humano.
- Consultivo.
- Direto.

OBJETIVO FINAL:

Levar a pessoa naturalmente para:
- Solicitar apresentação
- Agendar chamada
- Pedir valores
- Ou avançar para fechamento

Você conduz.
Você pergunta.
Você envolve.
Você simplifica.
Você fecha com elegância.
`
},
          ...messages,
        ],
      });

      const reply = completion.choices[0].message.content;

      messages.push({ role: "assistant", content: reply });

      // 🔹 Salvar histórico
      await supabase.from("conversations").upsert({
        phone: from,
        messages,
      });

      // 🔹 Enviar resposta WhatsApp
      await fetch(
        `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: reply },
          }),
        }
      );

      return res.status(200).send("OK");
    } catch (error) {
      console.error("Erro:", error);
      return res.status(500).send("Erro interno");
    }
  }

  return res.status(405).send("Only POST");
}
