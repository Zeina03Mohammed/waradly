const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

// Prefer these over admin.firestore.FieldValue/.Timestamp (the older namespaced compat API) —
// the modular imports are the officially recommended v12+ pattern and sidestep a compat-shim
// quirk that intermittently left admin.firestore.FieldValue undefined at call time in testing.
module.exports = { admin, db, auth, bucket, FieldValue, Timestamp };
