import type { Store } from '../state/machine'
import type { AppState, UiMode } from '../state/types'

const W = 128
const H = 64

/** 5x7 bitmap font (subset) packed as columns bit0=top */
const FONT: Record<string, number[]> = {}
function def(ch: string, cols: number[]) {
  FONT[ch] = cols
}
// Minimal readable 5x7
;[
  [' ', [0, 0, 0, 0, 0]],
  ['0', [0x3e, 0x51, 0x49, 0x45, 0x3e]],
  ['1', [0x00, 0x42, 0x7f, 0x40, 0x00]],
  ['2', [0x42, 0x61, 0x51, 0x49, 0x46]],
  ['3', [0x21, 0x41, 0x45, 0x4b, 0x31]],
  ['4', [0x18, 0x14, 0x12, 0x7f, 0x10]],
  ['5', [0x27, 0x45, 0x45, 0x45, 0x39]],
  ['6', [0x3c, 0x4a, 0x49, 0x49, 0x30]],
  ['7', [0x01, 0x71, 0x09, 0x05, 0x03]],
  ['8', [0x36, 0x49, 0x49, 0x49, 0x36]],
  ['9', [0x06, 0x49, 0x49, 0x29, 0x1e]],
  ['A', [0x7e, 0x11, 0x11, 0x11, 0x7e]],
  ['B', [0x7f, 0x49, 0x49, 0x49, 0x36]],
  ['C', [0x3e, 0x41, 0x41, 0x41, 0x22]],
  ['D', [0x7f, 0x41, 0x41, 0x22, 0x1c]],
  ['E', [0x7f, 0x49, 0x49, 0x49, 0x41]],
  ['F', [0x7f, 0x09, 0x09, 0x09, 0x01]],
  ['G', [0x3e, 0x41, 0x49, 0x49, 0x7a]],
  ['H', [0x7f, 0x08, 0x08, 0x08, 0x7f]],
  ['I', [0x00, 0x41, 0x7f, 0x41, 0x00]],
  ['J', [0x20, 0x40, 0x41, 0x3f, 0x01]],
  ['K', [0x7f, 0x08, 0x14, 0x22, 0x41]],
  ['L', [0x7f, 0x40, 0x40, 0x40, 0x40]],
  ['M', [0x7f, 0x02, 0x0c, 0x02, 0x7f]],
  ['N', [0x7f, 0x04, 0x08, 0x10, 0x7f]],
  ['O', [0x3e, 0x41, 0x41, 0x41, 0x3e]],
  ['P', [0x7f, 0x09, 0x09, 0x09, 0x06]],
  ['Q', [0x3e, 0x41, 0x51, 0x21, 0x5e]],
  ['R', [0x7f, 0x09, 0x19, 0x29, 0x46]],
  ['S', [0x46, 0x49, 0x49, 0x49, 0x31]],
  ['T', [0x01, 0x01, 0x7f, 0x01, 0x01]],
  ['U', [0x3f, 0x40, 0x40, 0x40, 0x3f]],
  ['V', [0x1f, 0x20, 0x40, 0x20, 0x1f]],
  ['W', [0x3f, 0x40, 0x38, 0x40, 0x3f]],
  ['X', [0x63, 0x14, 0x08, 0x14, 0x63]],
  ['Y', [0x07, 0x08, 0x70, 0x08, 0x07]],
  ['Z', [0x61, 0x51, 0x49, 0x45, 0x43]],
  [':', [0x00, 0x36, 0x36, 0x00, 0x00]],
  ['/', [0x60, 0x30, 0x18, 0x0c, 0x06]],
  ['-', [0x08, 0x08, 0x08, 0x08, 0x08]],
  ['_', [0x40, 0x40, 0x40, 0x40, 0x40]],
  ['.', [0x00, 0x60, 0x60, 0x00, 0x00]],
  ['*', [0x14, 0x08, 0x3e, 0x08, 0x14]],
  ['>', [0x00, 0x41, 0x22, 0x14, 0x08]],
  ['<', [0x08, 0x14, 0x22, 0x41, 0x00]],
  ['?', [0x02, 0x01, 0x51, 0x09, 0x06]],
  ['%', [0x23, 0x13, 0x08, 0x64, 0x62]],
  ['+', [0x08, 0x08, 0x3e, 0x08, 0x08]],
  ['=', [0x14, 0x14, 0x14, 0x14, 0x14]],
  ['[', [0x00, 0x7f, 0x41, 0x41, 0x00]],
  [']', [0x00, 0x41, 0x41, 0x7f, 0x00]],
  ['(', [0x00, 0x1c, 0x22, 0x41, 0x00]],
  [')', [0x00, 0x41, 0x22, 0x1c, 0x00]],
  [',', [0x00, 0x80, 0x60, 0x00, 0x00]],
  ['!', [0x00, 0x00, 0x5f, 0x00, 0x00]],
  ['#', [0x14, 0x7f, 0x14, 0x7f, 0x14]],
  ['&', [0x36, 0x49, 0x55, 0x22, 0x50]],
].forEach(([c, cols]) => def(c as string, cols as number[]))

