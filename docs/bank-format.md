# Pocket Chop Bank Format

Own format for **Pocket Chop** (SXC Remake).  
**Not** Casio `.csbk`. No Casio trademarks or proprietary assets.

## Files

| Artifact | Role |
|----------|------|
| `pocket-chop-bank.json` | Metadata + pad params + optional pattern snapshot |
| `pads/NN.wav` | 16-bit PCM WAV per pad (optional if pad empty) |
| `*.pchbank.zip` | Zip of JSON + `pads/` (preferred exchange unit) |

JSON alone may embed samples as base64 (`audioBase64`) for small banks; zip+WAV is preferred for size.

## Schema (`pocket-chop-bank.json`)

```json
{
  "format": "pocket-chop-bank",
  "version": 1,
  "bankIndex": 1,
  "name": "Init Bank",
  "bpm": 120,
  "createdAt": "2026-10-01T00:00:00.000Z",
  "updatedAt": "2026-10-01T00:00:00.000Z",
  "pads": [
    {
      "index": 0,
      "name": "Kick_01",
      "file": "pads/01.wav",
      "start": 0.0,
      "end": 1.0,
      "pitchSemitones": 0,
      "speed": 1.0,
      "volume": 0.8,
      "playMode": "oneshot",
      "sampleRate": 48000,
      "channels": 1,
      "audioBase64": null
    }
  ],
  "patterns": [
    {
      "index": 0,
      "bars": 1,
      "steps": [[true, false, "...16 bools"], "...16 tracks"]
    }
  ],
  "notes": "Optional free text"
}
```

### Field rules

| Field | Constraint |
|-------|------------|
| `format` | Must be `"pocket-chop-bank"` |
| `version` | Integer; this doc = `1` |
| `bankIndex` | 1–80 (library slot; may differ from filename) |
| `name` | ≤ 24 chars recommended |
| `pads[].index` | 0–15 |
| `pads[].file` | Relative path inside zip; omit/`null` if empty |
| `pads[].playMode` | `"oneshot"` \| `"loop"` |
| `pads[].start`/`end` | 0…1, `start < end` |
| `audioBase64` | Raw little-endian PCM float32 **or** omit when `file` present; prototype uses WAV files in zip |
| `patterns` | Optional; up to 50; prototype may store pattern 0 only on export |

## WAV requirements

- Container: RIFF WAVE
- Encoding: PCM 16-bit (preferred) or float32
- Sample rate: any (prototype resamples via Web Audio on load; hardware target 48 kHz)
- Channels: 1 or 2
- FLAC: import allowed if `AudioContext.decodeAudioData` succeeds in the browser; export always WAV

## Library + slots (runtime, IndexedDB)

Virtual library: banks **01–80**.  
A/B/C/D hardware slots each store a pointer `bankIndex` (1–80).

IndexedDB database name: `pocket-chop` (v1)

| Object store | Key | Value |
|--------------|-----|-------|
| `meta` | `'session'` | `{ slotBanks: [a,b,c,d], activeSlot, lang, bpm, … }` |
| `banks` | `bankIndex` (1–80) | `{ name, updatedAt, padMeta[], pattern0? }` |
| `samples` | `"${bankIndex}:${padIndex}"` | `{ sampleRate, channels, length, channelData: Float32Array[] }` |

## Import / export UX (web)

- **Export JSON** — metadata only (or with base64 if tiny)
- **Export ZIP** — `pocket-chop-bank.json` + `pads/01.wav`…
- **Import JSON / ZIP** — merges into selected library bank index
- **Duplicate / Clear / Rename** — library panel operations

## Versioning

Bump `version` on breaking changes. Readers must reject unknown `format` strings.
