import type { PadSample, Pattern } from '../state/types'
import { bufferToStored, storedToBuffer, type StoredSample } from './wav'
import { defaultBankName, emptyPads, MAX_BANKS, type BankMeta } from './format'

const DB_NAME = 'pocket-chop'
const DB_VERSION = 1

export interface SessionMeta {
  slotBanks: [number, number, number, number]
  activeSlot: 0 | 1 | 2 | 3
  lang: 'zh' | 'en'
  bpm: number
  patternIndex: number
}

export interface BankRecord {
  bankIndex: number
  name: string
  updatedAt: string
  createdAt: string
  pads: Omit<PadSample, 'buffer'>[]
  pattern0?: Pattern
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('banks')) {
        db.createObjectStore('banks', { keyPath: 'bankIndex' })
      }
      if (!db.objectStoreNames.contains('samples')) db.createObjectStore('samples')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = store.get(key)
    r.onsuccess = () => resolve(r.result as T | undefined)
    r.onerror = () => reject(r.error)
  })
}

export async function ensureLibrarySkeleton(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('banks', 'readwrite')
  const store = tx.objectStore('banks')
  for (let i = 1; i <= MAX_BANKS; i++) {
    const existing = await idbGet<BankRecord>(store, i)
    if (!existing) {
      const pads = emptyPads().map(({ buffer: _b, ...rest }) => rest)
      const rec: BankRecord = {
        bankIndex: i,
        name: defaultBankName(i),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        pads,
      }
      store.put(rec)
    }
  }
  await txDone(tx)
  db.close()
}

export async function listBankMetas(): Promise<BankMeta[]> {
  const db = await openDb()
  const tx = db.transaction(['banks', 'samples'], 'readonly')
  const store = tx.objectStore('banks')
  const samples = tx.objectStore('samples')
  const all = await new Promise<BankRecord[]>((resolve, reject) => {
    const r = store.getAll()
    r.onsuccess = () => resolve(r.result as BankRecord[])
    r.onerror = () => reject(r.error)
  })
  const metas: BankMeta[] = []
  for (const b of all.sort((a, c) => a.bankIndex - c.bankIndex)) {
    let padCount = 0
    for (let p = 0; p < 16; p++) {
      const s = await idbGet<StoredSample>(samples, `${b.bankIndex}:${p}`)
      if (s) padCount++
    }
    metas.push({
      bankIndex: b.bankIndex,
      name: b.name,
      updatedAt: b.updatedAt,
      padCount,
    })
  }
  db.close()
  return metas
}

export async function getSession(): Promise<SessionMeta | null> {
  const db = await openDb()
  const tx = db.transaction('meta', 'readonly')
  const s = await idbGet<SessionMeta>(tx.objectStore('meta'), 'session')
  db.close()
  return s ?? null
}

export async function saveSession(session: SessionMeta): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('meta', 'readwrite')
  tx.objectStore('meta').put(session, 'session')
  await txDone(tx)
  db.close()
}

export async function renameBank(bankIndex: number, name: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('banks', 'readwrite')
  const store = tx.objectStore('banks')
  const rec = await idbGet<BankRecord>(store, bankIndex)
  if (rec) {
    rec.name = name.slice(0, 24)
    rec.updatedAt = new Date().toISOString()
    store.put(rec)
  }
  await txDone(tx)
  db.close()
}

export async function clearBank(bankIndex: number): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['banks', 'samples'], 'readwrite')
  const banks = tx.objectStore('banks')
  const samples = tx.objectStore('samples')
  const rec = await idbGet<BankRecord>(banks, bankIndex)
  if (rec) {
    rec.pads = emptyPads().map(({ buffer: _b, ...rest }) => rest)
    rec.name = defaultBankName(bankIndex)
    rec.updatedAt = new Date().toISOString()
    delete rec.pattern0
    banks.put(rec)
  }
  for (let p = 0; p < 16; p++) samples.delete(`${bankIndex}:${p}`)
  await txDone(tx)
  db.close()
}

export async function duplicateBank(from: number, to: number): Promise<void> {
  if (from === to) return
  const db = await openDb()
  const tx = db.transaction(['banks', 'samples'], 'readwrite')
  const banks = tx.objectStore('banks')
  const samples = tx.objectStore('samples')
  const src = await idbGet<BankRecord>(banks, from)
  if (!src) {
    db.close()
    return
  }
  const dest: BankRecord = {
    bankIndex: to,
    name: (src.name.slice(0, 18) + '*').slice(0, 24),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    pads: src.pads.map((p) => ({ ...p })),
    pattern0: src.pattern0
      ? { bars: src.pattern0.bars, steps: src.pattern0.steps.map((r) => r.slice()) }
      : undefined,
  }
  banks.put(dest)
  for (let p = 0; p < 16; p++) {
    samples.delete(`${to}:${p}`)
    const samp = await idbGet<StoredSample>(samples, `${from}:${p}`)
    if (samp) {
      samples.put(
        {
          sampleRate: samp.sampleRate,
          channels: samp.channels,
          length: samp.length,
          channelData: samp.channelData.map((c) => new Float32Array(c)),
        },
        `${to}:${p}`,
      )
    }
  }
  await txDone(tx)
  db.close()
}

export async function saveBankFromPads(
  bankIndex: number,
  name: string,
  pads: PadSample[],
  pattern0?: Pattern,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['banks', 'samples'], 'readwrite')
  const banks = tx.objectStore('banks')
  const samples = tx.objectStore('samples')
  const prev = await idbGet<BankRecord>(banks, bankIndex)
  const rec: BankRecord = {
    bankIndex,
    name: name.slice(0, 24),
    updatedAt: new Date().toISOString(),
    createdAt: prev?.createdAt ?? new Date().toISOString(),
    pads: pads.map(({ buffer: _b, ...rest }) => ({ ...rest })),
    pattern0: pattern0
      ? { bars: pattern0.bars, steps: pattern0.steps.map((r) => r.slice()) }
      : prev?.pattern0,
  }
  banks.put(rec)
  for (let p = 0; p < 16; p++) {
    const key = `${bankIndex}:${p}`
    if (pads[p].buffer) samples.put(bufferToStored(pads[p].buffer!), key)
    else samples.delete(key)
  }
  await txDone(tx)
  db.close()
}

export async function loadBankPads(
  bankIndex: number,
  ctx: BaseAudioContext | null,
): Promise<{ meta: BankRecord; pads: PadSample[] }> {
  const db = await openDb()
  const tx = db.transaction(['banks', 'samples'], 'readonly')
  const banks = tx.objectStore('banks')
  const samples = tx.objectStore('samples')
  let rec = await idbGet<BankRecord>(banks, bankIndex)
  if (!rec) {
    rec = {
      bankIndex,
      name: defaultBankName(bankIndex),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      pads: emptyPads().map(({ buffer: _b, ...rest }) => rest),
    }
  }
  const pads: PadSample[] = emptyPads()
  for (let i = 0; i < 16; i++) {
    const meta = rec.pads[i]
    if (meta) pads[i] = { ...pads[i], ...meta, buffer: null }
    const samp = await idbGet<StoredSample>(samples, `${bankIndex}:${i}`)
    if (samp && ctx) pads[i].buffer = storedToBuffer(ctx, samp)
  }
  db.close()
  return { meta: rec, pads }
}

export async function getBankRecord(bankIndex: number): Promise<BankRecord | null> {
  const db = await openDb()
  const tx = db.transaction('banks', 'readonly')
  const rec = await idbGet<BankRecord>(tx.objectStore('banks'), bankIndex)
  db.close()
  return rec ?? null
}
