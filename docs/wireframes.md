# Pocket Chop — OLED Wireframes (128×64)

Legend: `#` = pixel block · `.` = empty · `[ ]` = focus · `*` = active step/LED  
Font metaphor: ~21 columns × 8 rows (6×8 font). Frames shown as ASCII boxes.

Larger web mock mirrors the same layout at 2× (256×128) inside the panel chrome.

---

## 1. PLAY — 演奏

```
+----------------------+
| A01 120BPM  >  OSHOT |  bank slot+index · BPM · play · pad mode
| PAD 05  Kick_01      |  selected pad # + name (truncated)
| ##....##....##....## |  activity / level stub (16 cells)
| 1 2 3 4 5 6 7 8 9..  |  pad occupancy dots (filled=has sample)
| [#####] ...... ......|  selected pad highlight bar
| FX1:FILT  FX2:DLY    |  current FX types
| IN:USB   VOICES 03/16|
| HOLD EDIT=SYS        |  hint row (dim)
+----------------------+
```

Keys: pads trigger · A–D bank · ▶ seq · REC · EDIT · DEL · FX hold

---

## 2. BANK — 库选择

```
+----------------------+
| BANK SELECT          |
|                      |
|   [A]  B   C   D     |  slot focus on A
|                      |
|   BANK  01 / 80      |  ←→ change index
|   NAME: Init Bank    |
|                      |
| ENTER=OK  BACK=ESC   |
+----------------------+
```

Variant when slot C selected:

```
+----------------------+
| BANK SELECT          |
|                      |
|    A   B  [C]  D     |
|                      |
|   BANK  12 / 80      |
|   NAME: Breaks_A     |
|                      |
| ENTER=OK  BACK=ESC   |
+----------------------+
```

---

## 3. SEQ — 音序网格

```
+----------------------+
| SEQ P01 BAR1/1 T03   |  pattern · bar · track
| 123456789ABCDEF0     |  step headers (1–16 as hex-ish)
| ..*...*.*.....*..    |  track steps (* = on, . = off)
| CUR:T03 S08          |  cursor track/step
| BPM120 SWING0 Q:1/16 |
|                      |
| PAD=TOGGLE  EDIT=SET |
| > PLAYING  STEP 08   |  when running, playhead
+----------------------+
```

Compact 4-track peek (optional alternate):

```
+----------------------+
| SEQ P01  >  120BPM   |
|T01 *...*...*...*...  |
|T02 ..*...*...*...*.. |
|T03[*.*.*.*.*.*.*.*.] |
|T04 ................  |
| BAR 1/1  TRK 03      |
| ◄► step  ▲▼ track    |
| EDIT=settings        |
+----------------------+
```

---

## 4. SEQ_EDIT — 音序设定

```
+----------------------+
| SEQ SETTINGS         |
|                      |
| > PATTERN     01     |
|   BARS         1     |  1–8
|   QUANTIZE   1/16    |
|   SWING        0%    |
|   CLEAR TRK?         |
| BACK=SAVE            |
+----------------------+
```

---

## 5. REC — 录音

```
+----------------------+
| REC  IN:MIC          |
|                      |
| LEVEL |######----|   |  peak meter
| TIME  00:00:00       |
| MAX   ~15:00 / pad   |
|                      |
| STATUS: WAITING      |  or RECORDING
| ■=STOP  pad=ASSIGN   |
+----------------------+
```

Recording:

```
+----------------------+
| REC  IN:USB  *REC*   |
| LEVEL |########--|   |
| TIME  00:00:12       |
|                      |
|                      |
|                      |
| ■ STOP THEN HIT PAD  |
| TO STORE TAKE        |
+----------------------+
```

---

## 6. AUTO_CHOP — 自动切分

```
+----------------------+
| AUTO CHOP            |
| SRC PAD 05           |
|                      |
| > SLICES      16     |  2–16
|   THRESHOLD  MED     |
|   DEST     01-16     |
|                      |
| ENTER=APPLY BACK=ESC |
+----------------------+
```

---

## 7. DEL — 删除确认

```
+----------------------+
| DELETE               |
|                      |
|   PAD 05  Kick_01    |
|                      |
|   [YES]      NO      |
|                      |
| ENTER=CONFIRM        |
| BACK=CANCEL          |
+----------------------+
```

