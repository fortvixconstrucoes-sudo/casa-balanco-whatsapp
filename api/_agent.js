const { sendWhatsAppImage, sendWhatsAppText, sendWhatsAppVideo } = require("./_wa");

// =============================
// ESTÁGIOS DO FUNIL
// =============================

const stages = {
  novo: 0,
  curioso: 1,
  interessado: 2,
  avaliando: 3,
  negociando: 4,
  decisao: 5,
  fechamento: 6
};

function nowISO() {
  return new Date().toISOString();
}

function normalizeText(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// =============================
// 🔥 PERFIL DO CLIENTE (NOVO)
// =============================

function detectProfile(text = "") {
  const t = normalizeText(text);

  if (/familia|família|filho|esposa|marido|ferias|descansar/.test(t)) {
    return "familia";
  }

  if (/investimento|renda|retorno|alugar|valorizar|ganhar dinheiro/.test(t)) {
    return "investidor";
  }

  return "indefinido";
}

// =============================
// 🔥 ESCASSEZ REAL (NOVO)
// =============================

const TOTAL_FRACTIONS = 26;

function getRemainingFractions(lead) {
  if (!lead.soldFractions) {
    lead.soldFractions = 9; // você pode atualizar manualmente
  }
  return TOTAL_FRACTIONS - lead.soldFractions;
}

function clampHistory(history, max = 20) {
  const h = Array.isArray(history) ? history : [];
  return h.slice(-max);
}
// =============================
// DETECÇÕES
// =============================

function detectStage(text, lead) {
  const t = normalizeText(text);

  if (/comprar|fechar|reservar|pagar|contrato|assin|comprovante/.test(t)) {
    return "fechamento";
  }

  if (/parcelado|entrada|valor|preco|avista|a vista/.test(t)) {
    return "negociando";
  }

  if (/como funciona|multipropriedade|fracao|fração/.test(t)) {
    return "avaliando";
  }

  if (/foto|fotos|imagem|imagens|video|vídeo|tour|mostrar|ver/.test(t)) {
    return "interessado";
  }

  if (/oi|ola|bom dia|boa tarde|boa noite/.test(t)) {
    return "curioso";
  }

  return lead.stage || "novo";
}

function detectPurchaseIntent(text) {
  const t = normalizeText(text);
  return /\b(comprar|fechar|reservar|pagar|contrato|garantir|a vista|avista|parcelado|assinar)\b/.test(t);
}

function detectDocument(text) {
  const t = normalizeText(text);
  return /documento|rg|cpf|cnh|comprovante|assinad/.test(t);
}

function detectMediaInterest(text) {
  const t = normalizeText(text);
  return /\b(foto|fotos|imagem|imagens|video|vídeo|tour|mostrar|ver a casa|me mostra)\b/.test(t);
}

function isGreeting(txt) {
  const t = normalizeText(txt);
  return ["oi", "ola", "bom dia", "boa tarde", "boa noite"].includes(t);
}

function isAddressRequest(text = "") {
  const t = normalizeText(text);

  return (
    t.includes("endereco") ||
    t.includes("localizacao") ||
    t.includes("onde fica") ||
    t.includes("mapa") ||
    t.includes("bairro") ||
    t === "endereco" ||
    t === "mapa"
  );
}
// =============================
// MÍDIA
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
};

async function sendCasaMedia(phone) {
  await sendWhatsAppText(phone, "Vou te mostrar algumas imagens da Casa Balanço do Mar 😊");

  for (const banner of casaMedia.banners) {
    await sendWhatsAppImage(phone, banner);
  }

  await sendWhatsAppText(phone, "E aqui um vídeo rápido da casa 👇");
  await sendWhatsAppVideo(phone, casaMedia.video);
}

// =============================
// 🔥 MÍDIA AUTOMÁTICA
// =============================

async function maybeSendMedia(lead, userText) {
  if (!lead.sentMedia && detectMediaInterest(userText)) {
    lead.sentMedia = true;
    await sendCasaMedia(lead.phone);
    return true;
  }
  return false;
}
// =============================
// ESTRUTURA DO LEAD
// =============================

function ensureLeadStructures(lead) {
  lead.buyer = lead.buyer || {};
  lead.spouse = lead.spouse || {};
  lead.purchase = lead.purchase || {};
  lead.product = lead.product || {};

  lead.product.name = lead.product.name || "Casa Balanço do Mar";
  lead.product.fraction_value = lead.product.fraction_value || 59890;
  lead.product.maintenance_fee = lead.product.maintenance_fee || 250;
  lead.product.address =
    lead.product.address ||
    "Rua T17, Quadra 26, Lote 02B, Bairro Basevi, Prado – Bahia, CEP 45980-000";
  lead.product.map_link =
    lead.product.map_link ||
    "https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318";
  lead.product.max_guests = lead.product.max_guests || 6;

  return lead;
}

