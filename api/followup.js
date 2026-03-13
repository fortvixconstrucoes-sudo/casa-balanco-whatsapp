const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.URL_SUPABASE,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function sendMessage(phone, text) {
  await fetch(process.env.WHATSAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      to: phone,
      type: "text",
      text: { body: text }
    })
  });
}

module.exports = async function handler(req, res) {
  try {
    const now = new Date();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .limit(300);

    if (error) throw error;

    for (const lead of leads || []) {
      if (!lead.phone) continue;

      const last = new Date(lead.last_message);
      const diff = (now - last) / 1000 / 60;

      let msg = null;
      let field = null;

      if (diff > 60 && !lead.followup1_sent) {
        msg = "Oi! Só passando para ver se você conseguiu olhar a apresentação da Casa Balanço do Mar 😊";
        field = "followup1_sent";
      } else if (diff > 720 && !lead.followup2_sent) {
        msg = "Uma coisa que muita gente acha interessante é que cada fração garante 2 semanas por ano na casa em Prado.";
        field = "followup2_sent";
      } else if (diff > 1440 && !lead.followup3_sent) {
        msg = "Se fizer sentido para você, eu também posso te mostrar agora como garantir sua fração.";
        field = "followup3_sent";
      } else if (diff > 4320 && !lead.followup4_sent) {
        msg = "Se quiser, eu já posso deixar sua ficha pronta para conferência e assinatura.";
        field = "followup4_sent";
      } else if (diff > 7200 && !lead.followup5_sent) {
        msg = "Vou encerrar seu atendimento para não te incomodar. Mas se quiser retomar, é só me chamar 😊";
        field = "followup5_sent";
      }

      if (msg && field) {
        await sendMessage(lead.phone, msg);

        await supabase
          .from("leads")
          .update({ [field]: true })
          .eq("phone", lead.phone);
      }
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error(err);
    return res.status(500).send("error");
  }
};
