const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
process.env.URL_SUPABASE,
process.env.SUPABASE_ANON_KEY,
{ auth:{persistSession:false} }
);


async function getLeadByPhone(phone){

const {data,error} = await supabase
.from("leads")
.select("*")
.eq("phone",phone)
.maybeSingle()

if(error) throw error

return data || null

}


async function upsertLead(lead){

const payload = {
phone:lead.phone,
name:lead.name || null,
stage:lead.stage || "novo",
history:lead.history || [],
last_message:lead.last_message || new Date().toISOString(),
followup1:!!lead.followup1,
followup2:!!lead.followup2
}

const {data,error} = await supabase
.from("leads")
.upsert(payload,{onConflict:"phone"})
.select("*")
.single()

if(error) throw error

return data

}


async function listLeadsForFollowup(){

const cutoff = new Date(
Date.now() - 1000*60*60*24*2
).toISOString()

const {data,error} = await supabase
.from("leads")
.select("*")
.lt("last_message",cutoff)
.eq("followup1",false)
.limit(50)

if(error) throw error

return data || []

}

module.exports = {
getLeadByPhone,
upsertLead,
listLeadsForFollowup
}const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.URL_SUPABASE || process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

function buildDefaultLead(phone) {
  return {
    phone,
    name: null,
    stage: "novo",
    score: 0,
    history: [],
    last_message: new Date().toISOString(),

    sent_photos: false,
    sent_video: false,
    sent_map: false,
    proposal_sent: false,
    visit_offered: false,
    contract_sent: false,
    payment_requested: false,
    payment_proof_requested: false,
    signed_form_requested: false,
    media_sent: false,

    followup1_sent: false,
    followup2_sent: false,
    followup3_sent: false,
    followup4_sent: false,
    followup5_sent: false,

    buyer: {
      full_name: null,
      cpf: null,
      rg: null,
      birth_date: null,
      marital_status: null,
      profession: null,
      street: null,
      city: null,
      state: null,
      cep: null,
      phone: null,
      email: null
    },

    spouse: {
      full_name: null,
      cpf: null,
      rg: null,
      marital_status: null,
      property_regime: null
    },

    purchase: {
      payment_mode: null, // avista | parcelado
      entry_value: null,
      installments: null,
      installment_value: null,
      fraction_code: null
    },

    product: {
      name: "Casa Balanço do Mar",
      fraction_value: 59890,
      maintenance_fee: 250,
      address:
        "Rua T17, Quadra 26, Lote 02B, Bairro Basevi, Prado – Bahia, CEP 45980-000",
      map_link: "https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318",
      max_guests: 6
    }
  };
}

function mergeLead(base, dbLead) {
  const merged = {
    ...base,
    ...(dbLead || {})
  };

  merged.buyer = {
    ...base.buyer,
    ...(dbLead?.buyer || {})
  };

  merged.spouse = {
    ...base.spouse,
    ...(dbLead?.spouse || {})
  };

  merged.purchase = {
    ...base.purchase,
    ...(dbLead?.purchase || {})
  };

  merged.product = {
    ...base.product,
    ...(dbLead?.product || {})
  };

  merged.history = Array.isArray(dbLead?.history) ? dbLead.history : [];
  return merged;
}

async function getLeadByPhone(phone) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;

  return mergeLead(buildDefaultLead(phone), data || null);
}

async function upsertLead(lead) {
  const payload = {
    phone: lead.phone,
    name: lead.name || null,
    stage: lead.stage || "novo",
    score: Number.isFinite(lead.score) ? lead.score : 0,
    history: Array.isArray(lead.history) ? lead.history : [],
    last_message: lead.last_message || new Date().toISOString(),

    sent_photos: !!lead.sent_photos,
    sent_video: !!lead.sent_video,
    sent_map: !!lead.sent_map,
    proposal_sent: !!lead.proposal_sent,
    visit_offered: !!lead.visit_offered,
    contract_sent: !!lead.contract_sent,
    payment_requested: !!lead.payment_requested,
    payment_proof_requested: !!lead.payment_proof_requested,
    signed_form_requested: !!lead.signed_form_requested,
    media_sent: !!lead.media_sent,

    followup1_sent: !!lead.followup1_sent,
    followup2_sent: !!lead.followup2_sent,
    followup3_sent: !!lead.followup3_sent,
    followup4_sent: !!lead.followup4_sent,
    followup5_sent: !!lead.followup5_sent,

    buyer: lead.buyer || {},
    spouse: lead.spouse || {},
    purchase: lead.purchase || {},
    product: lead.product || {}
  };

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "phone" })
    .select("*")
    .single();

  if (error) throw error;

  return mergeLead(buildDefaultLead(lead.phone), data);
}

async function listLeadsForFollowup() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .limit(200);

  if (error) throw error;

  return data || [];
}

module.exports = {
  supabase,
  buildDefaultLead,
  getLeadByPhone,
  upsertLead,
  listLeadsForFollowup
};
