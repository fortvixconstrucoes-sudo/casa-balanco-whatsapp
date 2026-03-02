export default async function handler(req, res) {
  // ===============================
  // 🔐 VERIFICAÇÃO DO WEBHOOK
  // ===============================
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
      mode === "subscribe" &&
      token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Erro de verificação");
    }
  }

  // ===============================
  // 📩 RECEBER MENSAGEM
  // ===============================
  if (req.method === "POST") {
    try {
      const body = req.body;

      const message =
        body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!message) {
        return res.status(200).send("Evento recebido");
      }

      const from = message.from;
      const userText = message.text?.body;

      // ===============================
      // 🤖 CHAMADA OPENAI
      // ===============================
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Você é o assistente oficial da Casa Balanço do Mar. Seja elegante, objetivo e persuasivo na venda de frações.",
              },
              {
                role: "user",
                content: userText,
              },
            ],
          }),
        }
      );

      const openaiData = await openaiResponse.json();

      const aiText =
        openaiData.choices?.[0]?.message?.content ||
        "Olá! Como posso ajudar você hoje?";

      // ===============================
      // 📤 ENVIAR RESPOSTA WHATSAPP
      // ===============================
      await fetch(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: aiText },
          }),
        }
      );

      return res.status(200).send("Mensagem enviada");
    } catch (error) {
      console.error("Erro:", error);
      return res.status(500).send("Erro interno");
    }
  }

  return res.status(405).send("Método não permitido");
}
