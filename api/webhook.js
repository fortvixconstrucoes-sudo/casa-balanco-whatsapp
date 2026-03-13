const { sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppText } = require("./_wa");
const { getLeadByPhone, upsertLead } = require("./_supabase");
const { generateReply, nowISO, clampHistory } = require("./_agent");

const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");


// =================================
// NORMALIZAÇÃO TEXTO
// =================================

function normalize(txt=""){
return txt
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
}


// =================================
// DOWNLOAD ARQUIVO WHATSAPP
// =================================

async function downloadWhatsAppFile(fileId){

const meta = await fetch(
`https://graph.facebook.com/v19.0/${fileId}`,
{
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`
}
})

const metaJson = await meta.json()

const file = await fetch(metaJson.url,{
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`
}
})

const buffer = await file.arrayBuffer()

return Buffer.from(buffer)

}


// =================================
// LER PDF
// =================================

async function readPDF(buffer){
const data = await pdf(buffer)
return data.text
}


// =================================
// OCR IMAGEM
// =================================

async function readImage(buffer){
const result = await Tesseract.recognize(buffer,"por")
return result.data.text
}


// =================================
// EXTRAIR MENSAGEM
// =================================

function extractIncoming(body){

const entry = body?.entry?.[0]
const change = entry?.changes?.[0]
const value = change?.value

const msg = value?.messages?.[0]
const contact = value?.contacts?.[0]

const from = msg?.from
const type = msg?.type
const text = msg?.text?.body

const documentId = msg?.document?.id
const imageId = msg?.image?.id

const profileName = contact?.profile?.name

return{
from,
type,
text,
documentId,
imageId,
profileName
}

}


// =================================
// WEBHOOK
// =================================

