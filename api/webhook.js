export default async function handler(req, res) {
  // ===============================
  // 🔐 VERIFICAÇÃO DO WEBHOOK (META)
  // ===============================
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  // ===============================
  // 📩 RECEBER EVENTOS (WHATSAPP)
  // ===============================
  if (req.method === "POST") {
    try {
      const body = req.body;

      const change = body?.entry?.[0]?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      // Se não for mensagem (status, etc.), apenas confirma
      if (!message) return res.status(200).send("No message");

      const from = message.from;

      // Nome do contato (quando disponível no payload)
      const waName =
        change?.contacts?.[0]?.profile?.name ||
        change?.contacts?.[0]?.wa_id ||
        "";

      // Texto recebido
      const userText = message?.text?.body?.trim() || "";

      // Se não for texto (imagem/áudio), responda de forma curta
      if (!userText) {
        await sendWhatsAppText(
          from,
          `Perfeito, recebi 👍 Para eu te atender direitinho, me diz seu nome?`,
          process.env
        );
        return res.status(200).send("Non-text handled");
      }

      // ===============================
      // 🧠 PROMPT PREMIUM (ATENDIMENTO + CONVERSÃO)
      // ===============================
      const SYSTEM_PROMPT = `
Você é um consultor comercial humano (NÃO robô) da Casa Balanço do Mar, Prado/BA.
Seu objetivo é converter para: (1) apresentação e (2) venda da fração, com cordialidade, gentileza e sedução elegante.

REGRAS OBRIGATÓRIAS
- Responda em no máximo 1 a 3 frases curtas.
- Tom humano, elegante e confiante.
- NUNCA use “senhor”, “senhora”, “amigo”, “querida”.
- Se não souber o nome, PERGUNTE: “Com quem eu tenho o prazer de falar?”
- Se souber o nome, use apenas 1 vez por mensagem (sem exagero).
- NÃO invente informações.
- NÃO saia do produto (Casa Balanço do Mar / frações / experiência).
- Sempre finalize com 1 pergunta que avance o próximo passo.

PRODUTO (FIXO)
- Casa Balanço do Mar (residência premium) com piscina privativa e área gourmet.
- Modelo de multipropriedade: 26 frações.
- Cada fração: 2 semanas por ano (1 alta + 1 baixa).
- Manutenção estimada: R$ 250/mês.
- Prioridade no calendário rotativo: pagamento À VISTA tem prioridade de escolha.
- Hospedagem (experiência antes de comprar): R$ 1.000/dia, mínimo 2 diárias, até 6 hóspedes.

PREÇOS (FIXO)
- Valor oficial: R$ 64.890.
- Condição especial À VISTA: R$ 59.890 (quando você mencionar “à vista”, chame de “condição especial”, não “desconto”).
- Parcelado existe (não precisa detalhar parcelas sem o cliente pedir).

CONDUTA DE VENDA (MELHORES PRÁTICAS)
- Primeira mensagem: pedir nome (se não tiver).
- Depois: oferecer 2 caminhos (multipropriedade OU experiência).
- Se pedir preço: ancorar valor oficial e citar condição especial à vista + prioridade calendário.
- Se pedir hospedagem: vender como “experiência limitada antes da venda total das frações”.
- Se vier objeção (“caro”): responder curto, reforçar padrão + exclusividade e perguntar se prefere entender fração ou experiência.

IMPORTANTE
- Nunca prometa registro imediato. Se perguntarem registro, diga: “o registro definitivo está em processo, mas o uso e as regras já são contratuais”.
`;

      // Pequeno contexto para o modelo (nome do WhatsApp se existir)
      const USER_CONTEXT = waName
        ? `O nome do contato no WhatsApp é: ${waName}`
        : `O nome do contato ainda não foi informado.`;

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.35,
          max_tokens: 160,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: USER_CONTEXT },
            { role: "user", content: userText },
          ],
        }),
      });

      const openaiData = await openaiResponse.json();
      const aiText =
        openaiData?.choices?.[0]?.message?.content?.trim() ||
        "Olá! Com quem eu tenho o prazer de falar?";

      await sendWhatsAppText(from, aiText, process.env);

      return res.status(200).send("Message processed");
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(500).send("Internal error");
    }
  }

  return res.status(405).send("Method not allowed");
}

// ===============================
// ✅ ENVIO DE MENSAGEM WHATSAPP
// ===============================
async function sendWhatsAppText(to, text, env) {
  const url = `https://graph.facebook.com/v19.0/${env.PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}
