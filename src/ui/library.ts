import type { Store } from '../state/machine'
import type { AudioEngine } from '../audio/engine'
import type { BankManager } from '../bank/manager'
import {
  clearBank,
  duplicateBank,
  listBankMetas,
  renameBank,
} from '../bank/idb'
import { exportBankFromIdb, importBankFile } from '../bank/io'
import { MAX_BANKS } from '../bank/format'

export function mountLibraryPanel(
  container: HTMLElement,
  store: Store,
  engine: AudioEngine,
  banks: BankManager,
) {
  container.innerHTML = `
    <div class="library">
      <div class="library-head">
        <h2>Bank Library <span class="muted">库 01–80</span></h2>
        <div class="row">
          <button type="button" id="libRefresh">Refresh</button>
          <label class="file-btn">Import JSON/ZIP
            <input type="file" id="libImport" accept=".json,.zip,application/json,application/zip" hidden />
          </label>
          <button type="button" id="libExportZip">Export ZIP</button>
          <button type="button" id="libExportJson">Export JSON</button>
        </div>
      </div>
      <p class="library-hint" id="libStatus">IndexedDB · A–D slots persist bank pointers</p>
      <div class="library-slots row" id="libSlots"></div>
      <div class="library-list" id="libList"></div>
      <div class="library-actions row">
        <button type="button" id="libLoad">Load → Slot</button>
        <button type="button" id="libRename">Rename</button>
        <button type="button" id="libDup">Duplicate →</button>
        <input type="number" id="libDupTo" min="1" max="80" value="2" title="Target bank #" style="width:4rem" />
        <button type="button" id="libClear" class="danger">Clear</button>
      </div>
    </div>
  `

  let selected = store.state.bankIndex
  const status = (msg: string) => {
    const el = container.querySelector('#libStatus')
    if (el) el.textContent = msg
  }

  const renderSlots = () => {
    const el = container.querySelector('#libSlots') as HTMLElement
    const s = store.state
    el.innerHTML = 'ABCD'
      .split('')
      .map((letter, i) => {
        const idx = s.slotBanks[i as 0 | 1 | 2 | 3]
        const active = s.bankSlot === i
        return `<button type="button" class="slot-chip ${active ? 'active' : ''}" data-slot="${i}">
          ${letter}→${String(idx).padStart(2, '0')}
        </button>`
      })
      .join('')
    el.querySelectorAll('.slot-chip').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const slot = Number((btn as HTMLElement).dataset.slot) as 0 | 1 | 2 | 3
        await banks.flush()
        await banks.switchSlot(slot)
        selected = store.state.bankIndex
        store.setMode('PLAY')
        await refresh()
        status(`Slot ${'ABCD'[slot]} → Bank ${String(selected).padStart(2, '0')}`)
      })
    })
  }

  const refresh = async () => {
    renderSlots()
    const metas = await listBankMetas()
    const list = container.querySelector('#libList') as HTMLElement
    list.innerHTML = metas
      .map((m) => {
        const sel = m.bankIndex === selected ? 'selected' : ''
        const cur = m.bankIndex === store.state.bankIndex ? 'current' : ''
        return `<button type="button" class="lib-item ${sel} ${cur}" data-idx="${m.bankIndex}">
          <span class="lib-num">${String(m.bankIndex).padStart(2, '0')}</span>
          <span class="lib-name">${escapeHtml(m.name)}</span>
          <span class="lib-pads">${m.padCount}/16</span>
        </button>`
      })
      .join('')
    list.querySelectorAll('.lib-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        selected = Number((btn as HTMLElement).dataset.idx)
        list.querySelectorAll('.lib-item').forEach((b) => b.classList.remove('selected'))
        btn.classList.add('selected')
      })
      btn.addEventListener('dblclick', async () => {
        selected = Number((btn as HTMLElement).dataset.idx)
        await banks.selectBankForSlot(store.state.bankSlot, selected)
        await refresh()
        status(`Loaded bank ${String(selected).padStart(2, '0')} into slot ${'ABCD'[store.state.bankSlot]}`)
      })
    })
  }

  container.querySelector('#libRefresh')!.addEventListener('click', () => void refresh())

  container.querySelector('#libLoad')!.addEventListener('click', async () => {
    await banks.selectBankForSlot(store.state.bankSlot, selected)
    await refresh()
    status(`Loaded ${String(selected).padStart(2, '0')} → ${'ABCD'[store.state.bankSlot]}`)
  })

  container.querySelector('#libRename')!.addEventListener('click', async () => {
    const name = window.prompt('Bank name / 库名', store.state.bankName || `Bank ${selected}`)
    if (!name) return
    await renameBank(selected, name)
    if (selected === store.state.bankIndex) store.patch({ bankName: name.slice(0, 24) })
    await banks.flush()
    await refresh()
    status(`Renamed ${String(selected).padStart(2, '0')}`)
  })

  container.querySelector('#libDup')!.addEventListener('click', async () => {
    const to = Number((container.querySelector('#libDupTo') as HTMLInputElement).value)
    if (to < 1 || to > MAX_BANKS) return
    if (selected === store.state.bankIndex) await banks.flush()
    await duplicateBank(selected, to)
    await refresh()
    status(`Duplicated ${selected} → ${to}`)
  })

  container.querySelector('#libClear')!.addEventListener('click', async () => {
    if (!window.confirm(`Clear bank ${String(selected).padStart(2, '0')}?`)) return
    await clearBank(selected)
    if (selected === store.state.bankIndex) {
      await banks.loadActiveBank()
    }
    await refresh()
    status(`Cleared ${String(selected).padStart(2, '0')}`)
  })

  container.querySelector('#libExportZip')!.addEventListener('click', async () => {
    if (selected === store.state.bankIndex) await banks.flush()
    const ctx = await engine.ensure()
    await exportBankFromIdb(selected, ctx, store.state.bpm, true)
    status(`Exported ZIP bank ${selected}`)
  })

  container.querySelector('#libExportJson')!.addEventListener('click', async () => {
    if (selected === store.state.bankIndex) await banks.flush()
    const ctx = await engine.ensure()
    await exportBankFromIdb(selected, ctx, store.state.bpm, false)
    status(`Exported JSON bank ${selected}`)
  })

  container.querySelector('#libImport')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const ctx = await engine.ensure()
      const result = await importBankFile(file, selected, ctx)
      if (selected === store.state.bankIndex) {
        store.patch({ pads: result.pads, bankName: result.name, bpm: result.bpm })
        if (result.pattern0) {
          const patterns = store.state.patterns.slice()
          patterns[store.state.patternIndex] = result.pattern0
          store.patch({ patterns })
        }
      }
      await refresh()
      status(`Imported → bank ${String(selected).padStart(2, '0')}: ${result.name}`)
    } catch (err) {
      status(`Import failed: ${(err as Error).message}`)
    }
    input.value = ''
  })

  store.subscribe(() => {
    renderSlots()
  })

  void refresh()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
