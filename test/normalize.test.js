const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeInteractionPayload } = require('../src/interactions/normalize');

process.env.CRM_MODE = process.env.CRM_MODE || 'mock';

test('normalizes a fictional agent-assist payload', () => {
  const payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'webhook-payload.json'), 'utf8'));
  const normalized = normalizeInteractionPayload(payload);
  assert.equal(normalized.interaction_id, 'demo-interaction-001');
  assert.equal(normalized.contact.firstName, 'Alex');
  assert.equal(normalized.transcript.length, 2);
  assert.match(normalized.summary.interactionSummary, /evaluating conversational AI/i);
});
