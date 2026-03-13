async function sendWhatsAppRequest(body){

const token = process.env.WHATSAPP_TOKEN
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

const res = await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
})

return res.json()

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
