const { config } = require("./config");

const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin"
};

function getOrigin(event) {
  const headers = event?.headers || {};
  return headers.origin || headers.Origin || "";
}

function corsHeaders(event) {
  const requestOrigin = String(getOrigin(event) || "").replace(/\/$/, "");
  const development = String(process.env.NODE_ENV || "").toLowerCase() === "development";
  const developmentOrigins = new Set(["http://localhost:8888", "http://127.0.0.1:8888"]);
  const cloudflareRequest = Boolean(
    event?.headers?.["cf-connecting-ip"] ||
    event?.headers?.["CF-Connecting-IP"] ||
    event?.headers?.["cf-ray"] ||
    event?.headers?.["CF-Ray"]
  );
  const tunnelOrigin = development && cloudflareRequest && requestOrigin.startsWith("https://");
  const sameHostOrigin = (() => {
    const host = event?.headers?.["x-forwarded-host"] || event?.headers?.["X-Forwarded-Host"] || event?.headers?.host || event?.headers?.Host;
    const proto = String(event?.headers?.["x-forwarded-proto"] || event?.headers?.["X-Forwarded-Proto"] || "").split(",")[0].trim().toLowerCase();
    return host && (proto === "http" || proto === "https") ? proto + "://" + String(host).split(",")[0].trim() : "";
  })();
  const allowed = tunnelOrigin || developmentOrigins.has(requestOrigin) || requestOrigin === config.corsOrigin || requestOrigin === sameHostOrigin
    ? requestOrigin
    : config.corsOrigin;
  return {
    ...baseHeaders,
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-CSRF-Token",
    "access-control-allow-credentials": "true",
    vary: "Origin"
  };
}

function json(statusCode, body, event, extraHeaders = {}) {
  const headers = { ...corsHeaders(event), ...extraHeaders };
  const multiValueHeaders = {};
  if (Array.isArray(headers["set-cookie"])) {
    multiValueHeaders["set-cookie"] = headers["set-cookie"];
    delete headers["set-cookie"];
  }
  return {
    statusCode,
    headers,
    ...(Object.keys(multiValueHeaders).length ? { multiValueHeaders } : {}),
    body: JSON.stringify(body)
  };
}

function options(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: "" };
}

module.exports = { json, options, corsHeaders };