// =============================
// VALORES
// =============================

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// =============================
// PAGAMENTO
// =============================

function buildPaymentDataMessage() {
  return `💳 DADOS PARA PAGAMENTO

Banco: 336 - Banco C6 S.A.
Agência: 0001
Conta corrente: 25014352-6
CNPJ: 48.180.148/0001-81
Nome: NAURU BEACH RESIDENCE & HOTEL
Chave Pix: 48.180.148/0001-81`;
}
// =============================
// CAMPOS FALTANTES
// =============================

function spouseIsRequired(lead) {
  const marital = normalizeText(lead?.buyer?.marital_status || "");
  return /casado|casada|uniao estavel/.test(marital);
}

function getMissingBuyerFields(lead) {
  const b = lead.buyer || {};
  const missing = [];

  if (!b.full_name) missing.push("nome completo");
  if (!b.cpf) missing.push("CPF");
  if (!b.rg) missing.push("RG");
  if (!b.birth_date) missing.push("data de nascimento");
  if (!b.marital_status) missing.push("estado civil");
  if (!b.profession) missing.push("profissão");
  if (!b.street) missing.push("endereço");
  if (!b.city) missing.push("cidade");
  if (!b.state) missing.push("estado");
  if (!b.cep) missing.push("CEP");
  if (!b.phone) missing.push("telefone");
  if (!b.email) missing.push("e-mail");

  return missing;
}

function getMissingSpouseFields(lead) {
  if (!spouseIsRequired(lead)) return [];

  const s = lead.spouse || {};
  const missing = [];

  if (!s.full_name) missing.push("nome do cônjuge");
  if (!s.cpf) missing.push("CPF do cônjuge");
  if (!s.rg) missing.push("RG do cônjuge");

  return missing;
}

function buildMissingDataMessage(lead) {
  const missing = [...getMissingBuyerFields(lead), ...getMissingSpouseFields(lead)];

  if (!missing.length) return null;

  return `Preciso só desses dados pra finalizar:

• ${missing.join("\n• ")}`;
}

// =============================
// FICHA COMPLETA
// =============================

function buildContractFormText(lead) {
  ensureLeadStructures(lead);

  return `📄 FICHA DE RESERVA

Cliente: ${lead.buyer.full_name || "-"}

Imóvel: ${lead.product.name}

Valor: R$ ${formatMoney(lead.product.fraction_value)}

Taxa mensal: R$ ${formatMoney(lead.product.maintenance_fee)}

Uso:
• 2 semanas por ano
• 1 alta temporada
• 1 baixa temporada

Capacidade:
até ${lead.product.max_guests} pessoas

Após assinatura + pagamento → fração confirmada.`;
}
// =============================
// FOLLOWUP
// =============================

function buildFollowUp(lead) {
  if (lead.stage === "curioso") {
    return "Você chegou a ver as imagens da casa?";
  }

  if (lead.stage === "interessado") {
    return "O que achou da casa?";
  }

  if (lead.stage === "avaliando") {
    return "Quer que eu te explique melhor como funciona?";
  }

  if (lead.stage === "negociando") {
    return "Você prefere à vista ou parcelado?";
  }

  return "Posso te ajudar com algo?";
}

// =============================
// RECOVERY
// =============================

function buildRecoveryMessage() {
  return "Muita gente começa olhando e depois decide garantir.";
}
// =============================
// PROMPT DO CONSULTOR
// =============================

function buildSystemPrompt(lead) {
  ensureLeadStructures(lead);
  const remaining = getRemainingFractions(lead);

  return `
Você é um consultor especialista em multipropriedade.

Venda a Casa Balanço do Mar de forma natural.

Nunca diga que é IA.

Use linguagem simples, direta e humana.

Seja elegante, firme e inteligente.

Use:

• escassez
• visualização
• condução leve

INFORMAÇÕES:

Casa: ${lead.product.name}
Endereço: ${lead.product.address}

Valor: R$ ${formatMoney(lead.product.fraction_value)}

Restam apenas ${remaining} frações.

Capacidade: ${lead.product.max_guests} pessoas

Nunca force venda.
Sempre conduza.
`;
}
