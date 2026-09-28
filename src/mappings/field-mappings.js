const config = require("../config");
const { loadJson } = require("./load-json");

const mappings = loadJson(config.fieldMappingFile, "CRM field mappings");

function getEntityMapping(entity) {
  const mapping = mappings[entity];
  if (!mapping?.entitySet || !mapping?.fields) {
    throw new Error(`Missing CRM mapping for entity: ${entity}`);
  }
  return mapping;
}

module.exports = { getEntityMapping };
