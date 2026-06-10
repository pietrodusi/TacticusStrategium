import type { DocumentData } from 'firebase/firestore'
import { getDb, loadFs } from './db'
import { PLAN_SCHEMA_VERSION } from '../plans/serialize'

/** Per-user soft cap (rules can't count docs on the free plan). */
export const MAX_PLANS = 100

/** The fight identity duplicated onto the doc for list cards. */
export interface PlanMeta {
  bossUnitId: string
  targetKind: 'boss' | 'prime'
  boardId: string
}

/** A cloud plan doc as the app consumes it. */
export interface CloudPlan extends PlanMeta {
  id: string
  name: string
  shared: boolean
  schemaVersion: number
  /** JSON payload — see services/plans/serialize.ts. */
  data: string
  /** Millis; null until the server timestamp resolves. */
  updatedAt: number | null
}

function toCloudPlan(id: string, d: DocumentData): CloudPlan {
  return {
    id,
    name: d.name,
    shared: d.shared === true,
    schemaVersion: d.schemaVersion,
    bossUnitId: d.bossUnitId,
    targetKind: d.targetKind,
    boardId: d.boardId,
    data: d.data,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  }
}

/** All of a user's plans, newest first. */
export async function listPlans(uid: string): Promise<CloudPlan[]> {
  const [fs, db] = [await loadFs(), await getDb()]
  const snap = await fs.getDocs(
    fs.query(fs.collection(db, 'plans'), fs.where('ownerUid', '==', uid)),
  )
  return snap.docs
    .map((d) => toCloudPlan(d.id, d.data()))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

/** One plan by id — null if it doesn't exist. Throws permission-denied when
 *  it exists but is neither yours nor shared. */
export async function getPlan(id: string): Promise<CloudPlan | null> {
  const [fs, db] = [await loadFs(), await getDb()]
  const snap = await fs.getDoc(fs.doc(db, 'plans', id))
  return snap.exists() ? toCloudPlan(snap.id, snap.data()) : null
}

/** Create a plan doc; returns its id. */
export async function createPlan(
  uid: string,
  name: string,
  meta: PlanMeta,
  data: string,
): Promise<string> {
  const [fs, db] = [await loadFs(), await getDb()]
  const ref = await fs.addDoc(fs.collection(db, 'plans'), {
    schemaVersion: PLAN_SCHEMA_VERSION,
    ownerUid: uid,
    name,
    shared: false,
    ...meta,
    data,
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
  })
  return ref.id
}

/** Overwrite an existing plan's payload (and fight identity). */
export async function overwritePlan(id: string, meta: PlanMeta, data: string): Promise<void> {
  const [fs, db] = [await loadFs(), await getDb()]
  await fs.updateDoc(fs.doc(db, 'plans', id), {
    schemaVersion: PLAN_SCHEMA_VERSION,
    ...meta,
    data,
    updatedAt: fs.serverTimestamp(),
  })
}

export async function renamePlan(id: string, name: string): Promise<void> {
  const [fs, db] = [await loadFs(), await getDb()]
  await fs.updateDoc(fs.doc(db, 'plans', id), { name, updatedAt: fs.serverTimestamp() })
}

export async function setPlanShared(id: string, shared: boolean): Promise<void> {
  const [fs, db] = [await loadFs(), await getDb()]
  await fs.updateDoc(fs.doc(db, 'plans', id), { shared, updatedAt: fs.serverTimestamp() })
}

export async function deletePlan(id: string): Promise<void> {
  const [fs, db] = [await loadFs(), await getDb()]
  await fs.deleteDoc(fs.doc(db, 'plans', id))
}
