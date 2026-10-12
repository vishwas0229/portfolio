let authInstance = null;

function getFirebaseAuth() {
  if (authInstance) return authInstance;
  const { getApps, initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const app = getApps()[0] || initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "portfolio-562da"
  });
  authInstance = getAuth(app);
  return authInstance;
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  return getFirebaseAuth().verifyIdToken(idToken, true);
}

module.exports = { verifyFirebaseIdToken };
