"use strict";
const { json, options } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");
const { list } = require("./_shared/db");

function accountQuery(email) {
  return `?select=id,email,role,active,session_version&email=eq.${encodeURIComponent(email)}&limit=1`;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);

  try {
    const session = await requireAdmin(event);
    if (event.httpMethod !== "GET") {
      return json(405, {
        ok: false,
        error: "Manage your password through Firebase Authentication. Admin profile changes are not available here."
      }, event, { allow: "GET, OPTIONS" });
    }

    const rows = await list("admins", accountQuery(session.sub));
    const admin = Array.isArray(rows) ? rows[0] : null;
    if (!admin || !Boolean(admin.active) || admin.role !== "admin") {
      return json(401, { ok: false, error: "Authentication required." }, event);
    }

    return json(200, {
      ok: true,
      data: { email: admin.email, role: admin.role, active: Boolean(admin.active) }
    }, event, { "cache-control": "no-store" });
  } catch (error) {
    const status = error?.statusCode || 500;
    return json(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Request is not authorized." : "Account request could not be completed."
    }, event);
  }
};
