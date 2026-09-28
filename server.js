const config = require("./src/config");
const { app } = require("./src/app");

app.listen(config.port, () => {
  console.log(`AI Agent CRM Integration listening on http://localhost:${config.port}`);
  console.log(`CRM mode: ${config.crmMode}`);
  if (!config.apiToken) console.warn("DEMO_API_TOKEN is not configured; protected endpoints will reject requests.");
});
