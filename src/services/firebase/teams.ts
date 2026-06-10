import type { DocumentData } from 'firebase/firestore'
import { getDb, loadFs } from './db'

/** Per-user soft cap (rules can't count docs on the free plan). */
export const MAX_TEAMS = 30

/** A saved raid team (5 squad slots + optional Machine of War). */
export interface SavedTeam {
  id: string
  name: string
  members: (string | null)[]
  machineOfWar: string | null
  /** Millis; null until the server timestamp resolves. */
  updatedAt: number | null
}

function toSavedTeam(id: string, d: DocumentData): SavedTeam {
  return {
    id,
    name: d.name,
    members: d.members,
    machineOfWar: d.machineOfWar ?? null,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  }
}

/** All of a user's saved teams, newest first. */
export async function listTeams(uid: string): Promise<SavedTeam[]> {
  const [fs, db] = [await loadFs(), await getDb()]
  const snap = await fs.getDocs(
    fs.query(fs.collection(db, 'teams'), fs.where('ownerUid', '==', uid)),
  )
  return snap.docs
    .map((d) => toSavedTeam(d.id, d.data()))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

/** Save a team; returns its id. `members` is normalised to exactly 5 slots. */
export async function createTeam(
  uid: string,
  name: string,
  members: (string | null)[],
  machineOfWar: string | null,
): Promise<string> {
  const [fs, db] = [await loadFs(), await getDb()]
  const five = [...members.slice(0, 5), ...Array(Math.max(0, 5 - members.length)).fill(null)]
  const ref = await fs.addDoc(fs.collection(db, 'teams'), {
    ownerUid: uid,
    name,
    members: five,
    machineOfWar,
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
  })
  return ref.id
}

export async function deleteTeam(id: string): Promise<void> {
  const [fs, db] = [await loadFs(), await getDb()]
  await fs.deleteDoc(fs.doc(db, 'teams', id))
}
