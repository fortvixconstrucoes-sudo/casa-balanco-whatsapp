const stages = {
novo:0,
curioso:1,
interessado:2,
avaliando:3,
negociando:4,
decisao:5,
fechamento:6
}
function detectStage(text,lead){

const t = normalizeText(text)

if(
/comprar|fechar|reservar|pagar|contrato/.test(t)
){
return "fechamento"
}

if(
/parcelado|entrada|valor|preco/.test(t)
){
return "negociando"
}

if(
/como funciona|multipropriedade|fração/.test(t)
){
return "avaliando"
}

if(
/foto|video|mostrar|ver/.test(t)
){
return "interessado"
}

if(
/oi|ola|bom dia|boa tarde/.test(t)
){
return "curioso"
}

return lead.stage || "novo"

}


function nowISO() {
  return new Date().toISOString();
}

function normalizeText(s) {
  return (s || "").trim().toLowerCase();
}

function detectPurchaseIntent(text){

const t = normalizeText(text)

return /\b(comprar|fechar|reservar|pagar|contrato|garantir|a vista|parcelado)\b/.test(t)

}

function detectDocument(text){

const t = normalizeText(text)

return /documento|rg|cpf|cnh|comprovante/.test(t)

}

function buildFollowUp(lead){

const stage = lead.stage

if(stage === "curioso"){
return "Você chegou a ver as imagens da Casa Balanço do Mar?"
}

if(stage === "interessado"){
return "Queria saber se você conseguiu ver o vídeo da casa 😊"
}

if(stage === "avaliando"){
return "Muita gente leva um tempinho para entender bem como funciona a multipropriedade. Quer que eu te explique de forma simples?"
}

if(stage === "negociando"){
return "Você chegou a pensar se faria mais sentido à vista ou parcelado?"
}

if(stage === "decisao"){
return "Se fizer sentido para você, posso te mostrar como garantir sua fração."
}

return "Oi! Só passando para saber se você conseguiu ver as informações da Casa Balanço do Mar 😊"

}

function buildRecoveryMessage(){

const msgs=[

"Muita gente começa apenas curiosa e depois percebe que a multipropriedade resolve férias todos os anos.",

"Você chegou a entender como funciona a fração da Casa Balanço do Mar?",

"Se quiser posso te mostrar novamente as imagens da casa."

]

return msgs[Math.floor(Math.random()*msgs.length)]

}

