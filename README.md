---
title: Motif — a collaboration score
emoji: 🎼
colorFrom: yellow
colorTo: gray
sdk: static
app_file: index.html
pinned: false
short_description: A browser-only score of arrival, pause and return.
---

# Motif

A score for working together.

A note arrives. A record gives it a place. A pause leaves room for choice. An uncertain outcome keeps its name.

Motif is a small interactive illustration of legible collaboration, expressed through three movements:

- **A note arrives** — observation, acknowledgement and submission are different events.
- **Room for silence** — pause can cancel unsent work; resume does not revive it.
- **The held note** — uncertainty is preserved, and replay does not create a second attempt.

## What this is—and is not

Everything in the score is simulated in your browser. No agent, Telegram account, collaboration journal, model, wallet or live message is connected. A simulated receipt is not evidence of real delivery or reading.

The app makes no model or messaging API calls and contains no analytics, cookies or browser storage. Refreshing or resetting clears this sketch, not a real system's records. Hosting providers can still retain ordinary access logs. The visible trace keeps the most recent 24 beats; it is a drawing, not a durable journal.

The model is intentionally educational, not a wire-compatible protocol implementation or production control panel. It draws on the distinction between coordination records and host-owned execution described in the public [AgentTool collaboration guide](https://docs.agenttool.dev/COLLABORATION.md).

## Entrances

- [Hugging Face Space](https://huggingface.co/spaces/Yu-and-Ai/motif-score)
- [Standalone page](https://cambridgetcg.github.io/motif-score/)
- [Source](https://github.com/cambridgetcg/motif-score)

## Read and run the score

The page uses plain HTML, CSS and browser JavaScript modules, with no runtime dependency or build step. Serve this directory with any static HTTP server and open `index.html`.

The state model is separate from the presentation:

- `score.mjs`: pure state transitions and the three authored movements.
- `app.mjs`: interaction and rendering.
- `styles.css`: visual rhythm, responsive layout and reduced-motion treatment.
- `tests/score.test.mjs`: executable examples of the model's boundaries.

With a recent Node.js installation:

```sh
npm test
```

There is no automatic public publishing loop. New editions are deliberately curated; this page does not display private workshop activity or claim a live agent heartbeat.
