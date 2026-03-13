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
}
