const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
)

async function sendMessage(phone, text){

await fetch(process.env.WHATSAPP_URL,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`
},
body:JSON.stringify({
to:phone,
type:"text",
text:{body:text}
})
})

}

export default async function handler(req,res){

try{

const now = new Date()

const { data: leads } = await supabase
.from('leads')
.select('*')

for(const lead of leads){

if(!lead.phone) continue

const last = new Date(lead.last_message)
const diff = (now - last) / 1000 / 60

let msg = null

// FOLLOWUP 1 — 1h
if(diff > 60 && !lead.followup1_sent){

msg = "Oi! Só passando para ver se você conseguiu olhar a apresentação da Casa Balanço do Mar 😊"

await supabase
.from('leads')
.update({followup1_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 2 — 12h
else if(diff > 720 && !lead.followup2_sent){

msg = "Uma coisa que muita gente acha interessante é que cada fração garante duas semanas por ano na casa em Prado."

await supabase
.from('leads')
.update({followup2_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 3 — 24h
else if(diff > 1440 && !lead.followup3_sent){

msg = "Algumas frações estão sendo reservadas essa semana. Se quiser posso te mostrar quais ainda estão disponíveis."

await supabase
.from('leads')
.update({followup3_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 4 — 72h
else if(diff > 4320 && !lead.followup4_sent){

msg = "Se quiser posso te mostrar também como funciona para garantir uma fração."

await supabase
.from('leads')
.update({followup4_sent:true})
.eq('phone',lead.phone)

}

// FOLLOWUP 5 — 5 dias
else if(diff > 7200 && !lead.followup5_sent){

msg = "Vou encerrar seu atendimento para não te incomodar. Mas se quiser retomar é só me chamar 😊"

await supabase
.from('leads')
.update({followup5_sent:true})
.eq('phone',lead.phone)

}

if(msg){

await sendMessage(lead.phone,msg)

}

}

return res.status(200).send("ok")

}catch(err){

console.log(err)

return res.status(500).send("error")

}

}
