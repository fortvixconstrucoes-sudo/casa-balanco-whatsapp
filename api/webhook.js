const { sendWhatsAppText } = require("./_wa");

function extractIncoming(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const msg = value?.messages?.[0];
  if (!msg) return {};

  return {
    from: msg?.from,
    text:
      msg?.text?.body ||
      msg?.caption ||
      msg?.button?.text ||
      msg?.interactive?.button_reply?.title ||
      msg?.interactive?.list_reply?.title ||
      ""
  };
}

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

      return res.status(403).send("Forbidden");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    const incoming = extractIncoming(req.body || {});
    if (!incoming?.from) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    await sendWhatsAppText(
      incoming.from,
      "TESTE 999 OK - webhook novo ativo"
    );

    return res.status(200).json({
      ok: true,
      route: "teste-999",
      received_text: incoming.text || ""
    });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(200).json({
      ok: false,
      error: err?.message
    });
  }
};
