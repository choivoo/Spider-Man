# Architecture

```
Browser (React + R3F)                                   Serverless (Vercel / Cloudflare)
─────────────────────────────────────────────────       ───────────────────────────────
Chat / Mic ─► ai/conversation.ts ── POST /api/chat ───► api/chat.ts ─► server/chatCore.ts ─► Claude API
     ▲            │  memory.relevant()                        │            (personality/*.md,
     │            │  vars, summary                            │             structured output)
     │            ▼                                           └─ no key? offlineBrain (demo)
     │      CharacterResponse (JSON schema)                    api/memory.ts ─► Supabase (optional)
     │            │                                            api/tts.ts    ─► OpenAI-compatible TTS (optional)
     │            ▼                                            api/log.ts    ─► platform logs
  UI ◄──── character/director.ts ─┬─► FaceController  (emotion → blendshapes, blink, visemes)
 (HUD,                            ├─► AnimationController (springs, gestures, stance, breathing)
 Subtitles,                       ├─► LookAtController (head + eyes, glances, pointer)
 Settings)                        ├─► LipSyncPlayer (text → visemes, re-synced by TTS boundaries)
                                  └─► actions.ts → NanotechController (state machine + timeline)
                                                         │
                                          ┌──────────────┼───────────────┐
                                          ▼              ▼               ▼
                                  suit reveal shader  NanoParticles   SpiderArms (IK)
                                  (per-region uniforms) (1 draw call)   + cinematic camera + SFX
```

## Modules
| Path | Responsibility |
|---|---|
| `src/ai/` | Contract (`schema.ts`), Claude client, conversation pipeline, hidden variables (`emotions.ts`), action gating (`actions.ts`), offline demo brain |
| `server/`, `api/` | Serverless handlers. `chatCore.ts` builds the cached system prompt from `/personality`, calls Claude with **structured outputs** (`messages.parse` + Zod) |
| `src/memory/` | Memory manager (importance, decay, dedupe, retrieval, summaries) with pluggable stores (device / session / cloud) |
| `src/character/` | Rig spec, loft geometry, civilian & suit builders, face, eyes, director, GLB adapter |
| `src/animation/` | Procedural animation (no clips): gestures = keyframed pose deltas; critically-damped springs per bone channel |
| `src/transformation/` | `NanotechController` (pure state machine, unit-tested), reveal-order baking, shader patching, particles, cinematic hooks |
| `src/spiderArms/` | 4-arm rig, two-bone IK, five pose modes |
| `src/audio/` | Synthesised SFX (WebAudio), voice manager (TTS adapters + STT) |
| `src/quality/` | Device scoring, presets, FPS governor |
| `src/ui/` | Chat, HUD, controls, mobile wheel, settings, loading screen, error boundary |

## The nano transformation
* Every civilian mesh and every suit mesh gets `onBeforeCompile` injection (`transformation/nanoMaterial.ts`) with **one shared uniform block per suit region**.
* Each vertex carries a *reveal order* (`aNano`, `aNano2`) baked from its rest-pose world position (`nanoOrder.ts`) — e.g. radial distance from the chest core for the chest, distance along the limb for arms/legs, jaw→forehead / sides→centre for the mask.
* Fragment: `d = reveal·(1+edge) − order(+noise)`; suit is visible where `d > 0`, civilian where `d ≤ 0` (exactly complementary). A band of width `edge` gets a molten-gold (suit side) / cyan (civilian side) emissive burn with hex-cell sparks. No glow at `reveal = 0` or `1`, so the steady states cost nothing.
* `NanotechController` turns the spec timeline (§6) into per-region progress; reverse order follows §9 (mask → neck → arms → chest → legs) and recalls particles to the chest.
* Particles: one `THREE.Points`, positions computed in the vertex shader from 19 bone-segment capsules + per-region progress → no CPU per-particle work. Counts by tier: 800 / 2 000 / 5 000 / 10 000.

## Concurrency rules (spec §56)
`dispatch()` never throws and returns `accepted | queued | ignored`. Suit toggles during a transition are ignored; mask/arms commands arriving mid-transition are queued (max 2, deduped) and run when the state machine is idle. `SUIT_DOWN` with arms deployed retracts them first.

## Security
* API keys exist only in server env vars; the browser talks to `/api/*` only.
* Request validation (Zod), size limits, per-IP rate limits, no upstream error details leaked.
* Memory never stores strings that look like secrets; cloud memory is keyed by a random per-device id; nothing sensitive is written to `localStorage` (only preferences, non-sensitive memory).
* `Permissions-Policy` allows only the microphone.

## Performance
Shared master profiles + LOD geometry swaps (3 levels, distance + tier), one draw call for particles, bloom only on HIGH/ULTRA, FPS governor steps the tier down in AUTO mode, shaders precompiled during loading.
