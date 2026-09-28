const path = require("path");
const express = require("express");
const config = require("./config");
const { createTokenMiddleware } = require("./auth/require-token");
const { normalizeInteractionPayload } = require("./interactions/normalize");
const { InteractionStore } = require("./interactions/store");
const { getEntityMapping } = require("./mappings/field-mappings");
const { buildTaskPatch, buildCasePatch, buildOpportunityPatch } = require("./mappings/patch-builders");
const { createCrmClient } = require("./crm");

const app = express();
const store = new InteractionStore(config.interactionTtlMinutes);
const crm = createCrmClient();
const requireToken = createTokenMiddleware(config.apiToken);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Cache-Control", req.path.startsWith("/api/") ? "no-store" : "no-cache");
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(config.rootDir, "public")));

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validateWebhookPayload(req, res, next) {
  if (!isObject(req.body)) {
    return res.status(400).json({ success: false, error: "Webhook body must be a JSON object." });
  }
  next();
}

function validateContextBody(body) {
  if (!isObject(body)) return "Context body must be a JSON object.";
  const interactionId = body.interactionId || body.interaction_id;
  const callId = body.callId || body.call_id;
  if (!interactionId && !callId) return "interactionId or callId is required.";
  return null;
}

async function syncTarget(clean, target, requestedFields = []) {
  const context = store.findContextForInteraction(clean);
  if (!context) return { skipped: true, reason: "No CRM context registered yet" };

  const definitions = {
    task: { id: context.taskId, patch: () => buildTaskPatch(clean) },
    case: { id: context.caseId, patch: () => buildCasePatch(clean) },
    opportunity: { id: context.opportunityId, patch: () => buildOpportunityPatch(clean, requestedFields) }
  };
  const definition = definitions[target];
  if (!definition?.id) return { skipped: true, reason: `No ${target} ID registered` };

  const mapping = getEntityMapping(target);
  return crm.patchRecord(mapping.entitySet, definition.id, definition.patch());
}

async function syncAll(clean) {
  const context = store.findContextForInteraction(clean);
  if (!context) return { skipped: true, reason: "No CRM context registered yet" };

  const results = [];
  if (context.taskId) results.push({ target: "task", result: await syncTarget(clean, "task") });
  if (context.caseId) results.push({ target: "case", result: await syncTarget(clean, "case") });
  if (context.opportunityId && context.opportunityMode === "new") {
    results.push({ target: "opportunity", result: await syncTarget(clean, "opportunity") });
  }
  return { mode: config.crmMode, results };
}

app.get("/health", (req, res) => {
  res.json({ success: true, service: "ai-agent-crm-integration", crmMode: config.crmMode });
});

async function handleAgentAssistWebhook(req, res) {
  try {
    const clean = normalizeInteractionPayload(req.body);
    const stored = store.saveInteraction(clean);
    let crmSync;
    try {
      crmSync = await syncAll(clean);
    } catch (error) {
      crmSync = { success: false, error: error.message };
    }

    console.log("Interaction update", {
      interactionId: clean.interaction_id,
      updateCount: stored.clean.update_count,
      transcriptSegments: clean.transcript.length,
      callEnded: clean.call_ended,
      crmMode: config.crmMode
    });

    res.json({
      success: true,
      interaction_id: clean.interaction_id,
      update_count: stored.clean.update_count,
      crmSync
    });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    res.status(500).json({ success: false, error: "Webhook processing failed." });
  }
}

app.post("/webhook", requireToken, validateWebhookPayload, handleAgentAssistWebhook);
app.post("/webhook/agent-assist", requireToken, validateWebhookPayload, handleAgentAssistWebhook);

app.use("/api", requireToken);

app.post("/api/interaction-context", (req, res) => {
  const validationError = validateContextBody(req.body);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  const context = {
    interactionId: req.body.interactionId || req.body.interaction_id || null,
    callId: req.body.callId || req.body.call_id || null,
    taskId: req.body.taskId || req.body.task_id || null,
    caseId: req.body.caseId || req.body.case_id || null,
    opportunityId: req.body.opportunityId || req.body.opportunity_id || null,
    opportunityMode: String(req.body.opportunityMode || req.body.opportunity_mode || "existing").toLowerCase(),
    channel: String(req.body.channel || "voice").slice(0, 30),
    receivedAt: new Date().toISOString()
  };
  store.saveContext(context);
  res.json({ success: true, context });
});

app.get("/api/interactions", (req, res) => res.json(store.listInteractions()));

app.get("/api/interactions/:id", (req, res) => {
  const interaction = store.getInteraction(req.params.id);
  if (!interaction) return res.status(404).json({ error: "Interaction not found" });
  res.json({ ...interaction.clean, last_update_at: interaction.last_update_at });
});

app.get("/api/active-interaction", (req, res) => {
  const interaction = store.getActiveInteraction();
  if (!interaction) return res.json({ active: false, message: "No active interaction" });
  res.json({ active: true, ...interaction.clean, last_update_at: interaction.last_update_at });
});

app.get("/api/latest-interaction", (req, res) => {
  const list = store.listInteractions();
  const latest = list.at(-1);
  if (!latest) return res.status(404).json({ error: "No interactions received yet" });
  const interaction = store.getInteraction(latest.interaction_id);
  res.json({ ...interaction.clean, last_update_at: interaction.last_update_at });
});

app.get("/api/interaction-context/:id", (req, res) => {
  const context = store.getContext(req.params.id);
  if (!context) return res.status(404).json({ error: "Interaction context not found" });
  res.json(context);
});

for (const target of ["task", "case", "opportunity"]) {
  app.post(`/api/interactions/:id/sync-${target}`, async (req, res) => {
    const interaction = store.getInteraction(req.params.id);
    if (!interaction) return res.status(404).json({ success: false, error: "Interaction not found" });
    try {
      const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];
      const result = await syncTarget(interaction.clean, target, fields);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

app.get("/api/mock-crm", (req, res) => {
  if (config.crmMode !== "mock" || typeof crm.snapshot !== "function") {
    return res.status(404).json({ error: "Mock CRM is not active" });
  }
  res.json({ success: true, records: crm.snapshot() });
});

app.use((req, res) => res.status(404).json({ success: false, error: "Not found" }));

module.exports = { app };
