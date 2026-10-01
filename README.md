# Pocket Chop (SXC Remake)

Inspired-compatible pocket sampler / chopper for **li gen**.  
**Not affiliated with Casio.** No Casio logos, trademarks, SK-1 samples, or `.csbk` assets.

- OLED metaphor: 128×64 mono (rendered at 2× in browser)
- 16 pads, A–D bank slots → library banks **01–80**
- Sequencer, FX stubs, Beat Sync stub, **IndexedDB bank library**
- Chinese + English short labels OK

## Docs

| File | Contents |
|------|----------|
| [`docs/ui-state-machine.md`](docs/ui-state-machine.md) | States, key map, transitions |
| [`docs/wireframes.md`](docs/wireframes.md) | ASCII OLED wireframes |
| [`docs/bank-format.md`](docs/bank-format.md) | `pocket-chop-bank.json` + zip schema |
| [`docs/hardware-plan.md`](docs/hardware-plan.md) | BOM paths, audio, firmware roadmap |

## Run

```bash
cd /workspace/sxc-remake
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## Bank library (import / export)

1. Open the **Bank Library** panel under the device chrome (lists virtual banks 01–80).
2. **A–D chips** show which library bank each slot points at; click to switch slot (autosaves current pads first).
3. Select a bank row → **Load → Slot** (or double-click) to put it on the active A–D slot.
4. **Rename / Duplicate → / Clear** operate on the selected library index.
5. **Export ZIP** downloads `NN-name.pchbank.zip` (`pocket-chop-bank.json` + `pads/NN.wav`).
6. **Export JSON** downloads metadata JSON (same schema; samples only if previously embedded).
7. **Import JSON/ZIP** merges into the **selected** library bank (then reload slot if it is active).
8. Session (slot pointers + current bank samples) persists in **IndexedDB** (`pocket-chop`) across reloads.
9. Drop WAV/FLAC (if browser decodes) on a pad or use **Load WAV**; changes autosave to the active bank.

Format details: [`docs/bank-format.md`](docs/bank-format.md).

## How to play

1. **Seed Tones** or drop WAV on pads.
2. Pads / keys `1 2 3 4 q w e r a s d f z x c v`.
3. **Play** / Space — 16-step sequencer.
4. **SEQ** / **EDIT** / **FX1–2** hold / **SYS** as before.
5. **A–D** then OLED BANK screen: ←→ slot, ↑↓ bank index, Enter loads into slot.

## Implemented vs stubbed

| Feature | Status |
|---------|--------|
| UI state machine + OLED | Done |
| Pads, trim, pitch, seq, FX stubs | Done |
| Bank library 01–80 + A–D pointers | Done |
| IndexedDB persist | Done |
| Export/import zip+json | Done |
| WAV import; FLAC if decodeAudioData allows | Done |
| MIDI / full Beat Sync stretch | Stub |
| Hardware firmware | Plan doc only |

## Stack

Vite 6 + TypeScript (vanilla) + Web Audio + JSZip + IndexedDB.

## License note

Original UI/code for this remake. Do not ship Casio assets.
