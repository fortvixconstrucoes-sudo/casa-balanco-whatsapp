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
            content:
              "Você é o concierge oficial da Casa Balanço do Mar. Seja objetivo, elegante e comercial.",
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
