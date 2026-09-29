# Asset pipeline

```
assets/                 source files (Blender .blend, PSD, wav) — not shipped
public/models/          shipped GLB (character.glb …)            → auto-detected
public/textures/        KTX2/Basis textures
public/animations/      clips (optional; the app animates procedurally)
public/audio/           recorded audio (optional; SFX are synthesised)
src/shaders/            GLSL (nano.vert/frag particles, suitReveal.* + noise.glsl for materials)
```
* Everything currently shipped is **procedural** — the app runs with zero binary assets.
* GLB: see `docs/MODELING_GUIDE.md` §6. Compression: Meshopt/Draco + KTX2 (`npm run dev|build` runs `scripts/copy-basis.mjs` to serve the decoders).
* Texture budget: desktop 2K–4K, mobile 1K–2K. The procedural suit textures are generated at `texScale` 0.5 / 1 / 2 by quality tier.
* Icons: edit `public/icons/icon.svg`, run `npm run icons`.
