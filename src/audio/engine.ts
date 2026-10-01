import type { AppState, PadSample } from '../state/types'
import type { Store } from '../state/machine'

/** Simple bitcrusher via ScriptProcessor fallback → AudioWorklet-free WaveShaper + downsample stub using delay taps. */
export class AudioEngine {
  ctx: AudioContext | null = null
  masterGain!: GainNode
  filter!: BiquadFilterNode
  delay!: DelayNode
  delayFeedback!: GainNode
  delayWet!: GainNode
  dryGain!: GainNode
  crushGain!: GainNode
  crushBitDepth = 8
  private voices = new Map<number, { src: AudioBufferSourceNode; gain: GainNode }>()
  private seqTimer: number | null = null
  private store: Store
  private mediaStream: MediaStream | null = null
  private recNode: ScriptProcessorNode | null = null
  private recChunks: Float32Array[] = []
  private recording = false

  constructor(store: Store) {
    this.store = store
  }

  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 48000 })
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.9

      this.filter = this.ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 12000
      this.filter.Q.value = 0.7

      this.dryGain = this.ctx.createGain()
      this.dryGain.gain.value = 1

      this.delay = this.ctx.createDelay(1.0)
      this.delay.delayTime.value = 0.2
      this.delayFeedback = this.ctx.createGain()
      this.delayFeedback.gain.value = 0.35
      this.delayWet = this.ctx.createGain()
      this.delayWet.gain.value = 0.25

      this.crushGain = this.ctx.createGain()
      this.crushGain.gain.value = 0

      // dry path
      this.filter.connect(this.dryGain)
      this.dryGain.connect(this.masterGain)

      // delay send from filter
      this.filter.connect(this.delay)
      this.delay.connect(this.delayFeedback)
      this.delayFeedback.connect(this.delay)
      this.delay.connect(this.delayWet)
      this.delayWet.connect(this.masterGain)

      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  /** Generate short placeholder tones if pad empty — click / noise / beep by index. */
  generatePlaceholder(padIndex: number): AudioBuffer {
    const ctx = this.ctx!
    const dur = 0.12 + (padIndex % 4) * 0.05
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    const kind = padIndex % 5
    const freq = 110 * Math.pow(2, (padIndex % 12) / 12)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      const env = Math.exp(-t * (8 + kind * 3))
      let s = 0
      if (kind === 0) s = (Math.random() * 2 - 1) * env // noise
      else if (kind === 1) s = Math.sin(2 * Math.PI * freq * t) * env // sine
      else if (kind === 2) s = Math.sign(Math.sin(2 * Math.PI * freq * t)) * env // square-ish
      else if (kind === 3) s = (1 - ((t * freq) % 1) * 2) * env // saw
      else s = Math.sin(2 * Math.PI * freq * t) * Math.sin(2 * Math.PI * (freq * 1.5) * t) * env
      data[i] = s * 0.5
    }
    return buf
  }

  applyFxFromState(s: AppState) {
    if (!this.ctx) return
    // FX1
    if (s.fx1Type === 'filter') {
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 200 + s.fx1P1 * 14000
      this.filter.Q.value = 0.5 + s.fx1P2 * 8
      this.crushGain.gain.value = 0
    } else if (s.fx1Type === 'bitcrush') {
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 2000 + s.fx1P2 * 10000
      this.crushBitDepth = Math.max(2, Math.round(4 + s.fx1P1 * 12))
      // stub: bitcrush approximated by harsh lowpass + gain duck — real crush in playPad waveshaper
    } else if (s.fx1Type === 'flanger' || s.fx1Type === 'phaser') {
      this.filter.type = 'allpass'
      this.filter.frequency.value = 200 + s.fx1P1 * 4000
      this.filter.Q.value = 1 + s.fx1P2 * 10
    } else {
      // mpan — stub via master gain asymmetry (mono device)
      this.filter.type = 'peaking'
      this.filter.frequency.value = 1000
      this.filter.gain.value = (s.fx1P1 - 0.5) * 12
    }

    // FX2 delay
    const beat = 60 / s.bpm
    const div = s.fx2Type === 'roll4' ? 0.25 : s.fx2Type === 'roll8' ? 0.125 : s.fx2Type === 'roll16' ? 0.0625 : 0.125
    if (s.fx2Type === 'delay') {
      this.delay.delayTime.value = 0.05 + s.fx2P1 * 0.55
      this.delayFeedback.gain.value = s.fx2P2 * 0.7
      this.delayWet.gain.value = 0.15 + s.fx2P2 * 0.35
    } else {
      this.delay.delayTime.value = beat * div * 4
      this.delayFeedback.gain.value = 0.1 + s.fx2P1 * 0.6
      this.delayWet.gain.value = s.fx2P2 * 0.5
    }
  }

  stopVoice(padIndex: number) {
    const v = this.voices.get(padIndex)
    if (v) {
      try {
        v.src.stop()
      } catch {
        /* already stopped */
      }
      try {
        v.src.disconnect()
        v.gain.disconnect()
      } catch {
        /* */
      }
      this.voices.delete(padIndex)
    }
  }

  playPad(padIndex: number, pad: PadSample, state: AppState) {
    if (!this.ctx) return
    this.applyFxFromState(state)

    let buffer = pad.buffer
    if (!buffer) {
      buffer = this.generatePlaceholder(padIndex)
    }

    if (pad.playMode === 'loop' && this.voices.has(padIndex)) {
      this.stopVoice(padIndex)
      return
    }
    if (pad.playMode === 'oneshot') {
      this.stopVoice(padIndex)
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buffer

    let rate = pad.speed * Math.pow(2, pad.pitchSemitones / 12)
    // Beat Sync stub: stretch/rate align for loop pads
    if (state.beatSync && pad.playMode === 'loop' && buffer.duration > 0) {
      const usable = buffer.duration * (pad.end - pad.start)
      const beats = 4 // assume 1 bar loop
      const targetDur = (60 / state.bpm) * beats
      if (usable > 0.01) rate *= usable / targetDur
    }
    src.playbackRate.value = Math.max(0.1, Math.min(4, rate))
    src.loop = pad.playMode === 'loop'
    if (src.loop) {
      src.loopStart = pad.start * buffer.duration
      src.loopEnd = pad.end * buffer.duration
    }

    const gain = this.ctx.createGain()
    gain.gain.value = pad.volume

    // optional soft bitcrush via WaveShaper when FX1=bitcrush
    let node: AudioNode = src
    if (state.fx1Type === 'bitcrush') {
      const shaper = this.ctx.createWaveShaper()
      const bits = this.crushBitDepth
      const n = 256
      const curve = new Float32Array(n)
      const levels = Math.pow(2, bits)
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1
        curve[i] = Math.round(x * levels) / levels
      }
      shaper.curve = curve
      src.connect(shaper)
      node = shaper
    }

    node.connect(gain)
    gain.connect(this.filter)

    const offset = pad.start * buffer.duration
    const dur = (pad.end - pad.start) * buffer.duration
    try {
      if (pad.playMode === 'loop') src.start(0, offset)
      else src.start(0, offset, Math.max(0.01, dur))
    } catch {
      src.start()
    }

    src.onended = () => {
      if (this.voices.get(padIndex)?.src === src) this.voices.delete(padIndex)
    }
    this.voices.set(padIndex, { src, gain })
  }

  stopAll() {
    for (const i of [...this.voices.keys()]) this.stopVoice(i)
  }

  startSequencer() {
    this.stopSequencer()
    const tick = () => {
      const s = this.store.state
      const step = s.seqStep
      const pat = s.patterns[s.patternIndex]
      for (let t = 0; t < 16; t++) {
        if (pat.steps[t][step]) {
          this.playPad(t, s.pads[t], s)
        }
      }
      const next = (step + 1) % 16
      this.store.patch({ seqStep: next })
      const ms = (60 / s.bpm) * 1000 / 4
      this.seqTimer = window.setTimeout(tick, ms)
    }
    this.store.patch({ seqPlaying: true, seqStep: 0 })
    tick()
  }

  stopSequencer() {
    if (this.seqTimer != null) {
      clearTimeout(this.seqTimer)
      this.seqTimer = null
    }
    this.store.patch({ seqPlaying: false, seqStep: 0 })
  }

  toggleSequencer() {
    if (this.store.state.seqPlaying) this.stopSequencer()
    else void this.ensure().then(() => this.startSequencer())
  }

  async loadFileToPad(padIndex: number, file: File) {
    const ctx = await this.ensure()
    const ab = await file.arrayBuffer()
    const buffer = await ctx.decodeAudioData(ab.slice(0))
    this.store.setPadBuffer(padIndex, buffer, file.name.replace(/\.[^.]+$/, ''))
  }

  /** Seed all empty pads with placeholders so seq is immediately audible. */
  async seedPlaceholders() {
    await this.ensure()
    const pads = this.store.state.pads.slice()
    for (let i = 0; i < 16; i++) {
      if (!pads[i].buffer) {
        pads[i] = {
          ...pads[i],
          buffer: this.generatePlaceholder(i),
          name: `Tone ${String(i + 1).padStart(2, '0')}`,
        }
      }
    }
    this.store.patch({ pads })
  }

  async startRecStub() {
    await this.ensure()
    this.store.patch({ recArmed: true, mode: 'REC' })
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const src = this.ctx!.createMediaStreamSource(this.mediaStream)
      this.recChunks = []
      this.recording = true
      const proc = this.ctx!.createScriptProcessor(4096, 1, 1)
      this.recNode = proc
      proc.onaudioprocess = (e) => {
        if (!this.recording) return
        const input = e.inputBuffer.getChannelData(0)
        this.recChunks.push(new Float32Array(input))
        let peak = 0
        for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs(input[i]))
        this.store.patch({ recPeak: peak })
      }
      src.connect(proc)
      proc.connect(this.ctx!.destination)
    } catch {
      // No mic — simulate peak
      this.recording = true
      const id = window.setInterval(() => {
        if (!this.store.state.recArmed) {
          clearInterval(id)
          return
        }
        this.store.patch({ recPeak: Math.random() * 0.6 })
      }, 100)
    }
  }

  stopRecToPad(padIndex: number) {
    this.recording = false
    if (this.recNode) {
      try {
        this.recNode.disconnect()
      } catch {
        /* */
      }
      this.recNode = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.ctx && this.recChunks.length) {
      const total = this.recChunks.reduce((a, c) => a + c.length, 0)
      const buf = this.ctx.createBuffer(1, Math.max(1, total), this.ctx.sampleRate)
      const data = buf.getChannelData(0)
      let o = 0
      for (const c of this.recChunks) {
        data.set(c, o)
        o += c.length
      }
      this.store.setPadBuffer(padIndex, buf, `Rec ${padIndex + 1}`)
    }
    this.recChunks = []
    this.store.patch({ recArmed: false, recPeak: 0, mode: 'PLAY' })
  }

  /** Naive auto-chop: equal slices of source pad into consecutive pads. */
  applyAutoChop(srcPad: number, slices: number) {
    const src = this.store.state.pads[srcPad]
    if (!src.buffer || !this.ctx) return
    const buf = src.buffer
    const n = Math.max(2, Math.min(16, slices))
    const sliceLen = Math.floor(buf.length / n)
    for (let i = 0; i < n; i++) {
      const start = i * sliceLen
      const len = i === n - 1 ? buf.length - start : sliceLen
      const out = this.ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate)
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        out.copyToChannel(buf.getChannelData(ch).subarray(start, start + len), ch)
      }
      this.store.setPadBuffer(i, out, `Chop ${i + 1}`)
    }
  }
}
