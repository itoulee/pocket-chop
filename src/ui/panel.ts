import type { Store } from '../state/machine'
import type { AudioEngine } from '../audio/engine'
import type { BankManager } from '../bank/manager'
import { OledRenderer } from './oled'
import { mountLibraryPanel } from './library'
import { createRotaryKnob } from './knob'

export function mountApp(root: HTMLElement, store: Store, engine: AudioEngine, banks: BankManager) {
  root.innerHTML = `
    <header class="app-chrome"><h1>Pocket Chop <span class="muted">SXC Remake</span></h1>
      <p class="subtitle">Portrait faceplate · 128×64 OLED · No Casio branding</p>
      <div class="chrome-tools"><span>Mode <span class="mode-tag" id="modeTag">PLAY</span></span>
        <button id="btnLang">中/EN</button><button id="btnSeed">Seed</button><button id="btnSeq">SEQ</button><button id="btnChop">CHOP</button><button id="btnSys">SYS</button>
        <label class="file-btn">WAV<input type="file" id="fileLoad" accept="audio/*" hidden /></label>
        <label class="knob inline">BPM <input type="range" id="bpm" min="40" max="200" value="120" /><span id="bpmVal">120</span></label></div></header>
    <div class="device"><div class="face-brand">Pocket Chop</div>
      <div class="face-top-bezel"><div class="dpad"><button data-dir="up"></button><button data-dir="left"></button><button data-dir="enter"></button><button data-dir="right"></button><button data-dir="down"></button></div>
        <div class="oled-wrap"><canvas id="oled" width="128" height="64"></canvas></div><div class="top-right"><div class="bank-diamond"><button class="bank" data-bank="0">A</button><button class="bank" data-bank="1">B</button><button class="bank" data-bank="2">C</button><button class="bank" data-bank="3">D</button></div><button id="fx1Btn">1</button><button id="fx2Btn">2</button></div></div>
      <div class="face-fx"><div class="fx-unit" id="fx1KnobSlot"><span class="knob-cap">FX1</span></div><div class="face-vols"><label class="vol-slider">INPUT VOL<input type="range" id="inVol" min="0" max="100" value="80" /></label><label class="vol-slider">MAIN VOL<input type="range" id="mainVol" min="0" max="100" value="90" /></label><select id="inputSelect"><option value="mic">MIC</option><option value="audio_in">AUDIO IN</option><option value="usb" selected>USB</option></select></div><div class="fx-unit" id="fx2KnobSlot"><span class="knob-cap">FX2</span></div></div>
      <div class="face-transport"><button id="btnPlay">▶</button><button id="btnStop">■</button><button id="btnRec">REC</button><button id="btnOne">ONE</button><button id="btnLoop">LOOP</button><button id="btnDel">DEL</button><button id="btnEdit">EDIT</button></div><div class="pads" id="pads"></div></div>
    <div id="libraryRoot" class="companion"></div><p class="hint">Pads / keys 1–4 qwer asdf zxcv · Space = seq · Esc = back · Hold FX1/FX2.</p>`
  const canvas = root.querySelector('#oled') as HTMLCanvasElement
  const oled = new OledRenderer(canvas, store)
  const padsEl = root.querySelector('#pads') as HTMLElement
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('button'); el.className = `pad pad-row-${3 - Math.floor(i / 4)}`; el.dataset.pad = String(i); el.innerHTML = `<span class="num">${i + 1}</span><span class="name"></span>`
    el.addEventListener('pointerdown', async (e) => { e.preventDefault(); await engine.ensure(); store.patch({ selectedPad: i }); if (store.state.mode === 'SEQ') store.toggleStep(i, store.state.seqStep); else if (store.state.mode === 'REC' && store.state.recArmed) engine.stopRecToPad(i); else if (!['DEL','EDIT','AUTO_CHOP'].includes(store.state.mode)) engine.playPad(i, store.state.pads[i], store.state) })
    el.addEventListener('dragover', (e) => e.preventDefault())
    el.addEventListener('drop', async (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) { await engine.loadFileToPad(i, f); store.patch({ selectedPad: i }); await banks.flush() } })
    padsEl.appendChild(el)
  }
  const refresh = () => { const s = store.state; padsEl.querySelectorAll('.pad').forEach((n) => { const el = n as HTMLElement; const i = Number(el.dataset.pad); el.classList.toggle('selected', i === s.selectedPad); el.classList.toggle('has-sample', !!s.pads[i].buffer); (el.querySelector('.name') as HTMLElement).textContent = s.pads[i].name }); (root.querySelector('#modeTag') as HTMLElement).textContent = store.displayMode(); (root.querySelector('#bpmVal') as HTMLElement).textContent = String(s.bpm); oled.render() }
  store.subscribe(refresh); refresh(); mountLibraryPanel(root.querySelector('#libraryRoot') as HTMLElement, store, engine, banks)
  root.querySelectorAll('.bank').forEach((b) => b.addEventListener('click', async () => { const slot = Number((b as HTMLElement).dataset.bank) as 0|1|2|3; await banks.switchSlot(slot); store.setMode('BANK') }))
  root.querySelector('#btnPlay')!.addEventListener('click', async () => { await engine.ensure(); if (!store.state.pads.some((p) => p.buffer)) await engine.seedPlaceholders(); engine.toggleSequencer() })
  root.querySelector('#btnStop')!.addEventListener('click', () => { engine.stopSequencer(); engine.stopAll(); store.patch({ mode: 'PLAY', recArmed: false }) })
  root.querySelector('#btnRec')!.addEventListener('click', () => void engine.startRecStub())
  root.querySelector('#btnOne')!.addEventListener('click', () => { const p = store.state.pads.slice(); p[store.state.selectedPad] = { ...p[store.state.selectedPad], playMode: 'oneshot' }; store.patch({ pads: p }) })
  root.querySelector('#btnLoop')!.addEventListener('click', () => { const p = store.state.pads.slice(); p[store.state.selectedPad] = { ...p[store.state.selectedPad], playMode: 'loop' }; store.patch({ pads: p }) })
  root.querySelector('#btnDel')!.addEventListener('click', () => store.setMode('DEL')); root.querySelector('#btnEdit')!.addEventListener('click', () => store.setMode('EDIT')); root.querySelector('#btnSeq')!.addEventListener('click', () => store.setMode('SEQ')); root.querySelector('#btnChop')!.addEventListener('click', () => store.setMode('AUTO_CHOP')); root.querySelector('#btnSys')!.addEventListener('click', () => store.setMode('SYS'))
  root.querySelector('#btnLang')!.addEventListener('click', () => store.patch({ lang: store.state.lang === 'zh' ? 'en' : 'zh' })); root.querySelector('#btnSeed')!.addEventListener('click', () => void engine.seedPlaceholders())
  root.querySelector('#bpm')!.addEventListener('input', (e) => store.patch({ bpm: Number((e.target as HTMLInputElement).value) })); root.querySelector('#mainVol')!.addEventListener('input', async (e) => { await engine.ensure(); engine.masterGain.gain.value = Number((e.target as HTMLInputElement).value) / 100 }); root.querySelector('#inputSelect')!.addEventListener('change', (e) => store.patch({ inputSource: (e.target as HTMLSelectElement).value as 'mic'|'audio_in'|'usb' }))
  const mountKnob = (id: string, value: number, update: (v: number) => void) => root.querySelector('#' + id)!.appendChild(createRotaryKnob({ value, size: 82, onChange: (v) => { update(v); engine.applyFxFromState(store.state) } }))
  mountKnob('fx1KnobSlot', store.state.fx1P1, (v) => store.patch({ fx1P1: v })); mountKnob('fx2KnobSlot', store.state.fx2P1, (v) => store.patch({ fx2P1: v }))
  root.querySelectorAll('.dpad button').forEach((b) => b.addEventListener('click', () => { const d = (b as HTMLElement).dataset.dir; if (d === 'enter') { if (store.state.mode === 'SEQ') store.toggleStep(store.state.selectedPad, store.state.seqStep); else store.goBack() } else if (d === 'left' || d === 'right') store.patch({ selectedPad: (store.state.selectedPad + (d === 'right' ? 1 : 15)) % 16 }) }))
}
