const { json, options } = require("./_shared/http");
const { getSession } = require("./_shared/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });

  const session = getSession(event);
  if (!session) {
    return json(401, { ok: false, authenticated: false }, event, { "cache-control": "no-store" });
  }

  return json(200, {
    ok: true,
    authenticated: true,
    user: { email: session.sub, role: session.role },
    expiresAt: new Date(session.exp * 1000).toISOString(),
    csrfToken: session.csrf
  }, event, { "cache-control": "no-store" });
};
