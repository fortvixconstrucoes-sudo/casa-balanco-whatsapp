export default async function handler(req, res) {

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.ID_DO_NUMERO_DE_TELEFONE
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN


async function sendWhatsAppMessage(to, message){

try{

console.log("ENVIANDO PARA:",to)

const response = await fetch(
`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
{
method:"POST",
headers:{
"Authorization":`Bearer ${WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:to,
type:"text",
text:{ body:message }
})
}
)

const data = await response.json()

console.log("RESPOSTA WHATSAPP:",data)

}catch(error){

console.log("ERRO ENVIO WHATSAPP:",error)

}

}



async function askAI(text){

try{

const response = await fetch("https://api.openai.com/v1/chat/completions",{

method:"POST",

headers:{
"Authorization":`Bearer ${OPENAI_API_KEY}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

model:"gpt-4o-mini",

temperature:0.7,

messages:[

{
role:"system",

content:`

Você é um concierge humano da Casa Balanço do Mar em Prado Bahia.

Seu comportamento é inspirado em:

Como influenciar pessoas
Quem pensa enriquece
Segredos da mente milionária
O poder do subconsciente
Mais esperto que o diabo

Você não cita os livros.

ESTILO

• humano
• natural
• elegante
• curto
• inteligente

Nunca escreva mais de 4 linhas.

Evite repetição.

Sempre termine com uma pergunta que mova a conversa.

OBJETIVO

Entender o perfil da pessoa
Criar conexão
Despertar interesse
Conduzir para conhecer a casa

PRODUTO

Casa Balanço do Mar
Multipropriedade em Prado Bahia

Valor à vista: 59.890

Cada fração dá direito a 2 semanas por ano.

Se a pessoa disser apenas "oi":

Cumprimente
e pergunte se ela quer conhecer a casa ou saber como funciona.

`

},

{
role:"user",
content:text
}

]

})

})

const data = await response.json()

return data.choices[0].message.content

}catch(error){

console.log("ERRO OPENAI:",error)

return "Oi! Tudo bem? 😊 Posso te explicar rapidamente como funciona a Casa Balanço do Mar em Prado?"

}

}



if(req.method==="GET"){

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode==="subscribe" && token===VERIFY_TOKEN){

return res.status(200).send(challenge)

}

return res.status(403).send("erro verificação")

}



if(req.method==="POST"){

try{

const body = req.body

console.log("BODY RECEBIDO:",JSON.stringify(body,null,2))

const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!message){

return res.status(200).send("ok")

}

const from = message.from
const text = message?.text?.body

console.log("MENSAGEM:",text)
console.log("USUARIO:",from)

if(!text){

return res.status(200).send("ok")

}

const reply = await askAI(text)

console.log("RESPOSTA IA:",reply)

await sendWhatsAppMessage(from,reply)

return res.status(200).send("ok")

}catch(error){

console.log("ERRO WEBHOOK:",error)

return res.status(200).send("erro")

}

}



return res.status(405).send("method not allowed")

}
