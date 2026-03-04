const { createClient } = require("@supabase/supabase-js");

function supabase() {
  const url = process.env.URL_SUPABASE;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing: URL_SUPABASE / SUPABASE_ANON_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getLeadByPhone(phone) {
  const sb = supabase();
  const { data, error } = await sb.from("leads").select("*").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertLead(lead) {
  const sb = supabase();
  const payload = {
    phone: lead.phone,
    name: lead.name || null,
    stage: lead.stage || "novo",
    history: lead.history || [],
    last_message: lead.last_message || new Date().toISOString(),
    followup1: !!lead.followup1,
    followup2: !!lead.followup2
  };

  const { data, error } = await sb
    .from("leads")
    .upsert(payload, { onConflict: "phone" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function listLeadsForFollowup() {
  const sb = supabase();
  // segue simples: pega quem tem last_message antigo e ainda não recebeu followup1
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(); // 2 dias
  const { data, error } = await sb
    .from("leads")
    .select("*")
    .lt("last_message", cutoff)
    .eq("followup1", false)
    .limit(50);

  if (error) throw error;
  return data || [];
}

module.exports = { getLeadByPhone, upsertLead, listLeadsForFollowup };
