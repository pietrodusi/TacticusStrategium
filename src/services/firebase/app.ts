import { initializeApp } from 'firebase/app'

// Web app config from Firebase console → Project settings → Your apps.
// These values are public identifiers, safe to commit — all security lives in
// Firebase Auth + the Firestore rules (see firestore.rules at the repo root).
const firebaseConfig = {
  apiKey: 'AIzaSyC3y8_iDvQ9eJXo4x9-intyOT0yXj2NdSo',
  authDomain: 'tacticus-strategium.firebaseapp.com',
  projectId: 'tacticus-strategium',
  storageBucket: 'tacticus-strategium.firebasestorage.app',
  messagingSenderId: '257758199298',
  appId: '1:257758199298:web:9f97316f4433928f60711b',
}

/** False until the real console config is pasted above — UI shows a hint. */
export const firebaseConfigured = firebaseConfig.apiKey !== 'REPLACE_ME'

// Only firebase/app is loaded eagerly (tiny); the heavy auth and firestore
// modules are dynamic-imported by services/firebase/{auth,plans}.ts so they
// land in their own async chunks, off the first-paint critical path.
export const firebaseApp = initializeApp(firebaseConfig)
