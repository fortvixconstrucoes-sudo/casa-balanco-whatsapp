const { normalizeText } = require("./_agent");

function detectWeeksInterest(text) {
  const t = normalizeText(text);

  const weeks = [];

  if (/janeiro|jan/.test(t)) weeks.push("Janeiro");
  if (/fevereiro|fev/.test(t)) weeks.push("Fevereiro");
  if (/marco|março|mar/.test(t)) weeks.push("Março");
  if (/abril|abr/.test(t)) weeks.push("Abril");
  if (/maio/.test(t)) weeks.push("Maio");
  if (/junho|jun/.test(t)) weeks.push("Junho");
  if (/julho|jul/.test(t)) weeks.push("Julho");
  if (/agosto|ago/.test(t)) weeks.push("Agosto");
  if (/setembro|set/.test(t)) weeks.push("Setembro");
  if (/outubro|out/.test(t)) weeks.push("Outubro");
  if (/novembro|nov/.test(t)) weeks.push("Novembro");
  if (/dezembro|dez/.test(t)) weeks.push("Dezembro");

  return weeks;
}

function updateInterestScore(lead, detect) {
  let score = lead.score || 0;

  if (detect.price) score += 2;
  if (detect.invest) score += 3;
  if (detect.negotiation) score += 2;
  if (detect.buy) score += 6;

  if (score > 20) score = 20;

  lead.score = score;

  if (score >= 10) lead.interest_rank = "QUENTE";
  else if (score >= 5) lead.interest_rank = "MORNO";
  else lead.interest_rank = "FRIO";

  return lead;
}

function detectRegion(phone) {
  if (!phone) return "";

  if (phone.includes("31") || phone.includes("33")) return "MG";
  if (phone.includes("61")) return "BRASILIA";
  if (phone.includes("27")) return "ES";

  return "";
}

function buildDreamTrigger() {
  return `Deixa eu te fazer uma pergunta rápida 😊

Você imagina chegar em Prado com sua família sabendo que sua semana de praia já está garantida todos os anos?

Sem procurar hotel
Sem pagar diária alta na temporada
E com uma casa completa só para vocês.`;
}

function buildHotelComparison() {
  return `Hoje uma semana em uma boa pousada ou casa de praia em Prado pode passar de R$ 5.000 na temporada.

Em poucos anos isso já supera o investimento da fração.`;
}

function buildFamilyTrigger() {
  return `A maioria das famílias que entram nesse modelo são casais com filhos que gostam de ter um lugar fixo para viajar.

Assim as crianças crescem com memórias de praia e família todos os anos.`;
}

function buildDecisionQuestion() {
  return `Pelo que você viu até agora, faz mais sentido para você:

1️⃣ Garantir à vista e resolver tudo agora

ou

2️⃣ Parcelar para diluir o investimento?`;
}

module.exports = {
  detectWeeksInterest,
  updateInterestScore,
  detectRegion,
  buildDreamTrigger,
  buildHotelComparison,
  buildFamilyTrigger,
  buildDecisionQuestion
};
