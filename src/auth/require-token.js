const crypto = require("crypto");

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createTokenMiddleware(expectedToken) {
  return function requireToken(req, res, next) {
    if (!expectedToken) {
      return res.status(503).json({
        success: false,
        error: "Server access token is not configured. Set DEMO_API_TOKEN."
      });
    }

    const bearer = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    const supplied = req.get("x-demo-token") || req.get("x-agentassist-token") || bearer;

    if (!supplied || !safeEqual(supplied, expectedToken)) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    next();
  };
}

module.exports = { createTokenMiddleware };
