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

      // =====================================
      // FOLLOW-UP 1 — 1 HORA
      // =====================================
      if (diff > 60 && !lead.followup1_sent) {

        msg = `Oi 😊

Só passando para ver se você conseguiu olhar a apresentação da Casa Balanço do Mar.

Ela é uma casa completa em Prado que funciona no modelo de multipropriedade, onde cada família garante duas semanas por ano para usar a casa.

Se quiser, posso te mostrar também o vídeo da casa.`;

        field = "followup1_sent";
      }

      // =====================================
      // FOLLOW-UP 2 — 12 HORAS
      // =====================================
      else if (diff > 720 && !lead.followup2_sent) {

        msg = `Uma coisa que muita gente acha interessante é que cada fração garante:

• 2 semanas por ano  
• uma na alta temporada  
• uma na baixa temporada  

Então a família já tem a casa garantida todos os anos em Prado.

Você costuma viajar para praia quantas vezes por ano?`;

        field = "followup2_sent";
      }

      // =====================================
      // FOLLOW-UP 3 — 24 HORAS
      // =====================================
      else if (diff > 1440 && !lead.followup3_sent) {

        msg = `Muitas famílias de Minas e do Espírito Santo têm entrado nesse modelo justamente para garantir um lugar fixo de férias.

Em vez de pagar hotel ou aluguel todo ano, passam a ter direito a usar a casa.

Se fizer sentido para você, posso te explicar rapidamente como funciona para garantir sua fração.`;

        field = "followup3_sent";
      }

      // =====================================
      // FOLLOW-UP 4 — 3 DIAS
      // =====================================
      else if (diff > 4320 && !lead.followup4_sent) {

        msg = `Outro ponto importante é que a Casa Balanço do Mar possui apenas 26 frações.

Por isso normalmente quem decide primeiro consegue escolher melhor suas semanas de uso no calendário.

Se quiser, eu já posso te mostrar as condições atuais.`;

        field = "followup4_sent";
      }

      // =====================================
      // FOLLOW-UP 5 — 5 DIAS
      // =====================================
      else if (diff > 7200 && !lead.followup5_sent) {

        msg = `Vou encerrar seu atendimento para não te incomodar 😊

Mas se em algum momento quiser retomar a conversa ou conhecer melhor a casa, é só me chamar aqui.

Será um prazer te explicar tudo.`;

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