function ascii(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '?')
    .toUpperCase()
}

export class OledRenderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  store: Store
  private pixels: Uint8Array

  constructor(canvas: HTMLCanvasElement, store: Store) {
    this.canvas = canvas
    this.store = store
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext('2d')!
    this.pixels = new Uint8Array(W * H)
  }

  clear() {
    this.pixels.fill(0)
  }

  set(x: number, y: number, on = true) {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    this.pixels[y * W + x] = on ? 1 : 0
  }

  fillRect(x: number, y: number, w: number, h: number, on = true) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, on)
  }

  hline(x: number, y: number, w: number) {
    for (let i = 0; i < w; i++) this.set(x + i, y)
  }

  text(x: number, y: number, str: string) {
    const s = ascii(str)
    let cx = x
    for (const ch of s) {
      const cols = FONT[ch] || FONT['?']
      for (let c = 0; c < 5; c++) {
        const bits = cols[c]
        for (let r = 0; r < 7; r++) {
          if (bits & (1 << r)) this.set(cx + c, y + r)
        }
      }
      cx += 6
      if (cx > W - 5) break
    }
  }

  flush() {
    const img = this.ctx.createImageData(W, H)
    for (let i = 0; i < this.pixels.length; i++) {
      const on = this.pixels[i]
      // amber OLED vibe on dark
      const o = i * 4
      if (on) {
        img.data[o] = 180
        img.data[o + 1] = 220
        img.data[o + 2] = 80
        img.data[o + 3] = 255
      } else {
        img.data[o] = 10
        img.data[o + 1] = 14
        img.data[o + 2] = 8
        img.data[o + 3] = 255
      }
    }
    this.ctx.putImageData(img, 0, 0)
  }

  render() {
    const s = this.store.state
    const mode = this.store.displayMode()
    this.clear()
    switch (mode) {
      case 'PLAY': this.drawPlay(s); break
      case 'BANK': this.drawBank(s); break
      case 'SEQ': this.drawSeq(s); break
      case 'SEQ_EDIT': this.drawSeqEdit(s); break
      case 'REC': this.drawRec(s); break
      case 'AUTO_CHOP': this.drawAutoChop(s); break
      case 'DEL': this.drawDel(s); break
      case 'EDIT': this.drawEdit(s); break
      case 'FX1': this.drawFx1(s); break
      case 'FX2': this.drawFx2(s); break
      case 'SYS': this.drawSys(s); break
      case 'SYS_BEAT': this.drawSysBeat(s); break
      case 'SYS_MIDI': this.drawSysMidi(s); break
      case 'SYS_INIT': this.drawSysInit(s); break
      default: this.text(0, 0, String(mode))
    }
    this.flush()
  }

  private slotLetter(s: AppState) { return 'ABCD'[s.bankSlot] }

  private drawPlay(s: AppState) {
    const zh = s.lang === 'zh'
    this.text(0, 0, `${this.slotLetter(s)}${String(s.bankIndex).padStart(2, '0')} ${s.bpm}BPM`)
    this.text(80, 0, s.seqPlaying ? '>' : ' ')
    const pad = s.pads[s.selectedPad]
    this.text(0, 10, `PAD ${String(s.selectedPad + 1).padStart(2, '0')} ${pad.name}`)
    this.text(0, 20, pad.playMode === 'loop' ? (zh ? 'LOOP' : 'LOOP') : 'OSHOT')
    for (let i = 0; i < 16; i++) {
      const x = 2 + (i % 8) * 15
      const y = 32 + Math.floor(i / 8) * 10
      const has = !!s.pads[i].buffer
      if (i === s.selectedPad) this.fillRect(x - 1, y - 1, 12, 9)
      if (has) this.fillRect(x, y, 10, 7, i !== s.selectedPad)
      else this.hline(x, y + 3, 10)
    }
    this.text(0, 56, `FX1:${s.fx1Type.slice(0, 5)} FX2:${s.fx2Type.slice(0, 3)}`)
  }

  private drawBank(s: AppState) {
    this.text(0, 0, s.lang === 'zh' ? 'BANK SELECT' : 'BANK SELECT')
    const labels = ['A', 'B', 'C', 'D']
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 28
      if (i === s.bankSlot) this.fillRect(x - 2, 20, 16, 12)
      this.text(x, 22, i === s.bankSlot ? `[${labels[i]}]` : ` ${labels[i]} `)
    }
    this.text(0, 40, `BANK ${String(s.bankIndex).padStart(2, '0')}/80`)
    this.text(0, 50, (s.bankName || '').slice(0, 20))
    this.text(0, 58, 'ENTER=OK')
  }

  private drawSeq(s: AppState) {
    const pat = s.patterns[s.patternIndex]
    this.text(0, 0, `SEQ P${String(s.patternIndex + 1).padStart(2, '0')} T${String(s.selectedPad + 1).padStart(2, '0')}`)
    const track = pat.steps[s.selectedPad]
    for (let i = 0; i < 16; i++) {
      const x = 2 + i * 8
      const on = track[i]
      const playhead = s.seqPlaying && s.seqStep === i
      if (on) this.fillRect(x, 14, 6, 10)
      else this.fillRect(x, 18, 6, 2)
      if (playhead) this.hline(x, 26, 6)
    }
    this.text(0, 32, `BPM${s.bpm} BAR1/${pat.bars}`)
    this.text(0, 44, s.seqPlaying ? '> PLAYING' : '  STOPPED')
    this.text(0, 56, 'PAD=TOGGLE EDIT')
  }

  private drawSeqEdit(s: AppState) {
    const items = [`PATTERN ${String(s.patternIndex + 1).padStart(2, '0')}`, `BARS ${s.patterns[s.patternIndex].bars}`, `QUANT ${s.quantize}`, `SWING ${s.swing}%`]
    this.text(0, 0, 'SEQ SETTINGS')
    items.forEach((t, i) => this.text(0, 12 + i * 10, (i === s.seqEditIndex ? '>' : ' ') + t))
    this.text(0, 56, 'BACK=SAVE')
  }

  private drawRec(s: AppState) {
    this.text(0, 0, `REC IN:${s.inputSource.toUpperCase().slice(0, 6)}`)
    this.text(0, 12, s.recArmed ? '*RECORDING*' : ' WAITING')
    const bars = Math.round(s.recPeak * 16)
    this.text(0, 28, 'LVL'); this.fillRect(24, 28, Math.max(1, bars * 6), 8)
    this.text(0, 44, 'STOP THEN PAD'); this.text(0, 56, 'TO ASSIGN')
  }

  private drawAutoChop(s: AppState) {
    this.text(0, 0, 'AUTO CHOP'); this.text(0, 14, `SRC PAD ${String(s.selectedPad + 1).padStart(2, '0')}`)
    this.text(0, 28, `> SLICES ${s.autoChopSlices}`); this.text(0, 40, `  THRESH ${['LO', 'MED', 'HI'][s.autoChopThresh] || 'MED'}`); this.text(0, 56, 'ENTER=APPLY')
  }
  private drawDel(s: AppState) { this.text(0, 0, 'DELETE'); this.text(0, 16, `PAD ${String(s.selectedPad + 1).padStart(2, '0')}`); this.text(0, 28, s.pads[s.selectedPad].name); this.text(0, 44, s.delYes ? '[YES]  NO' : ' YES  [NO]'); this.text(0, 56, 'ENTER/BACK') }
  private drawEdit(s: AppState) {
    const p = s.pads[s.selectedPad]
    this.text(0, 0, `EDIT PAD ${String(s.selectedPad + 1).padStart(2, '0')}`)
    for (let i = 0; i < 64; i++) { const h = 2 + Math.round(6 * Math.abs(Math.sin(i / 5 + s.selectedPad))); this.fillRect(32 + i, 20 - h / 2, 1, h) }
    const sw = Math.round(p.start * 64); const ew = Math.round(p.end * 64); this.hline(32 + sw, 26, Math.max(1, ew - sw))
    const params = [`START ${p.start.toFixed(2)}`, `END   ${p.end.toFixed(2)}`, `PITCH ${p.pitchSemitones >= 0 ? '+' : ''}${p.pitchSemitones}`, `SPEED ${Math.round(p.speed * 100)}%`, `VOL   ${Math.round(p.volume * 100)}%`, `MODE  ${p.playMode === 'loop' ? 'LOOP' : 'ONE'}`]
    const idx = s.editParam % params.length; this.text(0, 32, '>' + params[idx]); this.text(0, 44, ' ' + params[(idx + 1) % params.length]); this.text(0, 56, 'BACK=OK')
  }
  private drawFx1(s: AppState) { this.text(0, 0, 'FX1 *HOLD*'); this.text(0, 14, `TYPE ${s.fx1Type.toUpperCase()}`); this.text(0, 28, `P1 ${Math.round(s.fx1P1 * 100)}`); this.text(0, 40, `P2 ${Math.round(s.fx1P2 * 100)}`); this.text(0, 56, 'KNOBS/ARROWS') }
  private drawFx2(s: AppState) { this.text(0, 0, 'FX2 *HOLD*'); this.text(0, 14, `TYPE ${s.fx2Type.toUpperCase()}`); this.text(0, 28, `P1 ${Math.round(s.fx2P1 * 100)}`); this.text(0, 40, `P2 ${Math.round(s.fx2P2 * 100)}`); this.text(0, 56, 'KNOBS/ARROWS') }
  private drawSys(s: AppState) { const items = ['BEAT SYNC...', 'MIDI...', 'INITIALIZE...', 'ABOUT POCKET CHOP']; this.text(0, 0, 'SYSTEM'); items.forEach((t, i) => this.text(0, 12 + i * 10, (i === s.sysIndex ? '>' : ' ') + t.slice(0, 20))) }
  private drawSysBeat(s: AppState) { this.text(0, 0, 'BEAT SYNC'); this.text(0, 14, `ENABLE ${s.beatSync ? 'ON' : 'OFF'}`); this.text(0, 26, `BPM ${s.bpm}`); this.text(0, 38, `STRETCH ${s.beatSync ? 'ON' : 'OFF'}`); this.text(0, 50, 'MUTEX MIDI SYNC') }
  private drawSysMidi(s: AppState) { this.text(0, 0, 'MIDI'); this.text(0, 12, `CH ${String(s.midiChannel).padStart(2, '0')}`); this.text(0, 24, `CLK IN ${s.midiClockIn ? 'ON' : 'OFF'}`); this.text(0, 36, `CLK OUT ${s.midiClockOut ? 'ON' : 'OFF'}`); this.text(0, 48, `SYNC ${s.midiSync ? 'ON' : 'OFF'}`) }
  private drawSysInit(s: AppState) { this.text(0, 0, 'INITIALIZE'); this.text(0, 20, 'WIPE ALL?'); this.text(0, 40, s.delYes ? '[YES]  NO' : ' YES  [NO]') }
}

export type { UiMode }
