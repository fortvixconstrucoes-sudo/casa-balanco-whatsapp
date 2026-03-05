import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req,res){

const now = new Date()

const { data: leads } = await supabase
.from('leads')
.select('*')

for (const lead of leads){

const last = new Date(lead.last_interaction)
const diff = (now - last) / 1000 / 60

if(diff > 60 && !lead.followup1_sent){

await sendMessage(lead.phone,
"Oi! Só passando para ver se você conseguiu olhar a apresentação da Casa Balanço do Mar 😊")

await supabase
.from('leads')
.update({followup1_sent:true})
.eq('phone',lead.phone)

}

if(diff > 720 && !lead.followup2_sent){

await sendMessage(lead.phone,
"Muita gente que fala comigo fica surpresa quando entende que a fração dá direito a duas semanas por ano na casa.")

await supabase
.from('leads')
.update({followup2_sent:true})
.eq('phone',lead.phone)

}

if(diff > 1440 && !lead.followup3_sent){

await sendMessage(lead.phone,
"Algumas frações estão sendo reservadas essa semana.")

await supabase
.from('leads')
.update({followup3_sent:true})
.eq('phone',lead.phone)

}

if(diff > 4320 && !lead.followup4_sent){

await sendMessage(lead.phone,
"Vou encerrar seu atendimento por aqui, mas se quiser retomar é só me chamar 😊")

await supabase
.from('leads')
.update({followup4_sent:true})
.eq('phone',lead.phone)

}

}

res.status(200).send("ok")

}
