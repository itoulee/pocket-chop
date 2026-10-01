import type { Store } from '../state/machine'
import type { AudioEngine } from '../audio/engine'
import {
  ensureLibrarySkeleton,
  getSession,
  loadBankPads,
  saveBankFromPads,
  saveSession,
  getBankRecord,
  type SessionMeta,
} from './idb'
import { defaultBankName } from './format'

/**
 * Coordinates A–D slot pointers, autosave of current bank, and session restore.
 */
export class BankManager {
  store: Store
  engine: AudioEngine
  private saveTimer: number | null = null
  private ready = false

  constructor(store: Store, engine: AudioEngine) {
    this.store = store
    this.engine = engine
  }

  async init(): Promise<void> {
    await ensureLibrarySkeleton()
    const session = await getSession()
    if (session) {
      this.store.patch({
        slotBanks: session.slotBanks,
        bankSlot: session.activeSlot,
        bankIndex: session.slotBanks[session.activeSlot],
        lang: session.lang,
        bpm: session.bpm,
        patternIndex: session.patternIndex,
      })
    } else {
      // defaults already in store; persist first session
      await this.persistSession()
    }
    await this.loadActiveBank()
    this.ready = true
    this.store.subscribe(() => this.scheduleAutosave())
  }

  currentBankName(): string {
    return this.store.state.bankName
  }

  private scheduleAutosave() {
    if (!this.ready) return
    if (this.saveTimer != null) window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => {
      void this.flush()
    }, 600)
  }

  async flush(): Promise<void> {
    const s = this.store.state
    const name = s.bankName || defaultBankName(s.bankIndex)
    await saveBankFromPads(s.bankIndex, name, s.pads, s.patterns[s.patternIndex])
    await this.persistSession()
  }

  async persistSession(): Promise<void> {
    const s = this.store.state
    const session: SessionMeta = {
      slotBanks: s.slotBanks,
      activeSlot: s.bankSlot,
      lang: s.lang,
      bpm: s.bpm,
      patternIndex: s.patternIndex,
    }
    await saveSession(session)
  }

  async loadActiveBank(): Promise<void> {
    const ctx = await this.engine.ensure()
    const idx = this.store.state.bankIndex
    const { meta, pads } = await loadBankPads(idx, ctx)
    this.store.patch({
      pads,
      bankName: meta.name,
      bankIndex: idx,
    })
    if (meta.pattern0) {
      const patterns = this.store.state.patterns.slice()
      patterns[0] = meta.pattern0
      this.store.patch({ patterns, patternIndex: 0 })
    }
  }

  /** Save current bank, retarget slot pointer, load new bank. */
  async selectBankForSlot(slot: 0 | 1 | 2 | 3, bankIndex: number): Promise<void> {
    await this.flush()
    const slotBanks = this.store.state.slotBanks.slice() as [number, number, number, number]
    slotBanks[slot] = bankIndex
    this.store.patch({ bankSlot: slot, bankIndex, slotBanks })
    await this.loadActiveBank()
    await this.persistSession()
  }

  async switchSlot(slot: 0 | 1 | 2 | 3): Promise<void> {
    if (slot === this.store.state.bankSlot) {
      // open bank mode only
      return
    }
    await this.flush()
    const bankIndex = this.store.state.slotBanks[slot]
    this.store.patch({ bankSlot: slot, bankIndex })
    await this.loadActiveBank()
    await this.persistSession()
  }

  async refreshNameFromIdb(): Promise<void> {
    const rec = await getBankRecord(this.store.state.bankIndex)
    if (rec) this.store.patch({ bankName: rec.name })
  }
}
