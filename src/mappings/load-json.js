const fs = require("fs");

function loadJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to load ${label} from ${filePath}: ${error.message}`);
  }
}

module.exports = { loadJson };
