const { createClient } = require("@supabase/supabase-js");

// Aceita tanto os nomes novos quanto os antigos
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.URL_SUPABASE ||
  "";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.ANON_SECRET ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL/URL_SUPABASE or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getLeadByPhone(phone) {
  if (!phone) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("getLeadByPhone error:", error.message);
    return null;
  }

  return data || null;
}

async function upsertLead(lead) {
  if (!lead?.phone) {
    throw new Error("Lead sem phone para upsert");
  }

  const payload = {
    ...lead,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "phone" })
    .select()
    .single();

  if (error) {
    console.error("upsertLead error:", error.message);
    throw error;
  }

  return data;
}

module.exports = {
  supabase,
  getLeadByPhone,
  upsertLead
};
