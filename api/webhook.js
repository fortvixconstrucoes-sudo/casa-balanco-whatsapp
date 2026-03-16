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

function normalizeAddressText(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAddressRequest(text = "") {
  const t = normalizeAddressText(text);

  if (!t) return false;

  return (
    t === "endereco" ||
    t === "qual endereco" ||
    t === "tem endereco" ||
    t === "me passa o endereco" ||
    t === "me passa endereco" ||
    t === "qual o endereco" ||
    t === "localizacao" ||
    t === "qual localizacao" ||
    t === "tem localizacao" ||
    t === "qual a localizacao" ||
    t === "onde fica" ||
    t === "qual bairro" ||
    t === "bairro" ||
    t === "mapa" ||
    t === "local" ||
    t.includes("endereco") ||
    t.includes("localizacao") ||
    t.includes("onde fica") ||
    t.includes("qual bairro") ||
    t.includes("mapa")
  );
}

const CASA_ADDRESS_TEXT = `📍 A Casa Balanço do Mar fica em:

Rua T17, Quadra 26, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000`;

const CASA_MAP_TEXT = `Localização no mapa:
https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318`;

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

    const { from, text } = incoming;

    if (isAddressRequest(text)) {
      await sendWhatsAppText(from, "TESTE ENDERECO OK");
      await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
      await sendWhatsAppText(from, CASA_MAP_TEXT);

      return res.status(200).json({
        ok: true,
        route: "address-only",
        received_text: text,
        normalized_text: normalizeAddressText(text)
      });
    }

    await sendWhatsAppText(
      from,
      `TESTE WEBHOOK OK. Texto recebido: ${text || "(vazio)"}`
    );

    return res.status(200).json({ ok: true, route: "fallback-test" });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(200).json({
      ok: false,
      error: err?.message
    });
  }
};
