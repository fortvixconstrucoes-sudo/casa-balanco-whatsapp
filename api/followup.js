import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

export default async function handler(req,res){

try{

const now = new Date()

const {data:leads} = await supabase
.from("leads")
.select("*")

for(const lead of leads){

const last = new Date(lead.last_message)

const diff = (now-last)/1000/60

if(diff > 5 && !lead.followup1){

await sendMessage(lead.phone,
"Oi 😊 só passando para saber se conseguiu ver minha última mensagem. Posso te ajudar com algo?"
)

await supabase
.from("leads")
.update({followup1:true})
.eq("phone",lead.phone)

}

if(diff > 20 && !lead.followup2){

await sendMessage(lead.phone,
"Fico à disposição caso queira conhecer a Casa Balanço do Mar ou entender como funciona a multipropriedade."
)

await supabase
.from("leads")
.update({followup2:true})
.eq("phone",lead.phone)

}

}

return res.status(200).send("ok")

}catch(err){

console.log(err)

return res.status(200).send("error")

}

}

async function sendMessage(phone,text){

await fetch(`https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,{

method:"POST",

headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},

body:JSON.stringify({
messaging_product:"whatsapp",
to:phone,
text:{body:text}
})

})

}
