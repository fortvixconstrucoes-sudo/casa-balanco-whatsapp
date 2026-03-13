async function sendWhatsAppText(toPhone, text) {

const token = process.env.WHATSAPP_TOKEN
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

const body = {
messaging_product: "whatsapp",
to: toPhone,
type: "text",
text: { body: text }
}

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
})

}

// ============================
// ENVIAR IMAGEM
// ============================

async function sendWhatsAppImage(toPhone, imageUrl){

const token = process.env.WHATSAPP_TOKEN
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

const body = {
messaging_product:"whatsapp",
to:toPhone,
type:"image",
image:{
link:imageUrl
}
}

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
})

}

// ============================
// ENVIAR VIDEO
// ============================

async function sendWhatsAppVideo(toPhone, videoUrl){

const token = process.env.WHATSAPP_TOKEN
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

const body = {
messaging_product:"whatsapp",
to:toPhone,
type:"video",
video:{
link:videoUrl
}
}

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
})

}

module.exports = {
sendWhatsAppText,
sendWhatsAppImage,
sendWhatsAppVideo
}
  return json;
}

module.exports = { sendWhatsAppText };
