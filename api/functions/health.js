const { config } = require("./_shared/config");
const { ping } = require("./_shared/db");
const { json, options } = require("./_shared/http");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });
  }

  const deep = String(event.queryStringParameters?.deep || "") === "1";
  if (!deep) {
    return json(200, {
      ok: true,
      status: "healthy",
      service: "rahul-portfolio-api",
      version: config.appVersion,
      environment: process.env.CONTEXT || process.env.NODE_ENV || "unknown",
      timestamp: new Date().toISOString()
    }, event);
  }

  try {
    await ping();
    return json(200, {
      ok: true,
      status: "healthy",
      service: "rahul-portfolio-api",
      database: "up",
      version: config.appVersion,
      timestamp: new Date().toISOString()
    }, event);
  } catch (_) {
    return json(503, {
      ok: false,
      status: "degraded",
      service: "rahul-portfolio-api",
      database: "down",
      version: config.appVersion,
      timestamp: new Date().toISOString()
    }, event, { "cache-control": "no-store" });
  }
};
