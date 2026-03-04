export default async function handler(req, res) {
  // ENV
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.ID_DO_NUMERO_DE_TELEFONE; // seu nome atual na Vercel
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  // Helpers
  const sendWhatsAppMessage = async (to, message) => {
    try {
      await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      });
    } catch (err) {
      console.log("erro envio whatsapp", err);
    }
  };

  const askAI = async (userText) => {
    try {
      const systemPrompt = `
Você é um concierge consultivo da Casa Balanço do Mar (Prado/BA) e também um vendedor humano, educado e estratégico.

OBJETIVO:
- Atender bem
- Entender o perfil
- Ajudar a pessoa a decidir
- Conduzir para apresentação/visita e fechamento

ESTILO (OBRIGATÓRIO):
- Respostas curtas (máx. 3 a 5 linhas)
- Tom humano, caloroso, profissional
- Nada robótico
- Nada repetitivo
- NÃO repetir a mesma pergunta duas vezes seguidas
- Sempre avançar 1 passo por vez

TÉCNICAS (SEM citar livros):
- Interesse genuíno + elogio sutil + escuta
- Perguntas simples que facilitem resposta
- Linguagem que cria visão (família, descanso, segurança, investimento)
- Direção sem pressão (convite, não insistência)
- Mentalidade de prosperidade e decisão (clareza e confiança)

REGRAS DE CONVERSA:
1) Se a pessoa mandar só “oi/olá/boa tarde”:
   - Cumprimente
   - Pergunte UMA coisa simples: “Você quer entender como funciona a fração, valores ou disponibilidade de semanas?”
2) Se a pessoa disser “quero informações”:
   - Responda com 3 bullets curtos (o que é, valor, como escolher semanas)
   - Pergunte: “Você quer usar para lazer (família) ou como investimento?”
3) Se a pessoa já falou o nome (ex: Calleno):
   - Use o nome 1 vez e não repita.
4) Sempre finalize com uma pergunta curta e fácil.

DADOS DO PRODUTO (pode usar):
- Casa Balanço do Mar – multipropriedade em Prado/BA
- Fração: 2 semanas por ano
- Valor à vista: R$ 59.890
- Pagamento à vista pode ter prioridade de escolha de semanas (se aplicável)
`;

      const payload = {
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userText },
        ],
      };

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await r.json();

      const msg = data?.choices?.[0]?.message?.content?.trim();
      if (!msg) return "Perfeito. Me diga só: você busca lazer (família) ou investimento?";

      return msg;
    } catch (err) {
      console.log("erro openai", err);
      return "Tive um ajuste aqui rapidinho. Me diz: você quer saber valores ou como funcionam as semanas?";
    }
  };

  // 1) Verificação do webhook (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Token inválido");
  }

  // 2) Mensagens (POST)
  if (req.method === "POST") {
    try {
      const body = req.body;

      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return res.status(200).send("ok");

      const from = message?.from;
      const text = message?.text?.body?.trim();

      if (!from || !text) return res.status(200).send("ok");

      // Evita responder eco do próprio sistema (se vier)
      // (WhatsApp Cloud geralmente não manda seu próprio texto, mas fica seguro)
      if (text.length === 0) return res.status(200).send("ok");

      const reply = await askAI(text);
      await sendWhatsAppMessage(from, reply);

      return res.status(200).send("ok");
    } catch (err) {
      console.log("erro webhook", err);
      // responde 200 para o Meta não ficar reenviando infinitamente
      return res.status(200).send("ok");
    }
  }

  return res.status(405).send("Method not allowed");
}
