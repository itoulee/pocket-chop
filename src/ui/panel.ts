import type { Store } from '../state/machine'
import type { AudioEngine } from '../audio/engine'
import type { BankManager } from '../bank/manager'
import { OledRenderer } from './oled'
import { createInitialState } from '../state/machine'
import { mountLibraryPanel } from './library'
import { getBankRecord } from '../bank/idb'
import { createRotaryKnob } from './knob'

export function mountApp(
  root: HTMLElement,
  store: Store,
  engine: AudioEngine,
  banks: BankManager,
) {
  root.innerHTML = `
    <header class="app-chrome">
      <h1>Pocket Chop <span class="muted">SXC Remake</span></h1>
      <p class="subtitle">Portrait faceplate · 128×64 OLED · No Casio branding</p>
      <div class="chrome-tools">
        <span>Mode <span class="mode-tag" id="modeTag">PLAY</span></span>
        <button type="button" id="btnLang" title="Language">中/EN</button>
        <button type="button" id="btnSeed">Seed</button>
        <button type="button" id="btnSeq">SEQ</button>
        <button type="button" id="btnChop">CHOP</button>
        <button type="button" id="btnSys">SYS</button>
        <label class="file-btn">WAV<input type="file" id="fileLoad" accept="audio/*" hidden /></label>
        <label class="knob inline">BPM <input type="range" id="bpm" min="40" max="200" value="120" /><span id="bpmVal">120</span></label>
      </div>
    </header>

    <!-- Faceplate: pale gamepad plastic — docs/panel-layout.md / docs/refs -->
    <div class="device" aria-label="Pocket Chop faceplate">
      <div class="face-brand">Pocket Chop</div>

      <div class="face-top-bezel">
        <div class="dpad" aria-label="D-pad">
          <button type="button" class="u" data-dir="up" title="Up"></button>
          <button type="button" class="l" data-dir="left" title="Left"></button>
          <button type="button" class="ok" data-dir="enter" title="OK"></button>
          <button type="button" class="r" data-dir="right" title="Right"></button>
          <button type="button" class="d" data-dir="down" title="Down"></button>
        </div>

        <div class="oled-wrap">
          <canvas id="oled" width="128" height="64" aria-label="OLED display"></canvas>
        </div>

        <div class="top-right">
          <div class="bank-diamond">
            <button type="button" class="bank b-up" data-bank="0">A</button>
            <button type="button" class="bank b-left" data-bank="1">B</button>
            <button type="button" class="bank b-right" data-bank="2">C</button>
            <button type="button" class="bank b-down" data-bank="3">D</button>
          </div>
          <button type="button" id="fx1Btn" class="fx-hold fx-mini" title="FX1 hold">1</button>
          <button type="button" id="fx2Btn" class="fx-hold fx-mini" title="FX2 hold">2</button>
        </div>
      </div>

      <div class="face-fx">
        <div class="fx-unit">
          <div class="fx-knob-slot" id="fx1KnobSlot"></div>
          <span class="knob-cap">FX1</span>
          <input type="hidden" id="fx1p1" value="80" />
          <input type="hidden" id="fx1p2" value="20" />
        </div>
        <div class="face-vols">
          <label class="vol-slider"><span>INPUT VOL</span><input type="range" id="inVol" min="0" max="100" value="80" /></label>
          <label class="vol-slider"><span>MAIN VOL</span><input type="range" id="mainVol" min="0" max="100" value="90" /></label>
          <label class="edge-label discreet">IN
            <select id="inputSelect" title="Input select">
              <option value="mic">MIC</option>
              <option value="audio_in">AUDIO IN</option>
              <option value="usb" selected>USB</option>
            </select>
          </label>
        </div>
        <div class="fx-unit">
          <div class="fx-knob-slot" id="fx2KnobSlot"></div>
          <span class="knob-cap">FX2</span>
          <input type="hidden" id="fx2p1" value="35" />
          <input type="hidden" id="fx2p2" value="35" />
        </div>
      </div>

      <div class="face-transport" role="toolbar" aria-label="Transport">
        <button type="button" id="btnPlay" class="round-btn" title="Play">▶</button>
        <button type="button" id="btnStop" class="round-btn" title="Stop">■</button>
        <button type="button" id="btnRec" class="round-btn rec-btn">REC</button>
        <button type="button" id="btnOne" class="round-btn">ONE</button>
        <button type="button" id="btnLoop" class="round-btn">LOOP</button>
        <button type="button" id="btnDel" class="round-btn danger">DEL</button>
        <button type="button" id="btnEdit" class="round-btn">EDIT</button>
      </div>

      <div class="pads" id="pads" aria-label="16 pads"></div>
    </div>

    <div id="libraryRoot" class="companion"></div>
    <p class="hint">
      Faceplate mimics handheld layout (docs/panel-layout.md). Library below is companion UI.
      Pads / keys 1–4 qwer asdf zxcv · Space = seq · Esc = back · Hold FX1/FX2.
    </p>
  `

  const canvas = root.querySelector('#oled') as HTMLCanvasElement
  const oled = new OledRenderer(canvas, store)
  const padsEl = root.querySelector('#pads') as HTMLElement

  for (let i = 0; i < 16; i++) {
    const el = document.createElement('button')
    el.type = 'button'
    const row = Math.floor(i / 4) // 0 top .. 3 bottom → color rows like hardware (bottom=green)
    const colorRow = 3 - row // hardware glow: bottom green → top orange
    el.className = `pad pad-row-${colorRow}`
    el.dataset.pad = String(i)
    el.innerHTML = `<span class="num">${i + 1}</span><span class="name"></span>`
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault()
      await engine.ensure()
      store.patch({ selectedPad: i })
      const mode = store.state.mode
      if (mode === 'SEQ') {
        store.toggleStep(i, store.state.seqStep)
        return
      }
      if (mode === 'REC' && store.state.recArmed) {
        engine.stopRecToPad(i)
        return
      }
      if (mode === 'DEL' || mode === 'EDIT' || mode === 'AUTO_CHOP') {
        store.patch({ selectedPad: i })
        return
      }
      engine.playPad(i, store.state.pads[i], store.state)
      el.classList.add('hit')
      setTimeout(() => el.classList.remove('hit'), 80)
    })
    el.addEventListener('dragover', (e) => {
      e.preventDefault()
      el.classList.add('selected')
    })
    el.addEventListener('dragleave', () => el.classList.remove('selected'))
    el.addEventListener('drop', async (e) => {
      e.preventDefault()
      el.classList.remove('selected')
      const f = e.dataTransfer?.files?.[0]
      if (f) {
        await engine.loadFileToPad(i, f)
        store.patch({ selectedPad: i })
        await banks.flush()
      }
    })
    padsEl.appendChild(el)
  }

  function refreshPads() {
    const s = store.state
    padsEl.querySelectorAll('.pad').forEach((node) => {
      const el = node as HTMLElement
      const i = Number(el.dataset.pad)
      el.classList.toggle('selected', i === s.selectedPad)
      el.classList.toggle('has-sample', !!s.pads[i].buffer)
      const name = el.querySelector('.name')
      if (name) name.textContent = s.pads[i].name
    })
    root.querySelectorAll('.bank').forEach((node) => {
      const el = node as HTMLElement
      el.classList.toggle('active', Number(el.dataset.bank) === s.bankSlot)
    })
    const tag = root.querySelector('#modeTag')
    if (tag) tag.textContent = store.displayMode()
    const bpmVal = root.querySelector('#bpmVal')
    if (bpmVal) bpmVal.textContent = String(s.bpm)
    oled.render()
  }

  store.subscribe(refreshPads)
  refreshPads()

  const libRoot = root.querySelector('#libraryRoot') as HTMLElement
  mountLibraryPanel(libRoot, store, engine, banks)

  root.querySelectorAll('.bank').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slot = Number((btn as HTMLElement).dataset.bank) as 0 | 1 | 2 | 3
      if (store.state.bankSlot !== slot) {
        await banks.switchSlot(slot)
      }
      store.setMode('BANK')
    })
  })

  root.querySelector('#btnPlay')!.addEventListener('click', async () => {
    await engine.ensure()
    if (!store.state.pads.some((p) => p.buffer)) await engine.seedPlaceholders()
    engine.toggleSequencer()
    if (store.state.mode !== 'SEQ' && store.state.mode !== 'PLAY') store.setMode('SEQ')
  })
  root.querySelector('#btnStop')!.addEventListener('click', () => {
    engine.stopSequencer()
    engine.stopAll()
    if (store.state.mode === 'REC') store.patch({ recArmed: false, mode: 'PLAY' })
  })
  root.querySelector('#btnRec')!.addEventListener('click', async () => {
    await engine.startRecStub()
  })
  root.querySelector('#btnOne')!.addEventListener('click', () => {
    const pads = store.state.pads.slice()
    const i = store.state.selectedPad
    pads[i] = { ...pads[i], playMode: 'oneshot' }
    store.patch({ pads })
  })
  root.querySelector('#btnLoop')!.addEventListener('click', () => {
    const pads = store.state.pads.slice()
    const i = store.state.selectedPad
    pads[i] = { ...pads[i], playMode: 'loop' }
    store.patch({ pads })
  })
  root.querySelector('#btnDel')!.addEventListener('click', () => {
    store.patch({ delYes: true })
    store.setMode('DEL')
  })
  root.querySelector('#btnEdit')!.addEventListener('click', () => {
    if (store.state.mode === 'SEQ') {
      store.patch({ seqEditIndex: 0 })
      store.setMode('SEQ_EDIT')
    } else {
      store.patch({ editParam: 0 })
      store.setMode('EDIT')
    }
  })
  root.querySelector('#btnSeq')!.addEventListener('click', () => store.setMode('SEQ'))
  root.querySelector('#btnChop')!.addEventListener('click', () => store.setMode('AUTO_CHOP'))
  root.querySelector('#btnSys')!.addEventListener('click', () => {
    store.patch({ sysIndex: 0 })
    store.setMode('SYS')
  })
  root.querySelector('#btnLang')!.addEventListener('click', () => {
    store.patch({ lang: store.state.lang === 'zh' ? 'en' : 'zh' })
  })
  root.querySelector('#btnSeed')!.addEventListener('click', async () => {
    await engine.seedPlaceholders()
    await banks.flush()
  })

  root.querySelector('#fileLoad')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    if (f) {
      await engine.loadFileToPad(store.state.selectedPad, f)
      await banks.flush()
    }
    input.value = ''
  })

  const holdFx = (btn: HTMLButtonElement, which: 'fx1' | 'fx2') => {
    const down = async () => {
      await engine.ensure()
      store.patch(which === 'fx1' ? { fx1Held: true } : { fx2Held: true })
      btn.classList.add('active')
      engine.applyFxFromState(store.state)
    }
    const up = () => {
      store.patch(which === 'fx1' ? { fx1Held: false } : { fx2Held: false })
      btn.classList.remove('active')
    }
    btn.addEventListener('pointerdown', down)
    btn.addEventListener('pointerup', up)
    btn.addEventListener('pointerleave', up)
  }
  holdFx(root.querySelector('#fx1Btn') as HTMLButtonElement, 'fx1')
  holdFx(root.querySelector('#fx2Btn') as HTMLButtonElement, 'fx2')

  const mountFxKnob = (
    slotId: string,
    label: string,
    initial: number,
    onP1: (v: number) => void,
  ) => {
    const slot = root.querySelector('#' + slotId) as HTMLElement
    const knob = createRotaryKnob({
      value: initial,
      label,
      size: 92,
      onChange: (v) => {
        onP1(v)
        engine.applyFxFromState(store.state)
        oled.render()
      },
    })
    slot.appendChild(knob)
    return knob
  }
  mountFxKnob('fx1KnobSlot', 'FX1', store.state.fx1P1, (v) => store.patch({ fx1P1: v }))
  mountFxKnob('fx2KnobSlot', 'FX2', store.state.fx2P1, (v) => store.patch({ fx2P1: v }))
  // P2: when FX held, vertical wheel on document via arrows already; also Alt+wheel on knob
  root.querySelector('#fx1KnobSlot')!.addEventListener(
    'wheel',
    (ev) => {
      const e = ev as WheelEvent
      if (!e.altKey && !store.state.fx1Held) return
      e.preventDefault()
      const d = e.deltaY > 0 ? -0.02 : 0.02
      store.patch({ fx1P2: Math.max(0, Math.min(1, store.state.fx1P2 + d)) })
      engine.applyFxFromState(store.state)
      oled.render()
    },
    { passive: false, capture: true },
  )
  root.querySelector('#fx2KnobSlot')!.addEventListener(
    'wheel',
    (ev) => {
      const e = ev as WheelEvent
      if (!e.altKey && !store.state.fx2Held) return
      e.preventDefault()
      const d = e.deltaY > 0 ? -0.02 : 0.02
      store.patch({ fx2P2: Math.max(0, Math.min(1, store.state.fx2P2 + d)) })
      engine.applyFxFromState(store.state)
      oled.render()
    },
    { passive: false, capture: true },
  )
  root.querySelector('#bpm')!.addEventListener('input', (e) => {
    store.patch({ bpm: Number((e.target as HTMLInputElement).value) })
  })
  root.querySelector('#mainVol')!.addEventListener('input', async (e) => {
    await engine.ensure()
    engine.masterGain.gain.value = Number((e.target as HTMLInputElement).value) / 100
  })
  root.querySelector('#inputSelect')!.addEventListener('change', (e) => {
    store.patch({
      inputSource: (e.target as HTMLSelectElement).value as 'mic' | 'audio_in' | 'usb',
    })
  })

  async function navigate(dir: string) {
    await engine.ensure()
    const s = store.state
    const mode = store.displayMode()

    if (mode === 'FX1') {
      if (dir === 'left' || dir === 'right') store.cycleFx1Type(dir === 'right' ? 1 : -1)
      if (dir === 'up') store.patch({ fx1P1: Math.min(1, s.fx1P1 + 0.05) })
      if (dir === 'down') store.patch({ fx1P1: Math.max(0, s.fx1P1 - 0.05) })
      engine.applyFxFromState(store.state)
      return
    }
    if (mode === 'FX2') {
      if (dir === 'left' || dir === 'right') store.cycleFx2Type(dir === 'right' ? 1 : -1)
      if (dir === 'up') store.patch({ fx2P1: Math.min(1, s.fx2P1 + 0.05) })
      if (dir === 'down') store.patch({ fx2P1: Math.max(0, s.fx2P1 - 0.05) })
      engine.applyFxFromState(store.state)
      return
    }

    switch (s.mode) {
      case 'PLAY':
        if (dir === 'left') store.patch({ selectedPad: (s.selectedPad + 15) % 16 })
        if (dir === 'right') store.patch({ selectedPad: (s.selectedPad + 1) % 16 })
        if (dir === 'up') store.patch({ selectedPad: (s.selectedPad + 12) % 16 })
        if (dir === 'down') store.patch({ selectedPad: (s.selectedPad + 4) % 16 })
        break
      case 'BANK':
        if (dir === 'left') store.patch({ bankSlot: ((s.bankSlot + 3) % 4) as 0 | 1 | 2 | 3 })
        if (dir === 'right') store.patch({ bankSlot: ((s.bankSlot + 1) % 4) as 0 | 1 | 2 | 3 })
        if (dir === 'up' || dir === 'down') {
          const next =
            dir === 'up' ? Math.min(80, s.bankIndex + 1) : Math.max(1, s.bankIndex - 1)
          store.patch({ bankIndex: next })
          void getBankRecord(next).then((rec) => {
            if (rec && store.state.mode === 'BANK' && store.state.bankIndex === next) {
              store.patch({ bankName: rec.name })
            }
          })
        }
        break
      case 'SEQ':
        if (dir === 'left') store.patch({ seqStep: (s.seqStep + 15) % 16 })
        if (dir === 'right') store.patch({ seqStep: (s.seqStep + 1) % 16 })
        if (dir === 'up') store.patch({ selectedPad: (s.selectedPad + 15) % 16 })
        if (dir === 'down') store.patch({ selectedPad: (s.selectedPad + 1) % 16 })
        break
      case 'SEQ_EDIT': {
        if (dir === 'up') store.patch({ seqEditIndex: (s.seqEditIndex + 3) % 4 })
        if (dir === 'down') store.patch({ seqEditIndex: (s.seqEditIndex + 1) % 4 })
        if (dir === 'left' || dir === 'right') {
          const d = dir === 'right' ? 1 : -1
          const pat = s.patterns[s.patternIndex]
          if (s.seqEditIndex === 0) store.patch({ patternIndex: (s.patternIndex + d + 50) % 50 })
          if (s.seqEditIndex === 1) {
            pat.bars = Math.max(1, Math.min(8, pat.bars + d))
            store.patch({})
          }
          if (s.seqEditIndex === 3) store.patch({ swing: Math.max(0, Math.min(50, s.swing + d * 5)) })
        }
        break
      }
      case 'EDIT': {
        if (dir === 'up') store.patch({ editParam: (s.editParam + 5) % 6 })
        if (dir === 'down') store.patch({ editParam: (s.editParam + 1) % 6 })
        if (dir === 'left' || dir === 'right') {
          const d = dir === 'right' ? 1 : -1
          const pads = s.pads.slice()
          const p = { ...pads[s.selectedPad] }
          switch (s.editParam % 6) {
            case 0:
              p.start = Math.max(0, Math.min(p.end - 0.01, p.start + d * 0.01))
              break
            case 1:
              p.end = Math.max(p.start + 0.01, Math.min(1, p.end + d * 0.01))
              break
            case 2:
              p.pitchSemitones = Math.max(-12, Math.min(12, p.pitchSemitones + d))
              break
            case 3:
              p.speed = Math.max(0.25, Math.min(2, +(p.speed + d * 0.05).toFixed(2)))
              break
            case 4:
              p.volume = Math.max(0, Math.min(1, +(p.volume + d * 0.05).toFixed(2)))
              break
            case 5:
              p.playMode = p.playMode === 'loop' ? 'oneshot' : 'loop'
              break
          }
          pads[s.selectedPad] = p
          store.patch({ pads })
        }
        break
      }
      case 'DEL':
      case 'SYS_INIT':
        if (dir === 'left' || dir === 'right') store.patch({ delYes: !s.delYes })
        break
      case 'AUTO_CHOP':
        if (dir === 'left') store.patch({ autoChopSlices: Math.max(2, s.autoChopSlices - 1) })
        if (dir === 'right') store.patch({ autoChopSlices: Math.min(16, s.autoChopSlices + 1) })
        if (dir === 'up' || dir === 'down')
          store.patch({ autoChopThresh: (s.autoChopThresh + (dir === 'up' ? 1 : 2)) % 3 })
        break
      case 'SYS':
        if (dir === 'up') store.patch({ sysIndex: (s.sysIndex + 3) % 4 })
        if (dir === 'down') store.patch({ sysIndex: (s.sysIndex + 1) % 4 })
        break
      case 'SYS_BEAT':
        if (dir === 'up') store.patch({ bpm: Math.min(200, s.bpm + 1) })
        if (dir === 'down') store.patch({ bpm: Math.max(40, s.bpm - 1) })
        if (dir === 'left' || dir === 'right') store.setBeatSync(!s.beatSync)
        break
      case 'SYS_MIDI':
        if (dir === 'left' || dir === 'right') store.setMidiSync(!s.midiSync)
        if (dir === 'up') store.patch({ midiChannel: Math.min(16, s.midiChannel + 1) })
        if (dir === 'down') store.patch({ midiChannel: Math.max(1, s.midiChannel - 1) })
        break
      default:
        break
    }
  }

  function confirmAction() {
    const s = store.state
    switch (s.mode) {
      case 'BANK':
        void banks.selectBankForSlot(store.state.bankSlot, store.state.bankIndex).then(() => {
          store.setMode('PLAY')
        })
        break
      case 'DEL':
        if (s.delYes) store.clearPad(s.selectedPad)
        store.setMode('PLAY')
        break
      case 'AUTO_CHOP':
        void engine.ensure().then(() => {
          engine.applyAutoChop(s.selectedPad, s.autoChopSlices)
          store.setMode('PLAY')
        })
        break
      case 'SEQ':
        store.toggleStep(s.selectedPad, s.seqStep)
        break
      case 'SEQ_EDIT':
        store.setMode('SEQ')
        break
      case 'EDIT':
        store.setMode('PLAY')
        break
      case 'SYS':
        if (s.sysIndex === 0) store.setMode('SYS_BEAT')
        else if (s.sysIndex === 1) store.setMode('SYS_MIDI')
        else if (s.sysIndex === 2) {
          store.patch({ delYes: false })
          store.setMode('SYS_INIT')
        } else store.setMode('PLAY')
        break
      case 'SYS_BEAT':
        store.setBeatSync(!s.beatSync)
        break
      case 'SYS_MIDI':
        store.setMidiSync(!s.midiSync)
        break
      case 'SYS_INIT':
        if (s.delYes) {
          const fresh = createInitialState()
          store.patch({
            pads: fresh.pads,
            patterns: fresh.patterns,
            bpm: 120,
            mode: 'PLAY',
          })
        } else store.setMode('SYS')
        break
      case 'PLAY':
        void engine.ensure().then(() => engine.playPad(s.selectedPad, s.pads[s.selectedPad], s))
        break
      default:
        break
    }
  }

  root.querySelectorAll('.dpad button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = (btn as HTMLElement).dataset.dir!
      if (dir === 'enter') confirmAction()
      else void navigate(dir)
    })
  })

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    const keyMap: Record<string, string> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }
    if (keyMap[e.key]) {
      e.preventDefault()
      void navigate(keyMap[e.key])
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmAction()
      return
    }
    if (e.key === 'Escape') {
      store.goBack()
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      void engine.ensure().then(async () => {
        if (!store.state.pads.some((p) => p.buffer)) await engine.seedPlaceholders()
        engine.toggleSequencer()
      })
      return
    }
    const padKeys = '1234qwerasdfzxcv'
    const idx = padKeys.indexOf(e.key.toLowerCase())
    if (idx >= 0) {
      void engine.ensure().then(() => {
        store.patch({ selectedPad: idx })
        if (store.state.mode === 'SEQ') store.toggleStep(idx, store.state.seqStep)
        else engine.playPad(idx, store.state.pads[idx], store.state)
      })
    }
  })

  setInterval(() => {
    if (store.state.seqPlaying || store.state.recArmed || store.state.fx1Held || store.state.fx2Held) {
      oled.render()
    }
  }, 50)

  return { oled }
}
