function normalizeAddressText(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAddressOnlyRequest(text = "") {
  const t = normalizeAddressText(text);

  if (!t) return false;

  return (
    t === "endereco" ||
    t === "qual endereco" ||
    t === "tem endereco" ||
    t === "me passa o endereco" ||
    t === "me passa endereco" ||
    t === "qual o endereco" ||
    t === "localizacao" ||
    t === "qual localizacao" ||
    t === "tem localizacao" ||
    t === "qual a localizacao" ||
    t === "onde fica" ||
    t === "qual bairro" ||
    t === "bairro" ||
    t === "mapa" ||
    t === "local" ||
    t.includes("endereco") ||
    t.includes("localizacao") ||
    t.includes("onde fica") ||
    t.includes("qual bairro") ||
    t.includes("mapa")
  );
}

const CASA_ADDRESS_TEXT = `📍 A Casa Balanço do Mar fica em:

Rua T17, Quadra 26, Lote 02B
Bairro Basevi
Prado – Bahia
CEP 45980-000`;

const CASA_MAP_TEXT = `Localização no mapa:
https://www.google.com/maps?q=-17.324118246682865,-39.22221224575318`;

async function replyAddress({ from, sendWhatsAppText }) {
  await sendWhatsAppText(from, CASA_ADDRESS_TEXT);
  await sendWhatsAppText(from, CASA_MAP_TEXT);
}

module.exports = {
  CASA_ADDRESS_TEXT,
  CASA_MAP_TEXT,
  isAddressOnlyRequest,
  replyAddress
};
