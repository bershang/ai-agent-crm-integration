const config = require("../config");
const { loadJson } = require("../mappings/load-json");
const { normalizeKey, humanizeKey, pickFirst, escapeHtml } = require("../utils/text");

const generationLabels = loadJson(config.generationLabelsFile, "generation labels");

function flattenCallForm(callForm) {
  const flat = {};
  for (const section of Object.values(callForm || {})) {
    if (!section || typeof section !== "object") continue;
    for (const [key, value] of Object.entries(section)) {
      if (value === null || value === undefined || value === "") continue;
      const normalized = normalizeKey(key);
      if (!flat[normalized]) flat[normalized] = value;
    }
  }
  return flat;
}

function normalizeCallForm(callForm) {
  return Object.entries(callForm || {}).map(([sectionKey, sectionValue]) => ({
    key: sectionKey,
    label: humanizeKey(sectionKey),
    fields: Object.entries(sectionValue || {})
      .filter(([key]) => !String(key).includes("['"))
      .map(([key, value]) => ({
        key,
        label: humanizeKey(key),
        value,
        type: typeof value === "boolean" ? "boolean" : value == null ? "empty" : "value"
      }))
  }));
}

function normalizeTranscript(payload) {
  const raw = payload?.transcript?.segments || [];
  const segments = Array.isArray(raw) ? raw : Object.values(raw);
  return segments
    .filter((segment) => segment && segment.text)
    .sort((a, b) => (a.start_time || 0) - (b.start_time || 0))
    .map((segment) => ({
      id: segment.id || segment.segment_id || null,
      speaker: segment.is_external ? "customer" : "agent",
      speaker_label: segment.is_external ? "Customer" : "Agent",
      text: String(segment.text),
      start_time: segment.start_time ?? null,
      end_time: segment.end_time ?? null,
      is_external: Boolean(segment.is_external)
    }));
}

function detectGenerationLabel(value, id) {
  const haystack = `${normalizeKey(id)} ${normalizeKey(value)}`;
  if (/csat|satisfaction|sentiment/.test(haystack)) return "Customer satisfaction";
  if (/next_step|follow_up|proximo|siguiente/.test(haystack)) return "Next steps";
  if (/summary|resumen|outcome|resultado/.test(haystack)) return "Interaction summary";
  if (/need|necesidad/.test(haystack)) return "Customer need";
  if (/solution|solucion/.test(haystack)) return "Proposed solution";
  return `Generation ${String(id || "unknown").slice(0, 12)}`;
}

function normalizeGenerations(payload) {
  const items = [];
  for (const [sourceKey, source] of [
    ["manual", payload?.generation_prompt_based],
    ["automation", payload?.automations]
  ]) {
    for (const [id, value] of Object.entries(source || {})) {
      items.push({
        id,
        source: sourceKey,
        label: generationLabels[id] || detectGenerationLabel(value, id),
        value
      });
    }
  }
  return items;
}

function findGeneration(generations, keywords) {
  const normalized = keywords.map(normalizeKey);
  return generations.find((item) => {
    const searchable = `${normalizeKey(item.id)} ${normalizeKey(item.label)} ${normalizeKey(item.value)}`;
    return normalized.some((keyword) => searchable.includes(keyword));
  })?.value || "";
}

function extractContactData(flatForm) {
  const fullName = pickFirst(flatForm, ["customer_name", "name", "nombre_cliente", "nombre"]);
  const first = pickFirst(flatForm, ["first_name", "primer_nombre"]);
  const last = pickFirst(flatForm, ["last_name", "family_name", "apellido"]);
  const email = pickFirst(flatForm, ["email", "email_address", "correo", "correo_electronico"]);
  const phone = pickFirst(flatForm, ["phone", "mobile", "telefono", "movil"]);

  let firstName = first || fullName || null;
  let lastName = last || null;
  if (fullName && !first && !last) {
    const parts = String(fullName).trim().split(/\s+/);
    firstName = parts[0] || null;
    lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  }

  return {
    firstName: firstName ? String(firstName) : null,
    lastName: lastName ? String(lastName) : null,
    email: email ? String(email) : null,
    phone: phone ? String(phone).replace(/\s+/g, "") : null
  };
}

function buildSummaryData(generations, flatForm, transcript) {
  const title = pickFirst(flatForm, ["title", "interaction_title", "titulo"]) || "";
  const customerNeed = pickFirst(flatForm, ["customer_need", "need", "necesidad_cliente"]) || "";
  const requiredServices = pickFirst(flatForm, ["required_services", "services", "servicios_requeridos"]) || "";
  const ownership = pickFirst(flatForm, ["ownership", "responsible_team", "responsable_gestion"]) || "";
  const challenges = pickFirst(flatForm, ["challenges", "main_challenge", "dificultad_principal"]) || "";
  const solutionProposed = pickFirst(flatForm, ["solution_proposed", "proposed_solution", "solucion_propuesta"]) || "";
  const interactionSummary = findGeneration(generations, ["interaction_summary", "summary", "resumen"]);
  const csat = findGeneration(generations, ["csat", "satisfaction", "sentiment"]);
  const nextSteps = findGeneration(generations, ["next_steps", "follow_up", "proximo", "siguiente"]);
  const firstCustomerLine = transcript.find((segment) => segment.speaker === "customer")?.text || "";

  return {
    title: String(title || customerNeed || firstCustomerLine || "AI-assisted interaction").slice(0, 100),
    interactionSummary,
    nextSteps,
    csat,
    opportunitySuggestions: {
      title: String(title || customerNeed || "AI-assisted opportunity").slice(0, 100),
      customerNeed,
      requiredServices,
      ownership,
      challenges,
      solutionProposed,
      nextSteps
    }
  };
}

function buildTranscriptHtml(transcript) {
  if (!transcript.length) return "";
  const rows = transcript.map((segment) =>
    `<div><strong>${escapeHtml(segment.speaker_label)}:</strong> ${escapeHtml(segment.text)}</div>`
  );
  return `<div>${rows.join("")}</div>`;
}

function normalizeInteractionPayload(payload) {
  const interactionId = payload.interaction_id || payload?.meta?.interaction_id || `interaction-${Date.now()}`;
  const callId = payload?.custom_callback_metadata?.call_id || payload?.meta?.forwarded_metadata?.call_id || null;
  const callForm = payload?.object_completions?.call_form || {};
  const flatForm = flattenCallForm(callForm);
  const transcript = normalizeTranscript(payload);
  const generations = normalizeGenerations(payload);

  return {
    interaction_id: String(interactionId).slice(0, 200),
    call_id: callId ? String(callId).slice(0, 200) : null,
    received_at: new Date().toISOString(),
    emitted_at: payload.emitted_at || null,
    call_ended: Boolean(payload.call_ended),
    update_count: 1,
    transcript,
    transcript_html: buildTranscriptHtml(transcript),
    diarized_text: String(payload.transcription_diarized_text || ""),
    fill_forms: normalizeCallForm(callForm),
    flat_form: flatForm,
    generations,
    contact: extractContactData(flatForm),
    summary: buildSummaryData(generations, flatForm, transcript)
  };
}

module.exports = { normalizeInteractionPayload };
