function normalizeKey(value) {
  return String(value || "")
    .replace(/[\[\]'\"]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/[\[\]'\"]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickFirst(object, candidateKeys) {
  if (!object) return null;
  const candidates = candidateKeys.map(normalizeKey);
  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined || value === "") continue;
    if (candidates.includes(normalizeKey(key))) return value;
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setIfValue(target, key, value) {
  if (!key || value === null || value === undefined || value === "") return;
  target[key] = value;
}

function truncateText(value, maxLength = 100000) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

module.exports = { normalizeKey, humanizeKey, pickFirst, escapeHtml, setIfValue, truncateText };
