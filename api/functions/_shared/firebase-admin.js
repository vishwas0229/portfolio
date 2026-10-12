"use strict";

let app;

function getFirebaseAdminApp() {
  if (app) return app;

  const { getApps, initializeApp, cert, applicationDefault } = require("firebase-admin/app");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "portfolio-562da";
  const rawServiceAccount = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  let credential = applicationDefault();

  if (rawServiceAccount) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch (_) {
      const error = new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
      error.code = "FIREBASE_CREDENTIALS_INVALID";
      throw error;
    }

    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    credential = cert(serviceAccount);
  }

  app = getApps()[0] || initializeApp({ projectId, credential });
  return app;
}

module.exports = { getFirebaseAdminApp };
