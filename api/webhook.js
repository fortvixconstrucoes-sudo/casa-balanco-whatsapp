export default async function handler(req, res) {
  const VERIFY_TOKEN = "fortvix_verify_2026";

  // ===============================
  // VERIFICAÇÃO DO WEBHOOK (META)
  // ===============================
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

  // ===============================
  // RECEBIMENTO DE MENSAGENS
  // ===============================
  if (req.method === "POST") {
    const body = req.body;

    console.log("Webhook completo:", JSON.stringify(body, null, 2));

    const message =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message && message.type === "text") {
      const from = message.from;
      const text = message.text.body;

      console.log("Mensagem recebida de:", from);
      console.log("Texto:", text);

      // ===============================
      // ENVIO DE RESPOSTA AUTOMÁTICA
      // ===============================
      await fetch(
        "https://graph.facebook.com/v25.0/1010479258814089/messages",
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
            text: {
              body:
                "Olá 👋 Seja bem-vindo à Casa Balanço do Mar.\n\nQuer receber a apresentação completa da casa em multipropriedade?",
            },
          }),
        }
      );
    }

    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).end();
}
