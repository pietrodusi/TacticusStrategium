import { initializeApp } from 'firebase/app'

// Web app config from Firebase console → Project settings → Your apps.
// These values are public identifiers, safe to commit — all security lives in
// Firebase Auth + the Firestore rules (see firestore.rules at the repo root).
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
}

/** False until the real console config is pasted above — UI shows a hint. */
export const firebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME'

// Only firebase/app is loaded eagerly (tiny); the heavy auth and firestore
// modules are dynamic-imported by services/firebase/{auth,plans}.ts so they
// land in their own async chunks, off the first-paint critical path.
export const firebaseApp = initializeApp(firebaseConfig)
