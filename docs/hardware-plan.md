# Pocket Chop — Hardware Remake Plan

Product: **Pocket Chop** (SXC Remake) for li gen.  
Inspired-compatible pocket sampler; **no Casio branding/assets**.  
UI contract: [`ui-state-machine.md`](ui-state-machine.md) · bank files: [`bank-format.md`](bank-format.md).

---

## 1. Goals & non-goals

**Goals:** 128×64 OLED UX parity with web prototype; 16 pads; A–D bank slots; REC/ONE/LOOP/DEL/EDIT; FX1/FX2; 16-step seq; 48 kHz 16-bit stereo I/O path; MIDI notes/CC + clock; SD/USB bank storage using Pocket Chop bank format.

**Non-goals (v1 hardware):** Matching commercial flagship converters; full Casio feature clone; shipping licensed third-party DSP binaries without review.

---

## 2. Recommended BOM paths

### Path A — ESP32-P4 + codec + custom front panel (primary target)

| Block | Suggestion | Notes |
|-------|------------|-------|
| MCU | ESP32-P4 (dual RISC-V, MIPI/better media) or ESP32-S3 if P4 supply tight | P4 for headroom; S3 OK for early UI+light audio |
| Codec | ES8388 / ES8311 / WM8960 breakout → later custom | 48 kHz stereo DAC+ADC, mic bias |
| Display | 1.3" 128×64 SSD1306/SH1106 I²C OLED | Matches metaphor |
| Pads | 16× silicone + membrane or MPR121/TTP226 | Velocity optional (spec: no velocity) |
| Knobs | 2× encoders or ADC pots (FX1/FX2) | Detent encoders nicer for menus |
| Transport | Tactile switches | ▶ ■ REC ONE LOOP DEL EDIT + FX buttons |
| Storage | microSD (SPI/SDMMC) + USB-C MSC later | Banks as zip/json+wav |
| MIDI | TRS-A or DIN via opto + SoftUART; USB-MIDI device | Clock IN/OUT |
| Power | USB-C 5 V primary; optional 3×AAA / 18650 boost | Soft power latch |
| Case | Custom PCB + 3D printed shell | D-pad + dual USB-C vibe |

**Why A:** One SoC can run UI + soft synth/sampler with I2S DMA; ecosystem docs strong; enough GPIO with expanders (MCP23017) for 16 pads + transport.

### Path B — RP2040 / RP2350 + external codec

| Block | Suggestion |
|-------|------------|
| MCU | RP2350 (preferred) or RP2040 |
| Audio | I2S codec (same as A) + PIO for tight timing |
| UI | Same OLED + pads; second MCU or PIO for scan |
| Storage | SD via SPI |

**Why B:** Deterministic PIO for pad scan / MIDI clock edges; simpler than Linux SBCs. CPU lighter than P4 — budget voices carefully (see §4). Good for open hardware.

### Path C — Desktop-first + MIDI controller later

Keep **web app / native desktop (Tauri/CPAL)** as the audio brain; build a dumb pad/OLED controller over USB-MIDI / WebHID.

**Why C:** Fastest path to usable sound; validate UX; defer battery/codec risk. Hardware becomes a control surface first, sampler second.

**Recommendation:** Ship UX on **C** (already started) → early **UI-only host on M5Stack Tab5** → audio prototype on **A or B** → custom PCB.

---

## 3. Audio path

```
MIC (bias) ─┐
LINE IN ──────┼─► Codec ADC ──► MCU I2S RX ──► Record / USB stream
USB AUDIO ───┘                              │
                                           ▼
Pads / Seq / FX graph (≤16 stereo voices) ─► I2S TX ─► Codec DAC ─► PHONE / LINE OUT
```

- Target: **48 kHz**, 16-bit (internal 32-bit accumulators)
- Mic bias: codec MICBIAS ~2–3 V through 2k2; AC couple
- Input select: analog switch or codec input mux (MIC / AUDIO IN / USB)
- Headphone amp: codec HP out or MAX9722-class
- Grounding: star audio ground; keep OLED SPI/I²C away from mic traces

---

## 4. Soft realtime budget (16 voices + FX)

Assume 48 kHz, callback 128–256 frames (~2.7–5.3 ms).

| Load | Rough cost (Cortex-class / RISC-V @ 200–400 MHz) |
|------|--------------------------------------------------|
| 16× mono interpolate + gain | Moderate — OK if not all looping long grains |
| Biquad filter (FX1) | Cheap (per master or per voice — prefer master) |
| Bitcrush | Cheap |
| Delay (FX2) ~0.5–1 s stereo | RAM: 48k×2×2 bytes ≈ 192 KB — OK on P4/PSRAM; tight on RP2040 SRAM |
| Beat Sync time-stretch | **Expensive** — v1 = playback-rate align only (as web stub); true stretch = phase vocoder later / offload |
| OLED + UI | Idle CPU; never in audio callback |

