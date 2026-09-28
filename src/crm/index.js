const config = require("../config");
const { MockCrmClient } = require("./mock-client");
const { DynamicsClient } = require("./dynamics-client");

function createCrmClient() {
  return config.crmMode === "dynamics"
    ? new DynamicsClient(config.dynamics)
    : new MockCrmClient();
}

module.exports = { createCrmClient };
