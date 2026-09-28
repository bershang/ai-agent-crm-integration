class MockCrmClient {
  constructor() {
    this.records = new Map();
  }

  async patchRecord(entitySetName, id, patch) {
    const key = `${entitySetName}:${id}`;
    const existing = this.records.get(key) || {};
    this.records.set(key, { ...existing, ...patch });
    return {
      success: true,
      mode: "mock",
      entitySetName,
      id,
      updatedFields: Object.keys(patch)
    };
  }

  snapshot() {
    return Array.from(this.records.entries()).map(([key, value]) => ({ key, value }));
  }
}

module.exports = { MockCrmClient };
