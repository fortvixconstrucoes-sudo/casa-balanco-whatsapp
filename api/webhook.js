import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("ok");
  }

  try {
    const body = req.body;
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.status(200).send("ok");

    const userText = message.text?.body?.trim();
    const phone = message.from;

    if (!userText) return res.status(200).send("ok");

    let { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!lead) {
      const { data } = await supabase
        .from("leads")
        .insert({
          phone,
          stage: "novo",
          history: []
        })
        .select()
        .single();

      lead = data;
    }

    let history = lead.history || [];
    let stage = lead.stage;
    let name = lead.name;

    // 🔒 BLOQUEIO DE REPETIÇÃO
    const lastBotMessage = history.length > 0
      ? history[history.length - 1]
      : null;

    // Atualiza interação
    await supabase.from("leads").update({
      last_interaction: new Date(),
      followup_sent: false
    }).eq("phone", phone);

    history.push({ role: "user", content: userText });

    let systemPrompt = `
Você é concierge estratégico da Casa Balanço do Mar.

REGRAS ABSOLUTAS:
- Nunca repita pergunta já feita.
- Nunca peça o nome se já souber.
- Nunca volte para estágio anterior.
- Respostas curtas (máx 4 linhas).
- Sempre avance a conversa.
- Use o nome se existir.
- Seja humano, elegante, gentil.
- Interesse genuíno.
- Faça perguntas abertas estratégicas.
- Valorize a pessoa.
- Não seja robô.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        ...history
      ]
    });

    const reply = completion.choices[0].message.content;

    history.push({ role: "assistant", content: reply });

    // 🔄 CONTROLE DE ESTÁGIO DEFINITIVO

    if (stage === "novo") {
      stage = "aguardando_nome";
    } else if (stage === "aguardando_nome" && !name) {
      name = userText;
      stage = "qualificando";
    } else if (stage === "qualificando") {
      stage = "apresentacao";
    }

    await supabase.from("leads").update({
      history,
      stage,
      name
    }).eq("phone", phone);

    await fetch(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          text: { body: reply },
        }),
      }
    );

    return res.status(200).send("ok");

  } catch (err) {
    console.error(err);
    return res.status(200).send("error");
  }
}
