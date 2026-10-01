import type { PadPlayMode, PadSample, Pattern } from '../state/types'

export const BANK_FORMAT = 'pocket-chop-bank' as const
export const BANK_VERSION = 1
export const MAX_BANKS = 80

export interface BankPadJson {
  index: number
  name: string
  file: string | null
  start: number
  end: number
  pitchSemitones: number
  speed: number
  volume: number
  playMode: PadPlayMode
  sampleRate?: number
  channels?: number
  audioBase64?: string | null
}

export interface BankFileJson {
  format: typeof BANK_FORMAT
  version: number
  bankIndex: number
  name: string
  bpm: number
  createdAt: string
  updatedAt: string
  pads: BankPadJson[]
  patterns?: { index: number; bars: number; steps: boolean[][] }[]
  notes?: string
}

export interface BankMeta {
  bankIndex: number
  name: string
  updatedAt: string
  padCount: number
}

export function defaultBankName(i: number): string {
  return `Bank ${String(i).padStart(2, '0')}`
}

export function padsToJson(pads: PadSample[], withFileRefs: boolean): BankPadJson[] {
  return pads.map((p, index) => ({
    index,
    name: p.name,
    file: withFileRefs && p.buffer ? `pads/${String(index + 1).padStart(2, '0')}.wav` : null,
    start: p.start,
    end: p.end,
    pitchSemitones: p.pitchSemitones,
    speed: p.speed,
    volume: p.volume,
    playMode: p.playMode,
    sampleRate: p.buffer?.sampleRate,
    channels: p.buffer?.numberOfChannels,
    audioBase64: null,
  }))
}

export function buildBankJson(opts: {
  bankIndex: number
  name: string
  bpm: number
  pads: PadSample[]
  patterns?: Pattern[]
  createdAt?: string
}): BankFileJson {
  const now = new Date().toISOString()
  const patterns =
    opts.patterns?.slice(0, 1).map((p, index) => ({
      index,
      bars: p.bars,
      steps: p.steps.map((row) => row.slice()),
    })) ?? undefined
  return {
    format: BANK_FORMAT,
    version: BANK_VERSION,
    bankIndex: opts.bankIndex,
    name: opts.name.slice(0, 24),
    bpm: opts.bpm,
    createdAt: opts.createdAt ?? now,
    updatedAt: now,
    pads: padsToJson(opts.pads, true),
    patterns,
  }
}

export function parseBankJson(raw: unknown): BankFileJson {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid bank JSON')
  const o = raw as Record<string, unknown>
  if (o.format !== BANK_FORMAT) throw new Error(`Unknown format: ${String(o.format)}`)
  if (typeof o.version !== 'number') throw new Error('Missing version')
  const bankIndex = Number(o.bankIndex) || 1
  if (bankIndex < 1 || bankIndex > MAX_BANKS) throw new Error('bankIndex out of range')
  return o as unknown as BankFileJson
}

export function emptyPads(): PadSample[] {
  return Array.from({ length: 16 }, (_, i) => ({
    name: `Pad ${String(i + 1).padStart(2, '0')}`,
    buffer: null,
    start: 0,
    end: 1,
    pitchSemitones: 0,
    speed: 1,
    volume: 0.8,
    playMode: 'oneshot' as PadPlayMode,
  }))
}

export function applyPadMeta(pads: PadSample[], metas: BankPadJson[]): PadSample[] {
  const next = pads.slice()
  for (const m of metas) {
    if (m.index < 0 || m.index > 15) continue
    next[m.index] = {
      ...next[m.index],
      name: m.name || next[m.index].name,
      start: m.start ?? 0,
      end: m.end ?? 1,
      pitchSemitones: m.pitchSemitones ?? 0,
      speed: m.speed ?? 1,
      volume: m.volume ?? 0.8,
      playMode: m.playMode === 'loop' ? 'loop' : 'oneshot',
    }
  }
  return next
}
