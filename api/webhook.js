const { getLeadByPhone, upsertLead } = require("./_supabase");
const { sendWhatsAppText } = require("./_wa");
const { generateReply, nowISO, clampHistory } = require("./_agent");

function extractIncoming(body) {
  // Estrutura padrão WhatsApp Cloud
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const msg = value?.messages?.[0];
  const contact = value?.contacts?.[0];

  const from = msg?.from; // telefone do cliente
  const text = msg?.text?.body;

  const profileName = contact?.profile?.name;

  return { from, text, profileName };
}

module.exports = async (req, res) => {
  try {
    // 1) Verificação do webhook (GET)
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

    // 2) Receber mensagem (POST)
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const body = req.body || {};
    const { from, text, profileName } = extractIncoming(body);

    if (!from || !text) {
      // WhatsApp manda eventos que não são mensagem
      return res.status(200).json({ ok: true, ignored: true });
    }

    // 3) Carrega lead + cria se não existir
    let lead = (await getLeadByPhone(from)) || {
      phone: from,
      name: null,
      stage: "novo",
      history: [],
      last_message: nowISO(),
      followup1: false,
      followup2: false
    };

    // 4) Se não tem nome ainda, tenta aproveitar o profileName do WhatsApp (bom!)
    if (!lead.name && profileName && profileName.length <= 40) {
      lead.name = profileName;
    }

    // 5) Atualiza histórico com a mensagem do usuário
    lead.history = clampHistory([
      ...(Array.isArray(lead.history) ? lead.history : []),
      { role: "user", content: text, at: nowISO() }
    ], 18);

    lead.last_message = nowISO();
    lead = await upsertLead(lead);

    // 6) Gera resposta
    const reply = await generateReply({ lead, userText: text });

    // 7) Salva resposta no histórico + envia
    lead.history = clampHistory([
      ...(Array.isArray(lead.history) ? lead.history : []),
      { role: "assistant", content: reply, at: nowISO() }
    ], 18);

    lead.last_message = nowISO();
    await upsertLead(lead);

    await sendWhatsAppText(from, reply);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err?.message || err);
    return res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
};
