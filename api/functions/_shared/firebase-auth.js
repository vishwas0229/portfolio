let authInstance = null;

function getFirebaseAuth() {
  if (authInstance) return authInstance;
  const { getAuth } = require("firebase-admin/auth");
  const { getFirebaseAdminApp } = require("./firebase-admin");
  authInstance = getAuth(getFirebaseAdminApp());
  return authInstance;
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  return getFirebaseAuth().verifyIdToken(idToken, true);
}

module.exports = { verifyFirebaseIdToken };
