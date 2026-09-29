# scripts

| Script | Purpose |
|---|---|
| `copy-basis.mjs` | copies Draco / Basis decoders into `public/` (runs on `npm run dev|build`) |
| `make-icons.mjs` | renders `public/icons/icon.svg` → PNG icons (`npm run icons`) |
| `analyze-reference.py` | measurements from `/reference` quoted in `docs/MODELING_GUIDE.md` (needs `pillow numpy`) |
| `shot.mjs`, `suit.mjs`, `arms.mjs`, `poses.mjs`, `faces.mjs`, `montage.py` | visual-QA helpers: drive the running dev server through `window.__spider` (scrub the transformation, hold poses, capture screenshots). Set `CHROMIUM_PATH` if Chromium lives elsewhere. |
