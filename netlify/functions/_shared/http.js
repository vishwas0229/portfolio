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
  const requestOrigin = getOrigin(event);
  const allowed = requestOrigin && requestOrigin === config.corsOrigin ? requestOrigin : config.corsOrigin;
  return {
    ...baseHeaders,
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-CSRF-Token",
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
