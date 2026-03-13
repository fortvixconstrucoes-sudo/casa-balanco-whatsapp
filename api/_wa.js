async function sendWhatsAppRequest(body){

const token = process.env.WHATSAPP_TOKEN
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE

if(!token) throw new Error("WHATSAPP_TOKEN missing")
if(!phoneNumberId) throw new Error("PHONE_NUMBER_ID missing")

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

const res = await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
})

const json = await res.json().catch(()=>({}))

if(!res.ok){
console.error("WhatsApp API error:",json)
throw new Error("WhatsApp send failed")
}

return json

}


// TEXTO
async function sendWhatsAppText(to,text){

return sendWhatsAppRequest({
messaging_product:"whatsapp",
to,
type:"text",
text:{body:text}
})

}


// IMAGEM
async function sendWhatsAppImage(to,imageUrl){

return sendWhatsAppRequest({
messaging_product:"whatsapp",
to,
type:"image",
image:{link:imageUrl}
})

}


// VIDEO
async function sendWhatsAppVideo(to,videoUrl){

return sendWhatsAppRequest({
messaging_product:"whatsapp",
to,
type:"video",
video:{link:videoUrl}
})

}

module.exports = {
sendWhatsAppText,
sendWhatsAppImage,
sendWhatsAppVideo
}
