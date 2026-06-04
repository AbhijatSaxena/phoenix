import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  enableIndexedDbPersistence,
  Timestamp,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// Enable offline persistence (best-effort; silently fails in some browser configs)
enableIndexedDbPersistence(db).catch(() => {})

export async function fetchUserRole(uid: string): Promise<'admin' | 'viewer'> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() ? (snap.data().role as 'admin' | 'viewer') : 'viewer'
  } catch {
    return 'viewer'
  }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function fetchAccounts() {
  const snap = await getDocs(query(collection(db, 'accounts'), orderBy('order')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveAccount(account: Record<string, unknown>) {
  const { id, ...data } = account
  await setDoc(doc(db, 'accounts', id as string), data)
}

export async function deleteAccount(id: string) {
  await deleteDoc(doc(db, 'accounts', id))
}

// ─── Rates ───────────────────────────────────────────────────────────────────

export async function updateDerivedAccount(derived: 'zerodha' | 'regent', inr: number) {
  const snap = await getDocs(collection(db, 'accounts'))
  const match = snap.docs.find(d => d.data().derived === derived)
  if (match) {
    await setDoc(doc(db, 'accounts', match.id), { ...match.data(), inr })
  }
}

export async function fetchCachedRates() {
  const snap = await getDoc(doc(db, 'meta', 'rates'))
  return snap.exists() ? snap.data() : null
}

export async function saveCachedRates(rates: { usdInr: number; cadInr: number }) {
  await setDoc(doc(db, 'meta', 'rates'), { ...rates, fetchedAt: Date.now() })
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export async function fetchSnapshots() {
  const snap = await getDocs(query(collection(db, 'snapshots'), orderBy('date')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function upsertSnapshot(snapshot: Record<string, unknown>) {
  const { id, ...data } = snapshot
  await setDoc(doc(db, 'snapshots', id as string), data)
}

export async function deleteSnapshot(id: string) {
  await deleteDoc(doc(db, 'snapshots', id))
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function fetchMonthExpenses(currency: string, yearMonth: string) {
  const id = `${currency}-${yearMonth}`
  const snap = await getDoc(doc(db, 'expenses', id))
  return snap.exists() ? { id, ...snap.data() } : null
}

export async function fetchAllExpenses(currency: string) {
  const snap = await getDocs(
    query(collection(db, 'expenses'), orderBy('yearMonth'))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((d: any) => d.currency === currency)
}

export async function saveMonthExpenses(data: Record<string, unknown>) {
  const { id, ...rest } = data
  await setDoc(doc(db, 'expenses', id as string), rest)
}

export async function deleteMonthExpenses(id: string) {
  await deleteDoc(doc(db, 'expenses', id))
}

// ─── Regent ──────────────────────────────────────────────────────────────────

export async function fetchRegentConfig() {
  const snap = await getDoc(doc(db, 'regent', 'config'))
  return snap.exists() ? snap.data() : null
}

export async function saveRegentConfig(data: Record<string, unknown>) {
  await setDoc(doc(db, 'regent', 'config'), data)
}

export async function fetchRegentEmis() {
  const snap = await getDocs(query(collection(db, 'regentEmis'), orderBy('date')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addRegentEmi(data: { date: string; amount: number }) {
  return addDoc(collection(db, 'regentEmis'), data)
}

export async function deleteRegentEmi(id: string) {
  await deleteDoc(doc(db, 'regentEmis', id))
}

export async function updateRegentEmi(id: string, data: { date: string; amount: number }) {
  await setDoc(doc(db, 'regentEmis', id), data)
}

// ─── Zerodha ─────────────────────────────────────────────────────────────────

export async function fetchZerodhaConfig() {
  const snap = await getDoc(doc(db, 'zerodha', 'config'))
  return snap.exists() ? snap.data() : null
}

export async function saveZerodhaConfig(data: { capital: number }) {
  await setDoc(doc(db, 'zerodha', 'config'), data)
}

export async function fetchZerodhaEntries() {
  const snap = await getDocs(query(collection(db, 'zerodhaEntries'), orderBy('date')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function upsertZerodhaEntry(data: Record<string, unknown>) {
  const { id, ...rest } = data
  if (id) {
    await setDoc(doc(db, 'zerodhaEntries', id as string), rest)
  } else {
    await addDoc(collection(db, 'zerodhaEntries'), rest)
  }
}

export async function deleteZerodhaEntry(id: string) {
  await deleteDoc(doc(db, 'zerodhaEntries', id))
}

// ─── Expense row order ───────────────────────────────────────────────────────

export async function fetchExpenseRowOrder(currency: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'meta', `rowOrder-${currency}`))
  return snap.exists() ? (snap.data().order as string[]) : []
}

export async function saveExpenseRowOrder(currency: string, order: string[]) {
  await setDoc(doc(db, 'meta', `rowOrder-${currency}`), { order })
}

// ─── Todos ───────────────────────────────────────────────────────────────────

export async function fetchTodos() {
  const snap = await getDocs(query(collection(db, 'todos'), orderBy('order')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((t: any) => !t.archived)
}

export async function fetchArchivedTodos() {
  const snap = await getDocs(query(collection(db, 'todos'), orderBy('order')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((t: any) => t.archived === true)
}

export async function saveTodo(todo: Record<string, unknown>) {
  const { id, ...data } = todo
  await setDoc(doc(db, 'todos', id as string), data)
}

export async function deleteTodo(id: string) {
  await deleteDoc(doc(db, 'todos', id))
}

// ─── Todo Comments ────────────────────────────────────────────────────────────

export async function fetchComments(todoId: string) {
  const snap = await getDocs(
    query(collection(db, 'todos', todoId, 'comments'), orderBy('createdAt'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addComment(todoId: string, comment: { text: string; authorName: string; createdAt: number }) {
  const ref = await addDoc(collection(db, 'todos', todoId, 'comments'), comment)
  return ref.id
}

export async function deleteComment(todoId: string, commentId: string) {
  await deleteDoc(doc(db, 'todos', todoId, 'comments', commentId))
}

export async function bumpCommentCount(todoId: string, delta: 1 | -1) {
  await updateDoc(doc(db, 'todos', todoId), { commentCount: increment(delta) })
}

export async function setCommentCount(todoId: string, count: number) {
  await updateDoc(doc(db, 'todos', todoId), { commentCount: count })
}

export { Timestamp }
