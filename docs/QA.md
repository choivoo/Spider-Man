# QA report — v1.0

Everything below was actually executed in this repository (Node 22, Chromium 141 headless with SwiftShader **software** WebGL, so timings are not representative of real GPUs).
Anything not listed as executed is **not verified** and is called out explicitly.

## Automated suites
| Suite | Command | Result |
|---|---|---|
| Type-check | `npm run typecheck` | clean |
| Unit / integration (Vitest) | `npm test` | **52 tests, 7 files, all pass** — AI schema tolerance, offline brain, personality variables, action gating, memory (dedupe, decay, retrieval, summaries, secret filtering), lip-sync, gestures, face, emotion voice, LOD, device scoring, spider-arm IK, **NanotechController** (order, locks, queue, reverse, 100-cycle + 400-command fuzz), Claude request shape against a stub Messages API |
| E2E (Playwright) | `npm run test:e2e` | **14 tests pass** — boot/loading, chat, Shift+S / M / A / Shift+S flow with mesh census, hotkeys ignored while typing, AI-initiated suit-up, settings dialog + focus trap, API outage, persistence, 6 viewport sizes |
| Transformation QA | `QA_CYCLES=100 npx playwright test tests/e2e/qa.spec.ts` | **100 consecutive Suit Up / Suit Down cycles: pass** |
| Performance QA | same file | **pass** |

### Transformation QA (spec §50) — 100 cycles
Checked after **every** transition: exactly zero civilian meshes visible in Spider form and zero suit meshes visible in Civilian form (no duplicate mesh / missing body),
shader state resets (progress returns to exactly 0 or 1), no animation deadlock (every cycle completes), and at the end:

| | before | after |
|---|---|---|
| GPU geometries | 189 | 189 |
| GPU textures | 49 | 49 |
| Compiled shader programs | 37 | 37 (no recompiles → shader reset OK) |
| Scene objects | 275 | 275 (no duplicated meshes/particles) |
| JS heap | 100.3 MB | 102.9 MB (GC noise) |

Skeleton: all bone transforms finite; feet still grounded (foot-plant correction) after the run.
z-fighting was reviewed visually at the overlap seams (waist/chest, bracers, boots) in screenshots at 4 transformation times — none observed; there is no automated pixel test for it.

### Combined-load QA (spec §51) — 30 s
Spider arms deployed and cycling through all five modes + particles/spider-sense + gestures + continuous chat, 13 rounds:
GPU geometries 245 → 245, textures 49 → 49, JS heap 109.0 MB → 104.6 MB (no growth).
*Caveat:* this proves there is no resource leak in the app; it does **not** prove 30 FPS on a low-end phone (software GL here).

## Browser / device matrix (spec §49)
| Target | Status |
|---|---|
| Chrome desktop (Chromium 141) | ✅ automated |
| Edge | ⚠️ not run (Chromium engine → expected to match Chrome) |
| Android Chrome | ⚠️ viewport/touch emulation only (360×800, 412×915); no real device |
| Samsung Internet | ❌ not tested |
| iOS Safari / iPad Safari | ❌ not tested. Known risks to check first: `SpeechRecognition` is `webkit`-prefixed and limited, autoplay rules (handled via first-gesture unlock), `100dvh`, no `navigator.vibrate`, WebGL2 float-buffer bloom on older devices (fall back with Settings → Bloom off) |
| Firefox | ⚠️ not run; voice input is unavailable there (no `SpeechRecognition`) and the mic button is hidden |

Resolutions verified by automated layout assertions (no horizontal scroll, canvas fills stage, correct control set — wheel on ≤ 820 px, control bar otherwise, chat input reachable):
360×800 · 412×915 · 768×1024 · 1080×1920 · 1920×1080 · 2560×1440 ✅

## Bugs found by QA and fixed
1. **Eyelid / teeth meshes re-appeared while the mask was on** (their per-frame `visible` toggle overrode the reveal system on blink/speech). Found by the 100-cycle QA at cycle 91. Fixed by using scale instead of `visible`.
2. **Sensitive text persisted in the conversation log** (memory items were filtered but raw turns were not). Found by the persistence e2e. Turns that look like secrets are now withheld from storage.
3. Suit hatch/pauldron on the right side used the left-side offset; hands-in-pocket fingertips poked through the trousers; eyes lenses were back-face-culled on one side; eyelids covered the eyes at rest; hair-cap "helmet" edge — all found by visual review and fixed.
4. Dev-server reloads during long QA runs looked like app crashes — the QA now documents "don't edit sources while it runs".

## Not verified (honest list)
* **Live Claude calls** — no API key was available here. The request/response contract is verified against a local stub of the Messages API (`tests/chatCore.test.ts`), including cached system prompt, structured-output format, no forced `tool_choice`.
* Live Supabase memory, live OpenAI-compatible TTS.
* Real-GPU frame rates (desktop 60 FPS / mobile 30 FPS targets). The FPS governor and quality tiers exist and are unit-tested, but were not measured on hardware.
* KTX2/Basis texture path (loader + transcoders wired, no `.ktx2` assets to test).
* Third-party skinned GLB assets (adapter smoke-tested with a GLB exported from the procedural rig).
* Screen-reader passes (ARIA labels and focus handling are implemented and tested for the settings dialog only).
