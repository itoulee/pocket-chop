import './styles/main.css'
import { Store } from './state/machine'
import { AudioEngine } from './audio/engine'
import { BankManager } from './bank/manager'
import { mountApp } from './ui/panel'

const store = new Store()
const engine = new AudioEngine(store)
const banks = new BankManager(store, engine)

const root = document.querySelector('#app')
if (!root) throw new Error('#app missing')

async function boot() {
  try {
    await banks.init()
  } catch (e) {
    console.warn('[Pocket Chop] IndexedDB init failed, continuing ephemeral', e)
  }
  mountApp(root as HTMLElement, store, engine, banks)
  console.info('[Pocket Chop] ready — bank library + Seed Tones / drop WAV')
}

void boot()

const unlock = async () => {
  await engine.ensure()
  window.removeEventListener('pointerdown', unlock)
}
window.addEventListener('pointerdown', unlock)
