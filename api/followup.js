import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const now = new Date();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("followup_sent", false);

  for (const lead of leads) {
    const diff = (now - new Date(lead.last_interaction)) / 1000 / 60;

    if (diff > 5 && lead.stage !== "encerrado") {
      await sendMessage(
        lead.phone,
        "Fico por aqui caso queira continuar 😊"
      );

      await supabase.from("leads").update({
        followup_sent: true
      }).eq("phone", lead.phone);
    }
  }

  res.status(200).send("ok");
}

async function sendMessage(phone, text) {
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
        text: { body: text },
      }),
    }
  );
}
