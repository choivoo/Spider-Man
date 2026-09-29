# /models — drop-in character assets

Place production assets here (they are picked up automatically, no code change):

| File | What |
|---|---|
| `character.glb` | Humanoid (civilian body + clothes + hair + face), Mixamo / VRM / Rigify bone names. ~1.78 m, feet on y = 0, facing +Z. |

See `docs/MODELING_GUIDE.md` for proportions, bone names, mesh naming (`Skin_*`, `Blazer_*`, `Pants_*`, `Shoe_*`, `Hair_*` …),
morph-target names and the reference images this project is built against.
Compress with `gltf-transform optimize --texture-compress ktx2 --compress meshopt` (Draco, Meshopt and KTX2/Basis are supported).
