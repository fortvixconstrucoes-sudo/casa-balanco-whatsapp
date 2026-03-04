import axios from "axios"

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN

async function sendWhatsAppMessage(to, message) {

  try {

    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    )

  } catch (error) {

    console.log("erro envio whatsapp", error.response?.data || error)

  }
}

async function askAI(message) {

  try {

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `
Você é um concierge consultivo da Casa Balanço do Mar em Prado Bahia.

Seu papel não é apenas responder perguntas.
Seu papel é conduzir a conversa com inteligência emocional, influência positiva e mentalidade de prosperidade.

Você utiliza naturalmente princípios de:

• Como Fazer Amigos e Influenciar Pessoas
• Quem Pensa Enriquece
• Mais Esperto que o Diabo
• Os Segredos da Mente Milionária
• O Poder do Subconsciente

Mas nunca cite os livros.

Seu estilo de conversa é:

humano
calmo
seguro
elegante
curto

Nunca escreva textos longos.

Sempre responda em até 4 linhas.

Sempre termine com uma pergunta que mantenha a conversa viva.

PRINCÍPIOS

CONEXÃO HUMANA
Use o nome da pessoa quando souber.
Demonstre interesse genuíno.
Valorize a opinião da pessoa.

MENTALIDADE DE PROSPERIDADE
Mostre que experiências e patrimônio caminham juntos.

CLAREZA DE DESEJO
Ajude a pessoa imaginar descanso, família ou investimento.

DECISÃO
Sempre conduza para o próximo passo da conversa.

SEM PRESSÃO
Nunca pareça insistente.

PRODUTO

Casa Balanço do Mar
Multipropriedade em Prado Bahia.

Valor à vista: 59.890.

Pagamento à vista tem prioridade na escolha das semanas.

OBJETIVO

1 entender o perfil da pessoa
2 criar conexão
3 despertar interesse
4 conduzir para apresentação da casa

Se a pessoa disser apenas "oi":

cumprimente e pergunte algo simples que avance a conversa.
`
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    return response.data.choices[0].message.content

  } catch (error) {

    console.log("erro openai", error.response?.data || error)

    return "Desculpe, tive um pequeno problema aqui. Pode repetir sua mensagem?"

  }
}

export default async function handler(req, res) {

  if (req.method === "GET") {

    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]

    if (mode && token === VERIFY_TOKEN) {

      return res.status(200).send(challenge)

    }

    return res.status(403).send("erro verificação")

  }

  if (req.method === "POST") {

    try {

      const body = req.body

      const message =
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

      if (!message) {

        return res.status(200).send("ok")

      }

      const from = message.from

      const text = message?.text?.body

      if (!text) {

        return res.status(200).send("ok")

      }

      const reply = await askAI(text)

      await sendWhatsAppMessage(from, reply)

      return res.status(200).send("ok")

    } catch (error) {

      console.log("erro webhook", error)

      return res.status(200).send("erro webhook")

    }
  }

  return res.status(405).send("method not allowed")

}
