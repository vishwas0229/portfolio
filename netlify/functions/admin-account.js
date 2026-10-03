const { json, options } = require("./_shared/http");
const { readJsonBody, validateAdminEmail, validateString } = require("./_shared/validation");
const {
  hashPassword,
  verifyPassword,
  requireAdmin,
  requireSameOrigin,
  requireCsrf,
  createLoginSession,
  SESSION_TTL_SECONDS
} = require("./_shared/auth");
const { list, update } = require("./_shared/db");

function accountQuery(email) {
  return `?select=id,email,password_hash,role,active,session_version&email=eq.${encodeURIComponent(email)}&limit=1`;
}

function publicAccount(admin) {
  return {
    email: admin.email,
    role: admin.role,
    active: Boolean(admin.active)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);

  try {
    const session = await requireAdmin(event);

    if (event.httpMethod === "GET") {
      const rows = await list("admins", accountQuery(session.sub));
      const admin = Array.isArray(rows) ? rows[0] : null;
      if (!admin || !Boolean(admin.active) || admin.role !== "admin") {
        return json(401, { ok: false, error: "Authentication required." }, event);
      }

      return json(200, {
        ok: true,
        data: publicAccount(admin)
      }, event, { "cache-control": "no-store" });
    }

    if (event.httpMethod !== "PATCH") {
      return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET, PATCH, OPTIONS" });
    }

    requireSameOrigin(event);
    requireCsrf(event, session);

    const payload = readJsonBody(event, 8192);
    const currentPassword = typeof payload.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";

    const rows = await list("admins", accountQuery(session.sub));
    const admin = Array.isArray(rows) ? rows[0] : null;
    if (!admin || !Boolean(admin.active) || admin.role !== "admin") {
      return json(401, { ok: false, error: "Authentication required." }, event);
    }

    const emailRequested = payload.email !== undefined;
    const passwordRequested = newPassword.length > 0;

    if (!emailRequested && !passwordRequested) {
      return json(422, { ok: false, error: "Provide a new email or a new password." }, event);
    }

    if (!currentPassword || !verifyPassword(currentPassword, admin.password_hash)) {
      return json(401, { ok: false, error: "Current password is incorrect." }, event);
    }

    let newEmail = admin.email;
    if (emailRequested) {
      const email = validateAdminEmail(payload.email, 160);
      if (!email.ok) return json(422, { ok: false, error: email.error }, event);
      newEmail = email.value;
    }

    if (passwordRequested) {
      const password = validateString(newPassword, {
        field: "newPassword",
        min: 12,
        max: 200
      });
      if (!password.ok) return json(422, { ok: false, error: password.error }, event);

      if (verifyPassword(newPassword, admin.password_hash)) {
        return json(422, {
          ok: false,
          error: "New password must be different from the current password."
        }, event);
      }
    }

    if (newEmail === admin.email && !passwordRequested) {
      return json(422, { ok: false, error: "No account changes were requested." }, event);
    }

    const nextVersion = Number(admin.session_version || 1) + 1;
    const patch = {
      email: newEmail,
      session_version: nextVersion
    };
    if (passwordRequested) patch.password_hash = hashPassword(newPassword);

    const changed = await update(
      "admins",
      `?id=eq.${encodeURIComponent(admin.id)}&select=*`,
      patch
    );
    const updated = Array.isArray(changed) ? changed[0] : changed;
    if (!updated) {
      return json(500, { ok: false, error: "Account could not be updated." }, event);
    }

    const authSession = createLoginSession(updated.email, updated.session_version);

    return json(200, {
      ok: true,
      data: publicAccount(updated),
      csrfToken: authSession.csrf,
      expiresIn: SESSION_TTL_SECONDS
    }, event, {
      "set-cookie": authSession.cookies,
      "cache-control": "no-store"
    });
  } catch (error) {
    const status = error?.code === "ER_DUP_ENTRY"
      ? 409
      : error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);

    return json(status, {
      ok: false,
      error: status === 401
        ? "Authentication required."
        : status === 403
          ? "Request is not authorized."
          : status === 409
            ? "An admin with that email already exists."
            : status === 503
              ? "Database is not configured."
              : "Account request could not be completed."
    }, event);
  }
};