module.exports = async (req,res)=>{

try{

// ===============================
// VERIFICAÇÃO META
// ===============================

if(req.method==="GET"){

const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

const mode=req.query["hub.mode"]
const token=req.query["hub.verify_token"]
const challenge=req.query["hub.challenge"]

if(mode==="subscribe" && token===verifyToken){
return res.status(200).send(challenge)
}

return res.status(403).send("Forbidden")

}

if(req.method!=="POST"){
return res.status(405).json({ok:false})
}

const body=req.body||{}

const{
from,
type,
text,
documentId,
imageId,
profileName
}=extractIncoming(body)

if(!from){
return res.status(200).json({ok:true})
}

let userText=text||""

const t=normalize(userText)


// ===============================
// MIDIA CASA
// ===============================

const banners=[
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
]

const videoCasa="https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4"

const mapLink="https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318"


// ===============================
// DETECÇÃO DE INTENÇÃO
// ===============================

const detect={

video:/video|vídeo|tour/.test(t),

photos:/foto|imagem/.test(t),

address:/endereco|onde fica|localizacao|mapa/.test(t),

price:/preco|valor|quanto custa/.test(t),

invest:/investir|retorno|renda/.test(t),

visit:/visitar|visita/.test(t),

buy:/quero comprar|quero fechar|vamos fechar|reservar/.test(t)

}


// ===============================
// CARREGAR LEAD
// ===============================

let lead=await getLeadByPhone(from)

if(!lead){

lead={
phone:from,
name:null,
stage:"novo",
score:0,
history:[],
sent_photos:false,
sent_video:false,
sent_map:false,
proposal_sent:false,
visit_offered:false,
last_message:nowISO()
}

}

if(!lead.name && profileName){
lead.name=profileName
}


// ===============================
// LEAD SCORING
// ===============================

if(detect.price) lead.score+=2
if(detect.invest) lead.score+=3
if(detect.buy) lead.score+=6

if(lead.score>=6) lead.stage="comprador"
else if(lead.score>=3) lead.stage="interessado"
else if(lead.score>=1) lead.stage="curioso"


// ===============================
// ENVIO VIDEO
// ===============================

if(detect.video){

if(!lead.sent_video){

await sendWhatsAppText(from,"Vou te mostrar um vídeo rápido da casa 😊")

await sendWhatsAppVideo(from,videoCasa)

lead.sent_video=true

}else{

await sendWhatsAppText(from,"Já te enviei o vídeo da casa anteriormente 😊")

}

await upsertLead(lead)

return res.status(200).json({ok:true})

}


// ===============================
// ENVIO FOTOS
// ===============================

if(detect.photos){

if(!lead.sent_photos){

await sendWhatsAppText(from,"Vou te mostrar algumas imagens da casa 👇")

for(const banner of banners){
await sendWhatsAppImage(from,banner)
}

lead.sent_photos=true

}else{

await sendWhatsAppText(from,"Já te mostrei algumas imagens da casa 😊")

}

await upsertLead(lead)

return res.status(200).json({ok:true})

}


// ===============================
// ENDEREÇO
// ===============================

if(detect.address){

await sendWhatsAppText(from,
`📍 A Casa Balanço do Mar fica em:

Rua T17, Quadra 16, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000`
)

await sendWhatsAppText(from,
`Localização no mapa:
${mapLink}`
)

lead.sent_map=true

await upsertLead(lead)

return res.status(200).json({ok:true})

}


// ===============================
// PROPOSTA AUTOMÁTICA
// ===============================

if(lead.stage==="comprador" && !lead.proposal_sent){

await sendWhatsAppText(from,
`Perfeito 😊

Vou te apresentar a proposta da fração:

Valor da fração: R$ 65.890

Valor à vista promocional:
R$ 59.890

Ou parcelado:

Entrada: R$ 7.290

36x de R$ 1.600  
48x de R$ 1.200  
60x de R$ 960

Cada fração garante:

• 2 semanas por ano  
• 1 semana alta temporada  
• 1 semana baixa temporada  

A casa acomoda até 6 pessoas.

Se fizer sentido para você, posso te explicar agora como garantir sua fração.`)

lead.proposal_sent=true

await upsertLead(lead)

}


// ===============================
// OFERECER VISITA
// ===============================

if(lead.stage==="interessado" && !lead.visit_offered){

await sendWhatsAppText(from,
`Se preferir também podemos agendar uma visita na casa em Prado para conhecer pessoalmente 😊`
)

lead.visit_offered=true

await upsertLead(lead)

}


// ===============================
// PROCESSAR DOCUMENTOS
// ===============================

if(type==="document" && documentId){

const buffer=await downloadWhatsAppFile(documentId)
const pdfText=await readPDF(buffer)

userText=`Cliente enviou documento para cadastro da fração.

Dados encontrados no documento:

${pdfText}

Verifique quais dados já foram enviados e peça apenas os que faltam.`

}

if(type==="image" && imageId){

const buffer=await downloadWhatsAppFile(imageId)
const imgText=await readImage(buffer)

userText=`Cliente enviou imagem com dados pessoais.

Dados encontrados:

${imgText}

Verifique quais informações já foram enviadas e peça apenas os dados faltantes.`

}


// ===============================
// HISTÓRICO
// ===============================

lead.history=clampHistory(
[
...(lead.history||[]),
{role:"user",content:userText,at:nowISO()}
],
18
)

lead.last_message=nowISO()

lead=await upsertLead(lead)


// ===============================
// IA
// ===============================

const reply=await generateReply({lead,userText})

lead.history=clampHistory(
[
...(lead.history||[]),
{role:"assistant",content:reply,at:nowISO()}
],
18
)

await upsertLead(lead)


// ===============================
// ENVIO RESPOSTA
// ===============================

const parts=reply.split("\n\n")

for(const part of parts){
if(part.trim()){
await sendWhatsAppText(from,part.trim())
}
}

return res.status(200).json({ok:true})

}catch(err){

console.error("WEBHOOK ERROR:",err)

return res.status(200).json({
ok:false,
error:err?.message
})

}

}
