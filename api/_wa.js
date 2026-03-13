// ======================================
// ENVIO DE MENSAGEM TEXTO
// ======================================

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


// ======================================
// ENVIO DE IMAGEM
// ======================================

async function sendWhatsAppImage(toPhone, imageUrl) {

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


// ======================================
// ENVIO DE VIDEO
// ======================================

async function sendWhatsAppVideo(toPhone, videoUrl) {

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


// ======================================
// EXPORTAÇÃO
// ======================================

module.exports = {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppVideo
}
