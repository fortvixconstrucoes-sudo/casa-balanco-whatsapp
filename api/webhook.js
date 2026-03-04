import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req,res){

if(req.method !== "POST"){
return res.status(200).send("ok")
}

try{

const body = req.body

const message =
body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!message){
return res.status(200).send("no message")
}

const phone = message.from
const text = message.text?.body || ""

if(!phone || !text){
return res.status(200).send("invalid")
}

let {data:lead} = await supabase
.from("leads")
.select("*")
.eq("phone",phone)
.maybeSingle()

if(!lead){

const {data:newLead} = await supabase
.from("leads")
.insert({
phone:phone,
stage:"novo",
history:[],
last_message:new Date()
})
.select()
.single()

lead=newLead

}

let stage = lead.stage || "novo"
let history = lead.history || []
let name = lead.name || null

history.push({
role:"user",
content:text
})

const systemPrompt = `

Você é concierge da Casa Balanço do Mar em Prado Bahia.

Seu objetivo é conversar de forma humana, educada e natural.

Regras obrigatórias:

Nunca responda com textos longos.

Nunca repita perguntas.

Sempre responda em até 4 linhas.

Se a pessoa disser apenas "oi" ou "olá":

Cumprimente com gentileza e peça o nome.

Use técnicas de influência:

Mostre interesse verdadeiro.

Use o nome da pessoa quando souber.

Faça perguntas simples.

Nunca pareça robô.

Nunca despeje informações.

Conduza a conversa naturalmente.

Produto:

Multipropriedade Casa Balanço do Mar.

Valor à vista: 59.890.

Pagamento à vista tem prioridade de escolha no calendário anual.

Se perceber interesse:

Convide para receber apresentação ou áudio explicativo.

`

const completion = await openai.chat.completions.create({

model:"gpt-4o-mini",

temperature:0.7,

messages:[
{role:"system",content:systemPrompt},
...history
]

})

const reply = completion.choices[0].message.content

history.push({
role:"assistant",
content:reply
})

if(stage === "novo"){
stage="aguardando_nome"
}

if(stage === "aguardando_nome" && !name){
name=text
stage="qualificando"
}

await supabase
.from("leads")
.update({
stage:stage,
name:name,
history:history,
last_message:new Date()
})
.eq("phone",phone)

await fetch(`https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,{

method:"POST",

headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},

body:JSON.stringify({
messaging_product:"whatsapp",
to:phone,
text:{body:reply}
})

})

return res.status(200).send("ok")

}catch(err){

console.log("erro webhook",err)

return res.status(200).send("error")

}

}
