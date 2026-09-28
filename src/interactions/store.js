class InteractionStore {
  constructor(ttlMinutes = 30) {
    this.ttlMinutes = ttlMinutes;
    this.interactions = new Map();
    this.contexts = new Map();
    this.latestInteractionId = null;
  }

  saveInteraction(clean) {
    const previous = this.interactions.get(clean.interaction_id);
    clean.update_count = previous ? previous.clean.update_count + 1 : 1;
    const stored = { clean, last_update_at: new Date().toISOString() };
    this.interactions.set(clean.interaction_id, stored);
    this.latestInteractionId = clean.interaction_id;
    return stored;
  }

  getInteraction(id) {
    return this.interactions.get(String(id)) || null;
  }

  listInteractions() {
    return Array.from(this.interactions.values()).map(({ clean, last_update_at }) => ({
      interaction_id: clean.interaction_id,
      call_id: clean.call_id,
      received_at: clean.received_at,
      last_update_at,
      update_count: clean.update_count,
      call_ended: clean.call_ended
    }));
  }

  getActiveInteraction() {
    if (!this.latestInteractionId) return null;
    const item = this.interactions.get(this.latestInteractionId);
    if (!item) return null;
    const ageMinutes = (Date.now() - new Date(item.last_update_at).getTime()) / 60000;
    return ageMinutes <= this.ttlMinutes ? item : null;
  }

  saveContext(context) {
    if (context.interactionId) this.contexts.set(String(context.interactionId), context);
    if (context.callId) this.contexts.set(String(context.callId), context);
  }

  getContext(id) {
    return id == null ? null : this.contexts.get(String(id)) || null;
  }

  findContextForInteraction(clean) {
    return this.getContext(clean.interaction_id) || this.getContext(clean.call_id);
  }
}

module.exports = { InteractionStore };