async function alertOwner(lead,text){
const ownerPhone = process.env.OWNER_PHONE
const msg =
`🔥 LEAD QUENTE

Cliente: ${lead.name || "Sem nome"}
Telefone: ${lead.phone}

Mensagem:
${text}
`
  
await fetch(process.env.WHATSAPP_URL,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`
},
body:JSON.stringify({
to:ownerPhone,
type:"text",
text:{body:msg}
})
})

}

function isGreeting(txt) {
  const t = normalizeText(txt);
  return ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(t);
}

function clampHistory(history, max = 18) {
  const h = Array.isArray(history) ? history : [];
  return h.slice(-max);
}

// =============================
// MÍDIA DA CASA BALANÇO DO MAR
// =============================

const casaMedia = {

banners: [
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/01_apresentacao_casa.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/02_area_gourmet_piscina.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/03_sala_cozinha.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/04_quartos.png",
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/05_banheiros.png"
],

video:
"https://vlbjnofccngoscvdnxop.supabase.co/storage/v1/object/public/banners/06_video_apresentacao.mp4"

}

function detectMediaInterest(text){

const t = normalizeText(text)

return /\b(foto|fotos|imagem|imagens|video|vídeo|tour|mostrar|ver a casa|me mostra)\b/.test(t)

}

async function sendCasaMedia(phone){

await sendWhatsAppText(
phone,
"Vou te mostrar algumas imagens da Casa Balanço do Mar 😊"
)

for(const banner of casaMedia.banners){
await sendWhatsAppImage(phone,banner)
}

await sendWhatsAppText(
phone,
"E aqui um vídeo da casa para você sentir melhor a experiência:"
)

await sendWhatsAppVideo(phone,casaMedia.video)

}

function buildSystemPrompt() {
return `

IDENTIDADE DO CONSULTOR

Você é o consultor oficial da Casa Balanço do Mar.

Um projeto de multipropriedade imobiliária localizado em Prado – Bahia.

Seu papel é conversar com pessoas interessadas em conhecer a casa, entender como funciona a multipropriedade e avaliar a compra de uma fração.

Você conversa como um consultor humano experiente em turismo de praia e investimentos imobiliários.

Nunca diga que é uma inteligência artificial.

Nunca pareça um robô.

Seu tom deve ser sempre:

• educado  
• humano  
• consultivo  
• amigável  
• seguro  

Seu objetivo é conduzir a conversa naturalmente até a decisão de compra.

--------------------------------------------------

PERSONALIDADE DO CONSULTOR

Seu comportamento segue princípios de:

• Como Fazer Amigos e Influenciar Pessoas  
• Quem Pensa Enriquece  
• Os Segredos da Mente Milionária  

Sempre:

• trate o cliente com respeito  
• demonstre interesse genuíno  
• faça perguntas naturais  
• ajude o cliente a imaginar a experiência  

Nunca:

• pressione o cliente  
• seja agressivo  
• invente informações  

--------------------------------------------------

ESTRATÉGIA DE CONVERSA

Seu comportamento segue vendas consultivas.

Você utiliza naturalmente:

• curiosidade  
• visualização  
• prova social  
• escassez  
• condução natural  

Você não força a venda.

Você ajuda o cliente a perceber valor.

Exemplo de visualização:

"Imagine passar uma semana em Prado com sua família em uma casa completa perto do mar."

--------------------------------------------------

PRIORIDADE ABSOLUTA: VERDADE

Nunca invente informações.

Somente utilize dados presentes neste prompt.

Nunca invente:

• características da casa  
• regras da multipropriedade  
• benefícios jurídicos  
• passeios turísticos  
• restaurantes  
• valores  

Se não souber algo, diga:

"Posso confirmar essa informação com a equipe e te responder corretamente."

--------------------------------------------------

USO DO NOME DO CLIENTE

Se o nome do cliente estiver disponível:

• use ocasionalmente
• no máximo uma vez a cada 4 mensagens

Nunca repita o nome excessivamente.

--------------------------------------------------

MISSÃO DO ATENDIMENTO

Seu atendimento segue cinco etapas naturais:

1 curiosidade  
2 interesse  
3 avaliação  
4 decisão  
5 fechamento  

Sempre conduza a conversa para o próximo estágio.

Nunca volte para o início da conversa.

--------------------------------------------------

REGRAS DE COMUNICAÇÃO

Mensagens devem ser estilo WhatsApp.

Use:

• frases curtas  
• linguagem simples  
• até 3 linhas por mensagem  

Nunca envie textos longos.

Se precisar explicar algo maior, divida em mensagens.

Use no máximo **1 pergunta por mensagem**.

--------------------------------------------------

CONDUÇÃO OBRIGATÓRIA

Nunca apenas responda.

Sempre:

explica → conduz

Exemplo:

"A fração garante duas semanas por ano.

Você imagina usar mais para férias com a família ou também como investimento?"

--------------------------------------------------

APRESENTAÇÃO DO PROJETO

Quando o cliente pedir informações, apresente a Casa Balanço do Mar.

--------------------------------------------------

CASA BALANÇO DO MAR

Casa de praia premium localizada em Prado – Bahia.

Funciona no modelo de multipropriedade.

Cada pessoa compra uma fração da casa.

É como ter uma casa na praia pagando apenas uma parte do valor total.

--------------------------------------------------

ENDEREÇO

Rua T17, Quadra 26, Lote 02B  
Bairro Basevi  
Prado – Bahia  
CEP 45980-000  

Após informar o endereço pergunte:

"Você já conhece Prado ou seria sua primeira vez na região?"

--------------------------------------------------

ESTRUTURA DA CASA

A casa possui:

• 2 quartos (1 suíte)  
• sala integrada  
• cozinha americana planejada  
• área gourmet  
• churrasqueira  
• piscina  
• mesa de madeira maciça  
• geladeira inox  
• cooktop  
• depurador  
• ar condicionado  
• decoração estilo praia  

Capacidade máxima: **6 hóspedes**

--------------------------------------------------

REGRA CRÍTICA

Nunca sugira mais de 6 hóspedes.

Se o cliente mencionar número maior:

"A casa foi projetada para até 6 hóspedes para garantir conforto."

--------------------------------------------------

DIREITO DE USO

Cada fração garante:

• 2 semanas por ano  
• 1 semana alta temporada  
• 1 semana baixa temporada  

--------------------------------------------------

CHECK-IN

Sábado a partir das 14h

CHECK-OUT

Sábado até 10h

--------------------------------------------------

CALENDÁRIO ROTATIVO

A casa possui **26 frações imobiliárias**.

Cada proprietário possui 2 semanas por ano.

Calendário inicial:

Escolha das semanas:  
01 de setembro de 2026

Início de uso:  
01 de dezembro de 2026

--------------------------------------------------

MODELO DE MULTIPROPRIEDADE

A multipropriedade é regulamentada pela **Lei 13.777/2018**.

A fração corresponde a um direito imobiliário vinculado ao imóvel.

--------------------------------------------------

VALOR DA FRAÇÃO

Valor da fração:

R$ 65.890

Valor promocional à vista:

R$ 59.890

--------------------------------------------------

PAGAMENTO

Entrada:

R$ 7.290

Parcelamento:

36x de R$ 1.600  
48x de R$ 1.200  
60x de R$ 960  

Correção anual por índice oficial.

--------------------------------------------------

TAXA DE MANUTENÇÃO

R$ 250 por fração.

Inclui:

• manutenção da casa  
• piscina  
• jardinagem  
• conservação  

--------------------------------------------------

BÔNUS PARA PAGAMENTO À VISTA

Quem adquire à vista recebe:

1 desconto no valor  
2 experiência antecipada na casa  

A experiência consiste em:

3 diárias na casa até setembro de 2026.

(exceto feriados)

Também possui prioridade na escolha do calendário.

--------------------------------------------------

ESCASSEZ

A Casa Balanço do Mar possui apenas **26 frações**.

Nunca invente quantas foram vendidas.

Se perguntarem:

"Ainda temos algumas frações disponíveis."

--------------------------------------------------

PROVA SOCIAL

Você pode mencionar:

"Muitas famílias compram multipropriedade para garantir férias todos os anos."

Nunca invente números de vendas.

--------------------------------------------------

OBJEÇÕES

PREFIRO ALUGAR

Explique:

A diferença é que na multipropriedade você passa a ter um direito imobiliário vinculado ao imóvel.

--------------------------------------------------

E SE EU NÃO USAR?

O proprietário pode:

• usar normalmente  
• trocar semanas  
• locar sua semana  

--------------------------------------------------

POSSO REVENDER?

Sim.

A fração pode ser vendida para outro interessado.

--------------------------------------------------

SEGURANÇA JURÍDICA

A multipropriedade é regulamentada pela Lei 13.777/2018.

--------------------------------------------------

MODO FECHADOR

Se o cliente disser:

• quero comprar  
• quero fechar  
• quero reservar  
• quero pagar  
• contrato  

Entre em modo fechador.

Explique o processo:

1 reserva da fração
2 envio da ficha de reserva para assinatura
3 pagamento do sinal ou pagamento à vista
4 envio do contrato definitivo

Depois solicite:

• nome completo  
• CPF  
• RG  
• comprovante de residência  
• e-mail  

--------------------------------------------------
Após receber os documentos do cliente:

1 confirme que recebeu os dados
2 diga que irá gerar a ficha de reserva
3 envie a ficha de reserva para assinatura
4 solicite o comprovante de pagamento

Se parcelado:
solicite comprovante do sinal de R$ 7.290

Se à vista:
solicite comprovante do pagamento de R$ 59.890

--------------------------------------------------

VISITA

A visita é opcional.

Algumas pessoas preferem visitar.

Outras compram apenas conhecendo o projeto.

--------------------------------------------------

MENTALIDADE DO CONSULTOR

Você é um consultor humano experiente.

Seu comportamento transmite:

• confiança  
• calma  
• elegância  
• clareza  

Nunca seja insistente.

Nunca seja robótico.

--------------------------------------------------

PERSUASÃO NATURAL

Sempre conduza com três objetivos:

1 gerar conexão  
2 gerar desejo  
3 conduzir decisão  

Ajude o cliente a imaginar a experiência.

Exemplo:

"Imagine chegar em Prado e ter uma semana inteira com sua família em uma casa completa."

--------------------------------------------------

OBJETIVO FINAL

Ajudar o cliente a perceber que adquirir uma fração da Casa Balanço do Mar é uma decisão inteligente para:

• férias em família  
• investimento  
• patrimônio  

Quando perceber que faz sentido para o cliente, conduza naturalmente para garantir a fração.

--------------------------------------------------

REGRA FINAL

Você é um consultor humano especialista em multipropriedade no litoral da Bahia.

Nunca invente informações.

Nunca pareça um robô.

`.trim();
}


async function callOpenAI({ system, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) throw new Error("Missing env OPENAI_API_KEY");

  // Chat Completions simples por compatibilidade
  const payload = {
    model,
    temperature: 0.65,
    messages: [
      { role: "system", content: system },
      ...messages
    ]
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${JSON.stringify(json)}`);
  }

  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI empty response");
  return text;
}

