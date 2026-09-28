const { getEntityMapping } = require("./field-mappings");
const { pickFirst, setIfValue, truncateText } = require("../utils/text");

function buildTaskPatch(clean) {
  const { fields } = getEntityMapping("task");
  const patch = {};
  setIfValue(patch, fields.subject, clean.summary.title);
  setIfValue(patch, fields.firstName, clean.contact.firstName);
  setIfValue(patch, fields.lastName, clean.contact.lastName);
  setIfValue(patch, fields.email, clean.contact.email);
  setIfValue(patch, fields.phone, clean.contact.phone);
  setIfValue(patch, fields.csat, clean.summary.csat);
  setIfValue(patch, fields.summary, clean.summary.interactionSummary);
  setIfValue(patch, fields.title, clean.summary.title);
  setIfValue(patch, fields.transcription, truncateText(clean.transcript_html || clean.diarized_text, 100000));
  return patch;
}

function buildCasePatch(clean) {
  const { fields } = getEntityMapping("case");
  const patch = {};
  setIfValue(patch, fields.interactionSummary, clean.summary.interactionSummary);
  setIfValue(patch, fields.criticalPoints, pickFirst(clean.flat_form, ["critical_points", "puntos_criticos"]));
  setIfValue(patch, fields.bestAction, pickFirst(clean.flat_form, ["best_action", "mejor_accion"]));
  setIfValue(patch, fields.nextSteps, clean.summary.nextSteps);
  return patch;
}

function buildOpportunityPatch(clean, requestedFields = []) {
  const { fields } = getEntityMapping("opportunity");
  const suggestions = clean.summary.opportunitySuggestions || {};
  const selected = requestedFields.length ? requestedFields : Object.keys(fields);
  const patch = {};
  for (const field of selected) {
    if (!fields[field]) continue;
    setIfValue(patch, fields[field], suggestions[field]);
  }
  return patch;
}

module.exports = { buildTaskPatch, buildCasePatch, buildOpportunityPatch };
