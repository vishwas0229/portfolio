const { json, options } = require("./_shared/http");
const { clearCookie, SESSION_COOKIE, CSRF_COOKIE } = require("./_shared/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "POST, OPTIONS" });

  return json(200, { ok: true }, event, {
    "set-cookie": [clearCookie(SESSION_COOKIE), clearCookie(CSRF_COOKIE)],
    "cache-control": "no-store"
  });
};
