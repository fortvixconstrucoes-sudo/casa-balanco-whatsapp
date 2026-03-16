const { sendWhatsAppText } = require("./_wa");

function getValue(body) {
  return body?.entry?.[0]?.changes?.[0]?.value || {};
}

function getMessage(value) {
  return value?.messages?.[0] || null;
}

function getContact(value) {
  return value?.contacts?.[0] || null;
}

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromMessage(msg) {
  if (!msg) return "";

  return (
    msg?.text?.body ||
    msg?.caption ||
    msg?.button?.text ||
    msg?.interactive?.button_reply?.title ||
    msg?.interactive?.list_reply?.title ||
    ""
  );
}

function isAddressQuestion(text = "") {
  const t = normalizeText(text);

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

    const body = req.body || {};
    const value = getValue(body);
    const msg = getMessage(value);
    const contact = getContact(value);

    console.log("WEBHOOK BODY:", JSON.stringify(body));
    console.log("WEBHOOK VALUE:", JSON.stringify(value));
    console.log("WEBHOOK MSG:", JSON.stringify(msg));
    console.log("WEBHOOK CONTACT:", JSON.stringify(contact));

    if (!msg) {
      return res.status(200).json({
        ok: true,
        ignored: "no-message-object"
      });
    }

    const from = msg?.from;
    const type = msg?.type;
    const text = extractTextFromMessage(msg);
    const normalized = normalizeText(text);

    console.log("FROM:", from);
    console.log("TYPE:", type);
    console.log("TEXT:", text);
    console.log("NORMALIZED:", normalized);

    if (!from) {
      return res.status(200).json({
        ok: true,
        ignored: "no-from"
      });
    }

    if (isAddressQuestion(text)) {
      await sendWhatsAppText(from, "DEBUG: caiu no fluxo de endereço");
      await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
      await sendWhatsAppText(from, CASA_MAP_TEXT);

      return res.status(200).json({
        ok: true,
        route: "address-direct",
        text,
        normalized
      });
    }

    await sendWhatsAppText(
      from,
      `DEBUG: mensagem recebida -> ${text || "(sem texto)"}`
    );

    return res.status(200).json({
      ok: true,
      route: "fallback-debug",
      text,
      normalized
    });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(200).json({
      ok: false,
      error: err?.message || "unknown-error"
    });
  }
};
