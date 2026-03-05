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

    // ============================================
    // VERIFICAÇÃO DO WEBHOOK
    // ============================================
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

    // ============================================
    // RECEBER MENSAGEM
    // ============================================
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const body = req.body || {};
    const { from, text, profileName } = extractIncoming(body);

    if (!from || !text) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    // ============================================
    // DETECÇÃO DE LEAD QUENTE
    // ============================================
    const hotSignals = [
      "quero comprar",
      "quero fechar",
      "quero reservar",
      "como pagar",
      "quero contrato",
      "falar com humano",
      "falar com atendente",
      "ligação",
      "agendar",
      "quero pagar",
      "posso pagar",
      "como faço para pagar"
    ];

    const textLower = text.toLowerCase();

    const isHotLead = hotSignals.some(signal =>
      textLower.includes(signal)
    );

    // ============================================
    // CARREGA LEAD
    // ============================================
    let lead = (await getLeadByPhone(from)) || {
      phone: from,
      name: null,
      stage: "novo",
      history: [],
      last_message: nowISO(),
      followup1: false,
      followup2: false
    };

    // Aproveita nome do perfil WhatsApp
    if (!lead.name && profileName && profileName.length <= 40) {
      lead.name = profileName;
    }

    // ============================================
    // SALVA MENSAGEM DO USUÁRIO
    // ============================================
    lead.history = clampHistory([
      ...(Array.isArray(lead.history) ? lead.history : []),
      { role: "user", content: text, at: nowISO() }
    ], 18);

    lead.last_message = nowISO();
    lead = await upsertLead(lead);

    // ============================================
    // GERAR RESPOSTA DA IA
    // ============================================
    const reply = await generateReply({
      lead,
      userText: text
    });

    // ============================================
    // SALVAR RESPOSTA
    // ============================================
    lead.history = clampHistory([
      ...(Array.isArray(lead.history) ? lead.history : []),
      { role: "assistant", content: reply, at: nowISO() }
    ], 18);

    lead.last_message = nowISO();
    await upsertLead(lead);

    // ============================================
    // ENVIAR RESPOSTA PARA CLIENTE
    // ============================================
    await sendWhatsAppText(from, reply);

    // ============================================
    // ALERTA PARA CALLENO SE LEAD QUENTE
    // ============================================
    if (isHotLead) {

      const alertMessage = `
🚨 LEAD QUENTE

Cliente: ${lead.name || "não informado"}
Telefone: ${from}

Mensagem:
"${text}"

Entrar em contato agora para dar atenção especial.
`;

      await sendWhatsAppText("5527998331176", alertMessage);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {

    console.error("WEBHOOK ERROR:", err?.message || err);

    return res.status(200).json({
      ok: false,
      error: String(err?.message || err)
    });

  }
};
