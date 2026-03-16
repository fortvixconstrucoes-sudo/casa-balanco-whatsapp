const { sendWhatsAppText } = require("./_wa");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === verifyToken) {
        return res.status(200).send(challenge);
      }
      
if (req.method === "GET") {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(200).send("WEBHOOK ONLINE OK");
}

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    if (!msg?.from) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    await sendWhatsAppText(msg.from, "VERCEL_TESTE_01");

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err?.message });
  }
};