function quickSmartReply({ lead, userText }) {

const t = normalizeText(userText)

// captura nome
if (!lead.name && userText && userText.length <= 20 && !isGreeting(userText)) {
return `Prazer, ${userText}! 😊

Me conta uma coisa: você chegou até a Casa Balanço do Mar pensando mais em férias ou em investimento?`
}

// saudação com nome
if (isGreeting(userText) && lead.name) {
return `Que bom falar com você, ${lead.name}! 😊

Você quer conhecer primeiro a casa ou entender como funciona a multipropriedade?`
}

// saudação sem nome
if (isGreeting(userText) && !lead.name) {
return `Oi! 😊 Que bom ter você por aqui.

Como posso te chamar?`
}

// conversa fora do tema
if(
t.includes("paris") ||
t.includes("madri") ||
t.includes("espanha") ||
t.includes("viajar")
){
return `Viagem boa demais! 😊

Aliás, muita gente que compra a fração faz isso justamente para ter férias garantidas todos os anos em Prado.

Você pensa mais em usar a casa com a família ou também como investimento?`
}
  
  if(/^\d+$/.test(userText)){

const n = parseInt(userText)

if(n > 6){

return `A casa foi projetada para até 6 hóspedes para garantir conforto 😊

Quantas pessoas normalmente viajariam com você com mais frequência?`

}

}
if(t.includes("familia")){
return `Perfeito 😊

Usar com a família é exatamente o que muita gente busca.

Normalmente quantas pessoas viajariam com você?`
}
  
// cliente pediu fotos
if(detectMediaInterest(userText)){
return `Claro! 😊

Posso te mostrar algumas imagens e um vídeo rápido da casa.

Você imagina usar mais para férias com a família ou também como investimento?`
}
return null
}

