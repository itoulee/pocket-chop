import JSZip from 'jszip'
import type { PadSample, Pattern } from '../state/types'
import {
  applyPadMeta,
  buildBankJson,
  emptyPads,
  parseBankJson,
  type BankFileJson,
} from './format'
import { audioBufferToWav } from './wav'
import { saveBankFromPads, loadBankPads } from './idb'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportBankZip(
  bankIndex: number,
  name: string,
  pads: PadSample[],
  bpm: number,
  patterns?: Pattern[],
): Promise<void> {
  const json = buildBankJson({ bankIndex, name, bpm, pads, patterns })
  const zip = new JSZip()
  zip.file('pocket-chop-bank.json', JSON.stringify(json, null, 2))
  const folder = zip.folder('pads')
  for (let i = 0; i < 16; i++) {
    if (!pads[i].buffer) continue
    const wav = audioBufferToWav(pads[i].buffer!)
    folder!.file(`${String(i + 1).padStart(2, '0')}.wav`, wav)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const safe = name.replace(/[^\w\-]+/g, '_').slice(0, 24) || 'bank'
  downloadBlob(blob, `${String(bankIndex).padStart(2, '0')}-${safe}.pchbank.zip`)
}

export async function exportBankJsonMeta(
  bankIndex: number,
  name: string,
  pads: PadSample[],
  bpm: number,
  patterns?: Pattern[],
): Promise<void> {
  const json = buildBankJson({ bankIndex, name, bpm, pads, patterns })
  // strip file refs for meta-only clarity but keep structure
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${String(bankIndex).padStart(2, '0')}-pocket-chop-bank.json`)
}

export async function importBankFile(
  file: File,
  targetBankIndex: number,
  ctx: AudioContext,
): Promise<{ name: string; pads: PadSample[]; bpm: number; pattern0?: Pattern }> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.zip') || lower.endsWith('.pchbank.zip')) {
    return importBankZip(file, targetBankIndex, ctx)
  }
  if (lower.endsWith('.json')) {
    return importBankJsonOnly(file, targetBankIndex, ctx)
  }
  throw new Error('Use .json or .pchbank.zip')
}

async function importBankJsonOnly(
  file: File,
  targetBankIndex: number,
  ctx: AudioContext,
): Promise<{ name: string; pads: PadSample[]; bpm: number; pattern0?: Pattern }> {
  const text = await file.text()
  const data = parseBankJson(JSON.parse(text))
  let pads = applyPadMeta(emptyPads(), data.pads)
  // decode optional base64 wav/pcm not implemented; file refs ignored without zip
  for (const p of data.pads) {
    if (p.audioBase64) {
      try {
        const bin = Uint8Array.from(atob(p.audioBase64), (c) => c.charCodeAt(0))
        const buf = await ctx.decodeAudioData(bin.buffer.slice(0))
        pads[p.index] = { ...pads[p.index], buffer: buf }
      } catch {
        /* skip */
      }
    }
  }
  const pattern0 = data.patterns?.[0]
    ? { bars: data.patterns[0].bars, steps: data.patterns[0].steps }
    : undefined
  await saveBankFromPads(targetBankIndex, data.name, pads, pattern0)
  return { name: data.name, pads, bpm: data.bpm || 120, pattern0 }
}

async function importBankZip(
  file: File,
  targetBankIndex: number,
  ctx: AudioContext,
): Promise<{ name: string; pads: PadSample[]; bpm: number; pattern0?: Pattern }> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile =
    zip.file('pocket-chop-bank.json') ||
    zip.file(/pocket-chop-bank\.json$/i)[0] ||
    zip.file(/\.json$/i)[0]
  if (!jsonFile) throw new Error('ZIP missing pocket-chop-bank.json')
  const text = await jsonFile.async('string')
  const data = parseBankJson(JSON.parse(text))
  let pads = applyPadMeta(emptyPads(), data.pads)

  for (const meta of data.pads) {
    const path = meta.file || `pads/${String(meta.index + 1).padStart(2, '0')}.wav`
    const entry = zip.file(path) || zip.file(path.replace(/^\.\//, ''))
    if (!entry) continue
    const ab = await entry.async('arraybuffer')
    try {
      const buf = await ctx.decodeAudioData(ab.slice(0))
      pads[meta.index] = { ...pads[meta.index], buffer: buf }
    } catch (e) {
      console.warn('decode failed', path, e)
    }
  }

  // also pick up any pads/NN.wav not listed
  for (let i = 0; i < 16; i++) {
    if (pads[i].buffer) continue
    const nn = String(i + 1).padStart(2, '0')
    const entry = zip.file(`pads/${nn}.wav`) || zip.file(`${nn}.wav`)
    if (!entry) continue
    try {
      const buf = await ctx.decodeAudioData((await entry.async('arraybuffer')).slice(0))
      pads[i] = { ...pads[i], buffer: buf, name: pads[i].name || `Pad ${nn}` }
    } catch {
      /* */
    }
  }

  const pattern0 = data.patterns?.[0]
    ? { bars: data.patterns[0].bars, steps: data.patterns[0].steps }
    : undefined
  await saveBankFromPads(targetBankIndex, data.name || `Bank ${targetBankIndex}`, pads, pattern0)
  return {
    name: data.name || `Bank ${targetBankIndex}`,
    pads,
    bpm: data.bpm || 120,
    pattern0,
  }
}

/** Decode WAV/FLAC (if browser supports) into a pad buffer. */
export async function decodeAudioFile(ctx: AudioContext, file: File): Promise<AudioBuffer> {
  const ab = await file.arrayBuffer()
  return ctx.decodeAudioData(ab.slice(0))
}

export async function exportBankFromIdb(
  bankIndex: number,
  ctx: AudioContext,
  bpm: number,
  asZip: boolean,
): Promise<void> {
  const { meta, pads } = await loadBankPads(bankIndex, ctx)
  const name = meta.name
  const patterns = meta.pattern0 ? [meta.pattern0] : undefined
  if (asZip) await exportBankZip(bankIndex, name, pads, bpm, patterns)
  else await exportBankJsonMeta(bankIndex, name, pads, bpm, patterns)
}

export type { BankFileJson }
