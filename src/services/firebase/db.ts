import type { Firestore } from 'firebase/firestore'
import { firebaseApp } from './app'

// firebase/firestore is dynamic-imported into its own chunk — visitors who
// never touch cloud features (signed-out planning) don't download it at all.
export const loadFs = () => import('firebase/firestore')

let dbPromise: Promise<Firestore> | null = null
export const getDb = () => (dbPromise ??= loadFs().then((m) => m.getFirestore(firebaseApp)))
