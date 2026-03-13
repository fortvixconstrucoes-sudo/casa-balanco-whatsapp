async function sendWhatsAppText(toPhone, text) {

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE;

if (!token) throw new Error("Missing env WHATSAPP_TOKEN");
if (!phoneNumberId) throw new Error("Missing env ID_DO_NUMERO_DE_TELEFONE");

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

const body = {
messaging_product: "whatsapp",
to: toPhone,
type: "text",
text: { body: text }
};

const res = await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
});

const json = await res.json().catch(()=>({}));

if(!res.ok){
throw new Error(`WhatsApp send error: ${res.status} ${JSON.stringify(json)}`);
}

return json;
}


async function sendWhatsAppImage(toPhone, imageUrl, caption = "") {

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE;

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

const body = {
messaging_product: "whatsapp",
to: toPhone,
type: "image",
image: {
link: imageUrl,
caption: caption
}
};

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
});

}


async function sendWhatsAppVideo(toPhone, videoUrl, caption = "") {

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.ID_DO_NUMERO_DE_TELEFONE;

const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

const body = {
messaging_product: "whatsapp",
to: toPhone,
type: "video",
video: {
link: videoUrl,
caption: caption
}
};

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify(body)
});

}


module.exports = {
sendWhatsAppText,
sendWhatsAppImage,
sendWhatsAppVideo
};
  return json;
}

module.exports = { sendWhatsAppText };
