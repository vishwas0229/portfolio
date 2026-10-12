const { json, options } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "GET") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, OPTIONS" });

  let session;
  try {
    session = await requireAdmin(event);
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);

    // No session (or an expired/revoked session) is a normal anonymous state
    // when the login screen first loads, not a failed API operation.
    if (status === 401) {
      return json(200, {
        ok: true,
        authenticated: false
      }, event, { "cache-control": "no-store" });
    }

    return json(status, {
      ok: false,
      authenticated: false,
      error: status === 503
        ? "Database is not configured."
        : "Could not verify the admin session."
    }, event, { "cache-control": "no-store" });
  }

  return json(200, {
    ok: true,
    authenticated: true,
    user: { email: session.sub, role: session.role },
    expiresAt: new Date(session.exp * 1000).toISOString(),
    sessionVersion: session.sessionVersion,
    csrfToken: session.csrf
  }, event, { "cache-control": "no-store" });
};