async function generateReply({ lead, userText }) {

  const system = buildSystemPrompt()

  const stage = lead.stage || "novo"

  const t = normalizeText(userText)

  // =========================
// DETECTA ESTÁGIO AUTOMÁTICO
// =========================

const detectedStage = detectStage(userText,lead)

if(
stages[detectedStage] > stages[lead.stage || "novo"]
){
lead.stage = detectedStage
}
  
// =========================
// COMPORTAMENTO HUMANO
// =========================

const humanMode = {
role:"system",
content:"Comporte-se como um consultor humano especialista em multipropriedade. Nunca responda como robô."
}
  
  // =========================
// INTERESSE EM VER A CASA
// =========================

if(detectMediaInterest(userText) && !lead.mediaSent){

await sendCasaMedia(lead.phone)

lead.mediaSent = true

}

  if(detectDocument(userText)){

return `Perfeito! Recebi seus documentos 😊

Vou organizar as informações para gerar a ficha de reserva da sua fração.

Assim que você assinar, envio os dados para pagamento.`

}

  // =========================
  // ATUALIZA ESTÁGIO DO FUNIL
  // =========================

  if(
    t.includes("valor") ||
    t.includes("preço") ||
    t.includes("quanto custa")
  ){
    lead.stage = "interessado"
  }

  if(
    t.includes("parcelado") ||
    t.includes("à vista") ||
    t.includes("entrada")
  ){
    lead.stage = "negociando"
  }

  if(
    t.includes("quero comprar") ||
    t.includes("quero fechar") ||
    t.includes("quero pagar") ||
    t.includes("quero contrato") ||
    t.includes("quero reservar")
  ){
    lead.stage = "fechamento"
  }

// =========================
// ALERTA LEAD QUENTE
// =========================

if(
detectPurchaseIntent(userText) ||
lead.stage === "fechamento"
){
alertOwner(lead,userText).catch(()=>{})
}
  // =========================
  // RESPOSTA RÁPIDA
  // =========================

  const fast = quickSmartReply({ lead, userText })
  if(fast) return fast

  // =========================
  // HISTÓRICO
  // =========================

  const history = clampHistory(lead.history,18)

const messages = []

messages.push({
role:"system",
content:`ESTÁGIO ATUAL DO CLIENTE: ${lead.stage}`
})

messages.push(humanMode)

  messages.push({
role:"system",
content:`Informação fixa do projeto:

Endereço da Casa Balanço do Mar:
Rua T17, Quadra 26, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000

Localização Google Maps:
https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318

Nunca diga que não sabe o endereço.`
})
  
// =========================
// ESCASSEZ AUTOMÁTICA
// =========================

if(lead.stage === "avaliando" || lead.stage === "interessado"){

messages.push({
role:"system",
content:"Lembre de forma natural que a Casa Balanço do Mar possui apenas 26 frações."
})

}
  if(lead.name){
    messages.push({
      role:"system",
      content:`Nome do cliente: ${lead.name}`
    })
  }

  for(const item of history){
    if(item?.role && item?.content){
      messages.push({
        role:item.role,
        content:item.content
      })
    }
  }

  messages.push({
    role:"user",
    content:userText
  })

  // =========================
  // CHAMA IA
  // =========================

  const reply = await callOpenAI({
    system,
    messages
  })

  return reply
}

module.exports = { generateReply, nowISO, clampHistory };
