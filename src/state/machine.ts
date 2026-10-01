import type {
  AppState,
  Fx1Type,
  Fx2Type,
  Listener,
  PadSample,
  Pattern,
  UiMode,
} from './types'

const FX1_TYPES: Fx1Type[] = ['filter', 'flanger', 'phaser', 'bitcrush', 'mpan']
const FX2_TYPES: Fx2Type[] = ['delay', 'roll16', 'roll8', 'roll4']

function emptyPattern(): Pattern {
  return {
    bars: 1,
    steps: Array.from({ length: 16 }, () => Array(16).fill(false)),
  }
}

function emptyPad(i: number): PadSample {
  return {
    name: `Pad ${String(i + 1).padStart(2, '0')}`,
    buffer: null,
    start: 0,
    end: 1,
    pitchSemitones: 0,
    speed: 1,
    volume: 0.8,
    playMode: 'oneshot',
  }
}

export function createInitialState(): AppState {
  const patterns = Array.from({ length: 50 }, () => emptyPattern())
  // Seed a simple demo pattern on track 0
  patterns[0].steps[0][0] = true
  patterns[0].steps[0][4] = true
  patterns[0].steps[0][8] = true
  patterns[0].steps[0][12] = true
  patterns[0].steps[1][4] = true
  patterns[0].steps[1][12] = true

  return {
    mode: 'PLAY',
    prevMode: 'PLAY',
    lang: 'zh',
    bankSlot: 0,
    slotBanks: [1, 2, 3, 4],
    bankIndex: 1,
    bankName: 'Bank 01',
    selectedPad: 0,
    bpm: 120,
    seqPlaying: false,
    seqStep: 0,
    patternIndex: 0,
    patterns,
    pads: Array.from({ length: 16 }, (_, i) => emptyPad(i)),
    editParam: 0,
    delYes: true,
    sysIndex: 0,
    seqEditIndex: 0,
    autoChopSlices: 16,
    autoChopThresh: 1,
    fx1Type: 'filter',
    fx1P1: 0.8,
    fx1P2: 0.2,
    fx2Type: 'delay',
    fx2P1: 0.35,
    fx2P2: 0.35,
    fx1Held: false,
    fx2Held: false,
    beatSync: false,
    midiSync: false,
    midiChannel: 1,
    midiClockIn: true,
    midiClockOut: false,
    inputSource: 'usb',
    recArmed: false,
    recPeak: 0,
    swing: 0,
    quantize: '1/16',
  }
}

export class Store {
  state: AppState
  private listeners = new Set<Listener>()

  constructor(initial?: AppState) {
    this.state = initial ?? createInitialState()
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  patch(partial: Partial<AppState>) {
    Object.assign(this.state, partial)
    this.emit()
  }

  setMode(mode: UiMode) {
    if (mode === this.state.mode) return
    this.state.prevMode = this.state.mode
    this.state.mode = mode
    this.emit()
  }

  /** Effective display mode (FX overlays win while held). */
  displayMode(): UiMode {
    if (this.state.fx1Held) return 'FX1'
    if (this.state.fx2Held) return 'FX2'
    return this.state.mode
  }

  goBack() {
    const m = this.state.mode
    if (m === 'BANK' || m === 'DEL' || m === 'REC' || m === 'AUTO_CHOP' || m === 'EDIT' || m === 'SYS') {
      this.setMode('PLAY')
      this.patch({ recArmed: false })
      return
    }
    if (m === 'SEQ') {
      this.setMode('PLAY')
      return
    }
    if (m === 'SEQ_EDIT') {
      this.setMode('SEQ')
      return
    }
    if (m === 'SYS_BEAT' || m === 'SYS_MIDI' || m === 'SYS_INIT') {
      this.setMode('SYS')
      return
    }
  }

  cycleFx1Type(dir: 1 | -1) {
    const i = FX1_TYPES.indexOf(this.state.fx1Type)
    const n = FX1_TYPES[(i + dir + FX1_TYPES.length) % FX1_TYPES.length]
    this.patch({ fx1Type: n })
  }

  cycleFx2Type(dir: 1 | -1) {
    const i = FX2_TYPES.indexOf(this.state.fx2Type)
    const n = FX2_TYPES[(i + dir + FX2_TYPES.length) % FX2_TYPES.length]
    this.patch({ fx2Type: n })
  }

  toggleStep(track: number, step: number) {
    const p = this.state.patterns[this.state.patternIndex]
    p.steps[track][step] = !p.steps[track][step]
    this.emit()
  }

  setBeatSync(on: boolean) {
    if (on) this.patch({ beatSync: true, midiSync: false })
    else this.patch({ beatSync: false })
  }

  setMidiSync(on: boolean) {
    if (on) this.patch({ midiSync: true, beatSync: false })
    else this.patch({ midiSync: false })
  }

  clearPad(i: number) {
    const pads = this.state.pads.slice()
    pads[i] = emptyPad(i)
    this.patch({ pads })
  }

  setPadBuffer(i: number, buffer: AudioBuffer, name: string) {
    const pads = this.state.pads.slice()
    pads[i] = {
      ...pads[i],
      buffer,
      name: name.slice(0, 12),
      start: 0,
      end: 1,
    }
    this.patch({ pads })
  }
}

export { FX1_TYPES, FX2_TYPES }
