const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, ".env"));

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const crmMode = String(process.env.CRM_MODE || "mock").trim().toLowerCase();
if (!["mock", "dynamics"].includes(crmMode)) {
  throw new Error('CRM_MODE must be either "mock" or "dynamics".');
}

module.exports = {
  rootDir,
  port: numberFromEnv("PORT", 3000),
  crmMode,
  apiToken: String(process.env.DEMO_API_TOKEN || ""),
  interactionTtlMinutes: numberFromEnv("INTERACTION_TTL_MINUTES", 30),
  fieldMappingFile: path.resolve(rootDir, process.env.CRM_FIELD_MAPPING_FILE || "config/field-mappings.json"),
  generationLabelsFile: path.resolve(rootDir, process.env.GENERATION_LABELS_FILE || "config/generation-labels.json"),
  dynamics: {
    baseUrl: String(process.env.DYNAMICS_BASE_URL || "").replace(/\/$/, ""),
    tenantId: String(process.env.DYNAMICS_TENANT_ID || ""),
    clientId: String(process.env.DYNAMICS_CLIENT_ID || ""),
    clientSecret: String(process.env.DYNAMICS_CLIENT_SECRET || "")
  }
};
