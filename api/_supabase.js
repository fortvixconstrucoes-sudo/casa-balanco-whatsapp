const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =================================
// NORMALIZA TELEFONE
// =================================
function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

// =================================
// BUSCAR LEAD POR TELEFONE
// =================================
async function getLeadByPhone(phone) {
  const cleanPhone = normalizePhone(phone);

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (error) {
    console.error("SUPABASE getLeadByPhone ERROR:", error.message);
    return null;
  }

  return data || null;
}

// =================================
// CRIAR OU ATUALIZAR LEAD
// =================================
async function upsertLead(lead) {
  if (!lead || !lead.phone) {
    throw new Error("Lead phone is required");
  }

  const payload = {
    ...lead,
    phone: normalizePhone(lead.phone),
    buyer: lead.buyer || {},
    spouse: lead.spouse || {},
    purchase: lead.purchase || {},
    history: Array.isArray(lead.history) ? lead.history : [],
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, {
      onConflict: "phone"
    })
    .select()
    .single();

  if (error) {
    console.error("SUPABASE upsertLead ERROR:", error.message);
    throw error;
  }

  return data;
}

module.exports = {
  supabase,
  normalizePhone,
  getLeadByPhone,
  upsertLead
};
