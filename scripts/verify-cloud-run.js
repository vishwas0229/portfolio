#!/usr/bin/env node
"use strict";

async function verifyBackend(baseUrl, fetchImpl = fetch) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch (_) {
    throw new Error("Set PORTFOLIO_API_URL to the Cloud Run service URL.");
  }
  if (!["http:", "https:"].includes(base.protocol)) throw new Error("PORTFOLIO_API_URL must use http:// or https://.");

  const checks = [
    { path: "/api/health?deep=1", label: "deep health and Firestore connectivity", validate: body => body?.ok === true && body?.status === "healthy" && body?.database === "up" },
    { path: "/api/projects", label: "public projects", validate: body => body?.ok === true && Array.isArray(body?.data) },
    { path: "/api/certificates", label: "public certificates", validate: body => body?.ok === true && Array.isArray(body?.data) }
  ];

  for (const check of checks) {
    const response = await fetchImpl(new URL(check.path, base), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    let body;
    try { body = await response.json(); }
    catch (_) { throw new Error(check.label + " check returned invalid JSON (HTTP " + response.status + ")."); }
    if (!response.ok || !check.validate(body)) throw new Error(check.label + " check failed (HTTP " + response.status + ").");
    console.log("PASS " + check.label);
  }
  console.log("Cloud Run read-only checks passed.");
}

if (require.main === module) {
  verifyBackend(process.env.PORTFOLIO_API_URL || "").catch(error => {
    console.error("[cloud-run-check]", error.message);
    process.exitCode = 1;
  });
}
module.exports = { verifyBackend };
