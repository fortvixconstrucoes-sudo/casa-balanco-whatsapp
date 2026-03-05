import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req,res){

try{

const now = new Date()

const { data: leads, error } = await supabase
.from('leads')
.select('*')

if(error){
console.log("Erro Supabase:", error)
return res.status(500).send("db error")
}

for (const lead of leads){

if(!lead.phone) continue

const last = new Date(lead.last_interaction)
const diff = (now - last) / 1000 / 60

// FOLLOWUP 1 — 1h
if(diff > 60 && !lead.followup1_sent){

await sendMessage(
lead.phone,
"Oi! Só passando para ver se você conseguiu olhar a apresentação da Casa Balanço do Mar 😊"
)

await supabase
.from('leads')
.update({followup1_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 2 — 12h
if(diff > 720 && !lead.followup2_sent){

await sendMessage(
lead.phone,
"Uma coisa que muitas pessoas acham interessante é que cada fração garante duas semanas por ano na casa em Prado."
)

await supabase
.from('leads')
.update({followup2_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 3 — 24h
if(diff > 1440 && !lead.followup3_sent){

await sendMessage(
lead.phone,
"Algumas frações estão sendo reservadas essa semana. Se quiser posso te mostrar quais ainda estão disponíveis."
)

await supabase
.from('leads')
.update({followup3_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 4 — 72h
if(diff > 4320 && !lead.followup4_sent){

await sendMessage(
lead.phone,
"Vou encerrar seu atendimento por aqui para não te incomodar. Mas se quiser retomar é só me chamar 😊"
)

await supabase
.from('leads')
.update({followup4_sent:true})
.eq('phone',lead.phone)

}

}

return res.status(200).send("ok")

}catch(err){

console.log("Erro followup:",err)
return res.status(500).send("error")

}

}
}

res.status(200).send("ok")

}
