export type UiMode =
  | 'PLAY'
  | 'BANK'
  | 'SEQ'
  | 'SEQ_EDIT'
  | 'REC'
  | 'AUTO_CHOP'
  | 'DEL'
  | 'EDIT'
  | 'FX1'
  | 'FX2'
  | 'SYS'
  | 'SYS_BEAT'
  | 'SYS_MIDI'
  | 'SYS_INIT'

export type PadPlayMode = 'oneshot' | 'loop'
export type Fx1Type = 'filter' | 'flanger' | 'phaser' | 'bitcrush' | 'mpan'
export type Fx2Type = 'delay' | 'roll16' | 'roll8' | 'roll4'
export type InputSource = 'mic' | 'audio_in' | 'usb'
export type Lang = 'zh' | 'en'

export interface PadSample {
  name: string
  buffer: AudioBuffer | null
  /** 0..1 normalized */
  start: number
  end: number
  pitchSemitones: number
  speed: number
  volume: number
  playMode: PadPlayMode
}

export interface Pattern {
  /** [track 0..15][step 0..15] */
  steps: boolean[][]
  bars: number
}

export interface AppState {
  mode: UiMode
  prevMode: UiMode
  lang: Lang
  bankSlot: 0 | 1 | 2 | 3
  /** A–D each point at library bank 1–80 */
  slotBanks: [number, number, number, number]
  bankIndex: number
  bankName: string
  selectedPad: number
  bpm: number
  seqPlaying: boolean
  seqStep: number
  patternIndex: number
  patterns: Pattern[]
  pads: PadSample[]
  editParam: number
  delYes: boolean
  sysIndex: number
  seqEditIndex: number
  autoChopSlices: number
  autoChopThresh: number
  fx1Type: Fx1Type
  fx1P1: number
  fx1P2: number
  fx2Type: Fx2Type
  fx2P1: number
  fx2P2: number
  fx1Held: boolean
  fx2Held: boolean
  beatSync: boolean
  midiSync: boolean
  midiChannel: number
  midiClockIn: boolean
  midiClockOut: boolean
  inputSource: InputSource
  recArmed: boolean
  recPeak: number
  swing: number
  quantize: string
}

export type Listener = () => void
