# Pocket Chop — UI State Machine

Product: **Pocket Chop** (SXC Remake)  
Display: 128×64 mono OLED metaphor · D-pad · A/B/C/D · FX1/FX2 · transport · 16 pads  
Audience: hardware firmware handoff + web prototype mirror

---

## 1. State inventory

| ID | Name (EN) | Name (ZH) | Kind | OLED primary content |
|----|-----------|-----------|------|----------------------|
| `PLAY` | Play | 演奏 | Home | Pad status, bank, BPM, play/rec LEDs |
| `BANK` | Bank Select | 库选择 | Modal | Bank A–D highlight + bank index 01–80 |
| `SEQ` | Sequence | 音序 | Mode | 16-step × track grid |
| `SEQ_EDIT` | Sequence Settings | 音序设定 | Sub | Pattern/bars/quantize/length |
| `REC` | Record | 录音 | Mode | Level meter, length, input source |
| `AUTO_CHOP` | Auto Chop | 自动切分 | Mode | Slice count / threshold / preview |
| `DEL` | Delete Confirm | 删除确认 | Modal | Target pad/bank confirm |
| `EDIT` | Sample Edit | 采样编辑 | Mode | Pitch / speed / vol / start–end |
| `FX1` | FX1 Overlay | 效果1 | Overlay | Filter / flanger / phaser / bitcrush / pan |
| `FX2` | FX2 Overlay | 效果2 | Overlay | Roll / delay types |
| `SYS` | System | 系统 | Menu | Beat Sync / MIDI / Initialize… |
| `SYS_BEAT` | Beat Sync | 节拍同步 | Page | Master BPM, stretch on/off |
| `SYS_MIDI` | MIDI | MIDI | Page | Clock IN/OUT, channel |
| `SYS_INIT` | Initialize | 初始化 | Page | Confirm wipe |

Global overlay flags (orthogonal): `fx1Held`, `fx2Held`, `seqPlaying`, `recording`.

---

## 2. Key map (hardware metaphor)

| Control | Short press | Long press | Notes |
|---------|-------------|------------|-------|
| D-pad ↑↓←→ | Navigate / tweak | Accelerate tweak | Context-dependent |
| ENTER (center / A-btn metaphor) | Confirm / toggle step | — | Web: Enter / click OLED soft-key |
| BACK (B-btn metaphor) | Escape / cancel | — | Web: Esc |
| A / B / C / D | Select bank slot | Jump bank page | Always available |
| ▶ Play | Toggle sequence play | — | |
| ■ Stop | Stop seq / exit REC | — | |
| REC | Enter `REC` | — | From PLAY/SEQ |
| ONE SHOT | Toggle pad play mode oneshot | — | Selected pad |
| LOOP | Toggle pad play mode loop | — | Selected pad |
| DEL | Enter `DEL` confirm | — | Needs selected pad |
| EDIT | Enter `EDIT` | Enter `SYS` | Long-press → System |
| FX1 btn | Hold → `FX1` overlay | — | Knobs active while held |
| FX2 btn | Hold → `FX2` overlay | — | Knobs active while held |
| Pads 1–16 | Trigger / select / toggle step | Load sample (web) | Mode-dependent |
| INPUT SELECT | Cycle MIC / AUDIO IN / USB | — | Shown on REC |
| FX1/FX2 knobs | Param 1 / Param 2 | — | Per FX page |

Mutex: **Beat Sync** and **MIDI Sync** cannot both be ON (system enforces).

---

## 3. Transitions

```
                    ┌──────────────┐
         boot ─────►│     PLAY     │◄─────────────────────────────┐
                    └──────┬───────┘                              │
           ┌───────────────┼────────────────┬──────────┐          │
           │               │                │          │          │
           ▼               ▼                ▼          ▼          │
      ┌────────┐     ┌────────┐       ┌────────┐  ┌────────┐     │
      │  BANK  │     │  SEQ   │──────►│SEQ_EDIT│  │  REC   │     │
      └───┬────┘     └───┬────┘ BACK  └───┬────┘  └───┬────┘     │
          │ BACK         │ EDIT           │ BACK      │ ■/BACK   │
          └──────────────┼────────────────┘           │          │
                         │                            │          │
           ┌─────────────┼──────────────┐             │          │
           ▼             ▼              ▼             │          │
      ┌────────┐   ┌──────────┐   ┌────────┐          │          │
      │  DEL   │   │AUTO_CHOP │   │  EDIT  │◄─────────┘          │
      └───┬────┘   └────┬─────┘   └───┬────┘                     │
          │ Y/N         │ BACK        │ long EDIT → SYS          │
          └─────────────┴─────────────┼──────────────────────────┘
                                      ▼
                                 ┌────────┐
                                 │  SYS   │──► SYS_BEAT / SYS_MIDI / SYS_INIT
                                 └───┬────┘
                                     │ BACK
                                     └──────────────────────────► PLAY

FX1 / FX2: hold button from almost any mode → overlay on top; release → pop.
```

### Transition table (primary)

