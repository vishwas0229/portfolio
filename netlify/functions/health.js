const { config } = require("./_shared/config");
const { json, options } = require("./_shared/http");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });
  }

  return json(200, {
    ok: true,
    status: "healthy",
    service: "rahul-portfolio-api",
    version: config.appVersion,
    environment: process.env.CONTEXT || process.env.NODE_ENV || "unknown",
    timestamp: new Date().toISOString()
  }, event);
};