---

## 8. EDIT — 采样编辑 (trim / pitch / speed / vol)

```
+----------------------+
| EDIT PAD 05          |
| WAVE: ##..####..##   |  crude waveform stub
| S[####------------]E |  start–end window
| > START    0.000s    |
|   END      0.842s    |
|   PITCH      +0 st   |
|   SPEED     100%     |
| VOL 80%  LOOP  ON    |
+----------------------+
```

Page 2 (scroll):

```
+----------------------+
| EDIT PAD 05  (2/2)   |
| > MODE    ONE SHOT   |  or LOOP
|   NAME    Kick_01    |
|   AUTO CHOP...       |
|                      |
|                      |
|                      |
| BACK=COMMIT          |
+----------------------+
```

---

## 9. FX1 overlay — 效果1

```
+----------------------+
| FX1 *HOLD*           |
|                      |
| > TYPE   FILTER      |  FILTER/FLANGER/PHASER/
|                      |  BITCRUSH/M.PAN
|   CUTOFF    80       |  knob1
|   RES/P2    20       |  knob2
|                      |
| RELEASE=EXIT         |
+----------------------+
```

Bitcrush variant:

```
+----------------------+
| FX1 *HOLD*           |
| > TYPE   BITCRUSH    |
|   BITS       8       |
|   RATE      12k      |
|                      |
|                      |
| RELEASE=EXIT         |
+----------------------+
```

---

## 10. FX2 overlay — 效果2

```
+----------------------+
| FX2 *HOLD*           |
|                      |
| > TYPE   DELAY       |  ROLL 1/2 1/4 1/8 · DELAY
|   TIME     1/8       |
|   FEEDBACK  35%      |
|                      |
|                      |
| RELEASE=EXIT         |
+----------------------+
```

Roll variant:

```
+----------------------+
| FX2 *HOLD*           |
| > TYPE   ROLL 1/16   |
|   DEPTH     100%     |
|   GATE       ON      |
|                      |
|                      |
| RELEASE=EXIT         |
+----------------------+
```

---

## 11. SYS — 系统菜单

```
+----------------------+
| SYSTEM               |
|                      |
| > BEAT SYNC...       |
|   MIDI...            |
|   INITIALIZE...      |
|   ABOUT              |
|                      |
| ENTER=OPEN BACK=ESC  |
+----------------------+
```

---

## 12. SYS_BEAT — 节拍同步

```
+----------------------+
| BEAT SYNC            |
|                      |
| > ENABLE      ON     |  mutex w/ MIDI sync
|   MASTER BPM 120     |
|   STRETCH     ON     |  align loop pads to BPM
|   NOTE        *MIDI  |
|               SYNC   |
|               OFF*   |
+----------------------+
```

---

## 13. SYS_MIDI — MIDI

```
+----------------------+
| MIDI                 |
|                      |
| > CHANNEL     01     |
|   CLOCK IN    ON     |
|   CLOCK OUT   OFF    |
|   SYNC        OFF    |  mutex w/ Beat Sync
|   NOTES/CC    ON     |
|   (no velocity)      |
+----------------------+
```

---

## 14. SYS_INIT — 初始化

```
+----------------------+
| INITIALIZE           |
|                      |
|  WIPE ALL BANKS?     |
|  PATTERNS & SETTINGS |
|                      |
|   YES      [NO]      |
|                      |
| ENTER=OK BACK=ESC    |
+----------------------+
```

---

## 15. Web panel chrome (large mock)

```
+==========================================================+
|  Pocket Chop                              [Sys] [Lang]   |
| +---------------------------+  IN:USB  VOL====           |
| |        OLED 256x128       |  FX1 [====] FX2 [====]     |
| |   (mirrors screens above) |  (hold FX1/FX2 btns)       |
| +---------------------------+                            |
|  [A] [B] [C] [D]     [▶] [■] [REC] [ONE] [LOOP] [DEL] [EDIT] |
|                                                          |
|   [ 1] [ 2] [ 3] [ 4]                                    |
|   [ 5] [ 6] [ 7] [ 8]     D-pad: ↑↓←→  Enter  Esc        |
|   [ 9] [10] [11] [12]                                    |
|   [13] [14] [15] [16]     Drop WAV on pad to load        |
+==========================================================+
```
