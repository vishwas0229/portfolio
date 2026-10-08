let authInstance = null;

function getFirebaseAuth() {
  if (authInstance) return authInstance;

  let cert;
  let getApps;
  let initializeApp;
  let getAuth;

  try {
    ({ cert, getApps, initializeApp } = require("firebase-admin/app"));
    ({ getAuth } = require("firebase-admin/auth"));
  } catch (error) {
    const wrapped = new Error("Firebase Admin SDK could not be loaded");
    wrapped.code = "FIREBASE_SDK_LOAD_FAILED";
    wrapped.cause = error;
    throw wrapped;
  }

  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    const error = new Error("Firebase Admin service account is not configured");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (_) {
    const error = new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid");
    error.code = "FIREBASE_CONFIG_INVALID";
    throw error;
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || "portfolio-562da"
      });

  authInstance = getAuth(app);
  return authInstance;
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  return getFirebaseAuth().verifyIdToken(idToken, true);
}

module.exports = { verifyFirebaseIdToken };
