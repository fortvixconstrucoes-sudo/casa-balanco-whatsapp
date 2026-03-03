import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const AI_SYSTEM_PROMPT = `
Você é consultor comercial humano da Casa Balanço do Mar, Prado/BA.

OBJETIVO:
Conduzir para apresentação ou venda da fração.

REGRAS:
- Respostas curtas (máximo 2 frases).
- Tom elegante, natural e seguro.
- Nunca repetir perguntas já feitas.
- Nunca perguntar o nome se já foi informado.
- Nunca usar "senhor" ou "senhora".
- Sempre finalizar conduzindo para o próximo passo.

INFORMAÇÕES FIXAS:
- 26 frações
- 2 semanas por ano (1 alta + 1 baixa)
- Valor oficial: R$ 64.890
- Condição especial à vista: R$ 59.890
- Prioridade no calendário para pagamento à vista
- Experiência: R$ 1.000 por diária, mínimo 2 noites, até 6 hóspedes
- Manutenção estimada: R$ 250/mês

Registro:
O registro definitivo está em processo e será concluído em até 12 meses, sem impedir o uso contratual.

Turismo:
Valorizar localização, restaurantes e passeios, sem prometer serviços inclusos.

Nunca inventar informações.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Only POST");

  const body = req.body;
  const change = body?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  if (!message) return res.status(200).send("No message");

  const phone = message.from;
  const userText = message.text?.body?.trim() || "";
  const lowerText = userText.toLowerCase();

  let { data: lead } = await supabase
    .from("leads_whatsapp")
    .select("*")
    .eq("phone", phone)
    .single();

  if (!lead) {
    const { data } = await supabase
      .from("leads_whatsapp")
      .insert([{ phone, stage: "ASK_NAME" }])
      .select()
      .single();

    lead = data;
  }

  let reply = "";

  // ===============================
  // 🎯 CONTROLE DE ESTADO
  // ===============================

  if (lead.stage === "ASK_NAME") {
    reply = "Com quem eu tenho o prazer de falar?";
    await supabase
      .from("leads_whatsapp")
      .update({ stage: "WAIT_NAME" })
      .eq("phone", phone);
  }

  else if (lead.stage === "WAIT_NAME") {
    await supabase
      .from("leads_whatsapp")
      .update({ name: userText, stage: "OFFER" })
      .eq("phone", phone);

    reply = `Prazer, ${userText}. Você quer conhecer a multipropriedade ou prefere viver a experiência primeiro?`;
  }

  else if (lead.stage === "OFFER") {

    if (
      lowerText.includes("restaurante") ||
      lowerText.includes("passeio") ||
      lowerText.includes("turismo") ||
      lowerText.includes("praia") ||
      lowerText.includes("instagram") ||
      lowerText.includes("região")
    ) {
      await supabase
        .from("leads_whatsapp")
        .update({ stage: "REGIONAL" })
        .eq("phone", phone);

      reply = "A Casa está na quadra do mar, cercada pelos melhores restaurantes e passeios de Prado. Você prefere algo mais gastronômico ou mais natureza quando viaja?";
    }

    else if (lowerText.includes("multi")) {
      await supabase
        .from("leads_whatsapp")
        .update({ stage: "MULTI" })
        .eq("phone", phone);

      reply = "São 2 semanas por ano em uma das 26 frações exclusivas. Valor R$ 64.890, com condição especial à vista por R$ 59.890 e prioridade no calendário. É para uso da família ou investimento?";
    }

    else if (
      lowerText.includes("hosped") ||
      lowerText.includes("diária")
    ) {
      await supabase
        .from("leads_whatsapp")
        .update({ stage: "HOSTING" })
        .eq("phone", phone);

      reply = "A experiência custa R$ 1.000 por diária, mínimo 2 noites, até 6 hóspedes. Qual período você tem interesse?";
    }

    else {
      reply = "Você prefere conhecer a multipropriedade ou viver a experiência primeiro?";
    }
  }

  else if (lead.stage === "REGIONAL") {
    reply = "Prado tem praias preservadas, gastronomia excelente e passeios incríveis. Você imagina usar mais em família ou também como investimento?";
  }

  else if (lead.stage === "MULTI") {
    reply = "Posso te enviar a apresentação completa agora. Prefere receber aqui ou quer agendar uma ligação rápida?";
  }

  else if (lead.stage === "HOSTING") {
    reply = "Me diga as datas desejadas e já verifico disponibilidade para você.";
  }

  else {
    // Fallback OpenAI inteligente
    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 120,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userText }
        ],
      }),
    });

    const data = await ai.json();
    reply = data?.choices?.[0]?.message?.content || "Perfeito. Me conta um pouco mais sobre o que você procura.";
  }

  // ===============================
  // 📤 ENVIO WHATSAPP
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
        to: phone,
        type: "text",
        text: { body: reply },
      }),
    }
  );

  return res.status(200).send("ok");
}
