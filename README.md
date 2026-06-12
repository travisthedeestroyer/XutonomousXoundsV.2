# Xounds Studio

An autonomous vocal studio in the browser. Upload a beat, prepare it, record vocals over it, and let an AI agent network engineer the mix — then optionally master against a reference track.

Ground-up rewrite of *XutonomousXoundsV2* with a modular architecture.

## Features

- **Upload** — drop in any beat (mp3/wav/etc.); BPM auto-detection
- **Prepare** — tempo & pitch shifting, stem separation (UVR MDX-Net sidecar), lyrics pad with recording teleprompter
- **Record** — mic capture over the beat with monitor, echo-cancellation and metronome options; main + backup takes
- **Mix** — full DSP chain rendered offline with the Web Audio API: 5-band vocal EQ, de-esser, single/multiband/parallel compression, saturation, reverb, echo, doubler, beat EQ + compression, sidechain ducking, stereo imaging, master multiband + EQ, soft clip, LUFS-targeted gain
- **AI Agent Network** — multi-agent mix engineering:
  - *With a Gemini API key*: multimodal agents listen to your actual audio, match against your skill tree, propose settings, and iterate against an objective mix score
  - *Without a key*: a fully deterministic Smart Mix pipeline (spectral analysis → genre targets → score-driven DSP corrections) — the app never blocks on a key
- **Skill Tree** — every rated session crystallizes into a reusable "skill" (settings + spectral fingerprint + reasoning) that warm-starts similar future sessions. The longer you use it, the better it knows your sound.
- **Master** — Matchering 2.0 reference mastering via Python sidecar; A/B raw vs. processed playback

## Architecture

```
xounds-studio/
├── server.ts                  # Express: serves the app, proxies sidecar jobs (/api/separate, /api/master)
├── services/
│   ├── separator/             # FastAPI + audio-separator (stem separation), port 8000
│   └── mastering/             # FastAPI + matchering (reference mastering), port 8001
└── src/
    ├── audio/                 # Pure DSP engine (no React, no AI)
    │   ├── wav.ts             #   decode blobs / encode PCM16 WAV
    │   ├── settings.ts        #   MixSettings types, defaults, genre presets
    │   ├── analysis.ts        #   spectral / LUFS / sibilance / stereo / dynamics analysis
    │   ├── render.ts          #   processBeat + offline mixAudio render graph
    │   └── score.ts           #   objective mix scoring + deterministic corrections
    ├── ai/                    # Intelligence layer
    │   ├── agents.ts          #   Gemini agent network + deterministic Smart Mix fallback
    │   └── memory.ts          #   self-evolving skill tree (localStorage)
    ├── state/store.ts         # Zustand store (sliced)
    └── components/            # React UI (steps, panels, modals, ui primitives)
```

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional:

- `GEMINI_API_KEY` in `.env.local` (or enter a key in Settings) → enables the multimodal agent network
- Python sidecars for stems & mastering:

```bash
cd services/separator && pip install -r requirements.txt && python main.py   # :8000
cd services/mastering && pip install -r requirements.txt && python main.py  # :8001
```

`AUDIO_SEPARATOR_URL` / `AUDIO_MATCHER_URL` env vars point the server at deployed sidecars in production.

## Build

```bash
npm run build        # vite build + compile server
npm run lint         # strict typecheck
```