| From | Event | To | Guard / side effect |
|------|-------|----|---------------------|
| * | Boot | PLAY | Init audio graph |
| PLAY | A/B/C/D | BANK | Preselect slot; confirm stays on bank |
| PLAY | ▶ | PLAY | Toggle `seqPlaying` |
| PLAY | REC | REC | Arm input |
| PLAY | DEL | DEL | Require selected pad with sample |
| PLAY | EDIT short | EDIT | Selected pad |
| PLAY | EDIT long | SYS | — |
| PLAY | pad | PLAY | Trigger voice / select |
| PLAY | ONE SHOT / LOOP | PLAY | Set pad mode |
| BANK | D-pad / A–D | BANK | Change slot or bank# |
| BANK | ENTER / BACK | PLAY | Commit / cancel |
| PLAY / SEQ | SEQ key / mode | SEQ | Show grid for current pattern |
| SEQ | pad | SEQ | Toggle step on selected track |
| SEQ | D-pad | SEQ | Move cursor track/step |
| SEQ | EDIT | SEQ_EDIT | — |
| SEQ | ▶ / ■ | SEQ | Play/stop |
| SEQ | BACK | PLAY | — |
| SEQ_EDIT | D-pad / ENTER | SEQ_EDIT | Edit params |
| SEQ_EDIT | BACK | SEQ | Save |
| REC | ■ / BACK | PLAY | Keep or discard per prompt |
| REC | pad after stop | PLAY | Assign take to pad (web: auto) |
| PLAY | AUTO CHOP (from EDIT or menu) | AUTO_CHOP | Needs sample |
| AUTO_CHOP | ENTER | PLAY | Apply slices → pads |
| AUTO_CHOP | BACK | PLAY | Abort |
| DEL | ENTER (Yes) | PLAY | Clear pad |
| DEL | BACK (No) | PLAY | — |
| EDIT | D-pad | EDIT | Param focus |
| EDIT | knobs / ←→ | EDIT | Trim / pitch / rate / vol |
| EDIT | BACK | PLAY | Commit |
| EDIT | AUTO CHOP entry | AUTO_CHOP | — |
| * | FX1 hold | FX1 | Overlay; release → previous |
| * | FX2 hold | FX2 | Overlay; release → previous |
| SYS | ↑↓ ENTER | SYS_* | Enter page |
| SYS_* | BACK | SYS | — |
| SYS | BACK | PLAY | — |
| SYS_BEAT | toggle ON | SYS_BEAT | Force MIDI Sync OFF |
| SYS_MIDI | Clock Sync ON | SYS_MIDI | Force Beat Sync OFF |

---

## 4. Screen inventory (OLED 128×64)

| Screen | Rows (conceptual 8×21 chars @ 6px font) | Cursor / focus |
|--------|------------------------------------------|----------------|
| PLAY | Bank · BPM · mode icons · pad row dots · selected pad name | Selected pad |
| BANK | `BANK xx` + A B C D boxes | Slot + bank index |
| SEQ | Track# · 16 step cells · bar · pattern# | Track × step |
| SEQ_EDIT | Pattern / Bars 1–8 / Quantize / Swing | List index |
| REC | Input · peak meter · time · WAIT/REC | — |
| AUTO_CHOP | Slices N · Threshold · Preview pad | Param |
| DEL | `DELETE PAD xx?` YES/NO | Yes/No |
| EDIT | Wave stub · START END · PITCH SPEED VOL | Param |
| FX1 | Type + P1 P2 values | Type / knobs |
| FX2 | Type + P1 P2 values | Type / knobs |
| SYS | Menu list 3–5 items | Index |
| SYS_BEAT | BPM · Stretch · Align loops | Param |
| SYS_MIDI | Ch · Clock IN/OUT · Sync | Param |
| SYS_INIT | `INIT ALL?` YES/NO | Yes/No |

---

## 5. Mode × pad behavior

| Mode | Pad press |
|------|-----------|
| PLAY | Note-on voice (oneshot or loop toggle) |
| BANK | Ignored (or preview last) |
| SEQ | Toggle step at cursor track OR select track if shift |
| REC | After stop: assign recording to pad |
| EDIT | Select which pad to edit |
| DEL | Change delete target |
| AUTO_CHOP | Preview slice / select destination range |
| FX* | Still triggers play underneath |

---

## 6. Web prototype mapping

| Hardware | Web UI |
|----------|--------|
| OLED | `#oled` 256×128 CSS pixel canvas (2× scale of 128×64) |
| Pads | 4×4 buttons + drag-drop / file input |
| A–D | Bank buttons |
| Transport | ▶ ■ REC ONE LOOP DEL EDIT |
| FX | Hold buttons + `<input type="range">` knobs |
| D-pad | Arrow keys + on-screen |
| Long EDIT | `Sys` button |

---

## 7. Future (out of scope this dispatch)

- File / bank management (80 banks × 16, `.pch` project format)
- Real MIC / AUDIO IN capture beyond getUserMedia stub
- Full MIDI I/O
- Multi-bar patterns > 1 in UI polish
- Hardware firmware port of this SM