**Rules:** No malloc in audio thread; pre-allocated voice pool; SD decode off-thread into RAM pads; FX primarily **master insert** to save CPU.

---

## 5. Storage & banks

- Filesystem: FAT on SD; folder ` /PCBANK/NNN/ ` or single `.pchbank.zip`
- Format: [`bank-format.md`](bank-format.md)
- 80 banks × 16 pads × ~15 min conceptual max is **marketing ceiling** — practical v1: ~minutes per bank limited by SD and RAM cache (stream from SD for oneshots > N seconds)
- USB-C: device MSC or MTP for drag-drop banks; dual-USB vibe = power + data/host roles via hub or two ports

---

## 6. MIDI strategy

| Port | Use |
|------|-----|
| USB-MIDI | Primary for DAW; notes 1–16 → pads; CC → FX knobs; clock |
| DIN or TRS MIDI | Clock IN/OUT, notes; opto-isolated IN |
| Sync mutex | Beat Sync XOR MIDI Clock Sync (same as UI SM) |

No velocity in product spec — ignore or map to fixed 100.

---

## 7. Firmware roadmap (maps to UI state machine)

Phased modules (C/C++ with ESP-IDF **or** Rust `embassy` / `rp-hal`):

| Phase | Modules | UI states unlocked |
|-------|---------|-------------------|
| P0 | `hal_display`, `hal_input`, `ui_sm` | PLAY navigation chrome (no audio) |
| P1 | `audio_engine`, `voice`, `wav_decode` | PLAY pads, EDIT trim/pitch/vol |
| P2 | `bank_fs`, `slot_abcd` | BANK, library load/save |
| P3 | `seq` | SEQ, SEQ_EDIT |
| P4 | `fx_master` | FX1/FX2 |
| P5 | `rec`, `autochop` | REC, AUTO_CHOP, DEL |
| P6 | `midi`, `sync` | SYS_MIDI, SYS_BEAT |
| P7 | `sys_init`, power, USB MSC | SYS_INIT, field updates |

Keep **one shared state-machine table** ported from `docs/ui-state-machine.md` so web and firmware do not diverge.

Suggested layout:

```
firmware/
  ui/state_machine.c
  ui/screens_*.c
  audio/engine.c voices.c fx.c
  bank/format.c sd_bank.c
  midi/clock.c
  hal/...
```

---

## 8. M5Stack ecosystem feasibility

| Platform | Fit | Verdict |
|----------|-----|---------|
| **Tab5** | Large UI, ESP32-P4 class, good for **UI-only / soft mock** of OLED+menus, Wi-Fi bank sync experiments | **Early host for UI**, not final audio quality target (speaker/codec path not sampler-grade; pad count needs external I/O) |
| **Cardputer ADV** | Keyboard + small screen; useful for naming banks / file manager | Companion, not pad instrument |
| **StampS3 / Atom + custom** | Cheap audio DIY | Proto only |
| **Custom PCB** | Final form: 16 pads, OLED, knobs, codec, SD, MIDI | Production goal |

Tab5 can run a LVGL (or similar) port of the state machine and stream MIDI to the desktop web app (Path C hybrid) before custom audio hardware exists.

---

## 9. Open risks

| Risk | Mitigation |
|------|------------|
| Codec / I2S latency | Measure round-trip; keep buffer small; align seq scheduler to DAC DMA |
| Beat Sync CPU | Ship rate-align v1; defer high-quality stretch; optional accelerator |
| Delay RAM on RP2040 | Cap delay time; mono delay; prefer P4+PSRAM for Path A |
| SD stutter while playing | Prefetch pad into PSRAM; never read SD in audio IRQ |
| DSP licensing | Use original/filter textbooks; avoid shipping proprietary IR/library blobs; document any third-party SPDX |
| Mechanical pad feel | Prototype with FSR/silicone early |
| USB-C role complexity | Start USB device-only; add host later |
| Legal / branding | Keep Pocket Chop naming; never use Casio marks or dump `.csbk` |

---

## 10. Suggested near-term build order

1. Continue web bank library (this repo) as golden UI + format reference  
2. Tab5 or desktop LVGL/web — UI SM only + MIDI out  
3. ESP32-S3/P4 + WM8960/ES8388 breadboard — 4 pads → 16 pads  
4. Custom PCB rev A — validate power + OLED + SD  
5. Enclosure + MIDI + FX polish  

---

*Document version 1 · 2026-10-01 · for hardware handoff*
