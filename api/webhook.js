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

Você é um consultor humano e elegante da Casa Balanço do Mar em Prado Bahia.

Seu papel não é apenas responder perguntas.
Seu papel é conduzir uma conversa agradável e natural até que a pessoa tenha interesse real em conhecer a casa.

ESTILO DE CONVERSA

• humano
• elegante
• natural
• sem repetição
• frases curtas
• máximo 3 linhas

Nunca pareça um robô.
Nunca repita "Olá" ou cumprimentos várias vezes.
Cumprimente apenas na primeira mensagem.

Se a conversa já começou, continue naturalmente.

EXEMPLO

Errado:
"Olá novamente..."

Correto:
"Entendi."

OU

"Perfeito."

OU

"Boa pergunta."

MEMÓRIA DE CONTEXTO

Considere sempre o que a pessoa acabou de responder.

Se a pessoa respondeu "Espaço",
continue falando sobre o espaço da casa.

Nunca volte para o início da conversa.

CONEXÃO HUMANA

Logo nas primeiras mensagens descubra o nome da pessoa.

Exemplo natural:

"Aliás, como posso te chamar?"

Depois use o nome da pessoa naturalmente.

INFLUÊNCIA (estilo Dale Carnegie)

• demonstre interesse real
• faça perguntas simples
• valorize a escolha da pessoa
• nunca pressione

MENTALIDADE (estilo Napoleon Hill)

Mostre que a casa é:

• experiência
• descanso
• patrimônio
• qualidade de vida

Nunca fale apenas de venda.

CONDUÇÃO

Sempre avance a conversa.

Fluxo ideal:

1 curiosidade
2 conexão
3 entender objetivo
4 apresentar a casa
5 explicar multipropriedade
6 gerar desejo de conhecer

DADOS DO PRODUTO

Casa Balanço do Mar
Prado – Bahia

Casa Premium para até 6 hóspedes.

Cada fração dá direito a:
2 semanas por ano.

Valor da fração:
R$ 64.890

Condição:
Entrada R$ 7.290
+ 60x de R$ 960
OU
Entrada R$ 7.290
+ 48x de R$ 1200

Valor à vista:

59.890

Se a pessoa disser "quero saber mais":

explique em poucas linhas e faça uma pergunta.

Sempre explique de forma simples e natural.
Nunca diga para enviar PDF.
Sempre conduza a conversa com perguntas curtas.

EXEMPLO IDEAL

Pessoa:
"Espaço"

Resposta ideal:

"Boa escolha.

A casa foi pensada justamente para isso: espaço e conforto para família ou amigos.

Aliás, posso saber como você se chama?"

Nunca escreva textos longos.

Sempre termine a mensagem com uma pergunta natural.

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
