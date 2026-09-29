# Modeling & Replacement Guide

This guide is derived from the three reference images in [`/reference`](../reference) and from the procedural character that ships with the app.
The procedural character is the **specification**: any GLB you drop in must match its proportions, bone names and region layout, so that
the civilian body, the Spider suit and every animation share **one skeleton and one silhouette** (spec: "skeleton alignment must match exactly").

> Run `python3 scripts/analyze-reference.py` to reproduce the measurements below.

## 1. What the references say

### `civilian-fullbody.png` (1024 × 1536)
| Measurement | Value | Used as |
|---|---|---|
| Subject height (hair top → sole) | 1316 px | 1.78 m |
| Width at shoulders / height | 0.258 (arms hanging, jacket) | bideltoid ≈ 0.44–0.46 m |
| Width at chest, waist, hips / height | 0.293, 0.290, 0.270 (hands in pockets widen the waist row) | torso half-width 0.14–0.18 m |
| Width at knee / ankle / height | 0.193 / 0.192 | slim, straight trousers |
| Head incl. hair / height | ≈ 1 : 6.7 in the photo (wide-angle, hair volume) | build to **7.6 heads** (0.235 m chin→crown) per spec (7.5–8) |

Design notes: short curly hair swept up and back (volume on top, tight sides, ears visible); notch-lapel open blazer; black crew tee; slim black trousers; black glossy derby shoes; relaxed hands-in-pockets stance; slight asymmetric smile.
The character is a **stylised original**, not a likeness of the person photographed.

### `spider-suit-turnaround.png` (2049 × 1058, 4 views)
Front / ¾ / back / side. Layout to reproduce (see `src/character/suitTextures.ts`):
* **Red**: mask, neck, gloves, arms (outer), central chest/abdomen vest, boots. Web pattern in slightly darker red, raised (bump).
* **Black**: legs, torso sides, inner-arm stripe, deltoid caps, knee pads. Micro-textured fabric with fine panel seams.
* **Gold**: pin-stripe outlines, chest-emblem outline, belt, boot cuff, ankle/knee rims, wrist bracers.
* **Chest**: black spider with gold outline (long legs sweeping to the shoulders). **Back**: red spider with gold outline on black.

### `nanotech-iron-spider.png` (1280 × 2156)
* Materials: metallic red (semi-metallic polymer), dark navy-black, brushed gold, **cyan/white glow** strips (shoulders, waist sides, wrist, spider-arm inserts).
* **Four mechanical spider arms**, gold with black inserts and a curved blade claw. The arm span is 1174 px against a height of 2126 px, i.e. each arm reaches ≈ 0.28 × height sideways from the torso axis → in our units ≈ 0.5 m at 1.78 m.

### Measured palette
| Region | Sampled median (lit render) | Spec value used |
|---|---|---|
| Red | rgb(179, 33, 30) | `#C81D25` |
| Black | rgb(14, 11, 11) | `#080A0F` (lifted to `#0D1016` in the texture so it reads under bloom) |
| Gold | rgb(194, 156, 107) | `#B99545` |
| Glow | rgb(160, 218, 245) | soft cyan/white `#7FDCFF` → HDR `(0.55, 1.6, 2.2)` |

## 2. Coordinate system & skeleton

* Metres, **+Y up, character faces +Z**, feet on `y = 0`, total height **1.78 m**.
* "L" = the character's **left** = **+X**.
* 19 bones (`src/character/rigSpec.ts` — the single source of truth):

| Bone | Parent | Rest offset from parent (m) | World Y at rest |
|---|---|---|---|
| hips | root | 0, 0.96, 0 | 0.960 |
| spine | hips | 0, 0.09, 0 | 1.050 |
| chest | spine | 0, 0.17, 0 | 1.220 |
| neck | chest | 0, 0.235, 0 | 1.455 |
| head | neck | 0, 0.145, −0.012 | 1.600 |
| clavicle L/R | chest | ±0.05, 0.20, 0 | 1.420 |
| upperArm L/R | clavicle | ±0.135, −0.005, 0 | 1.415 |
| foreArm L/R | upperArm | 0, −0.285, 0 | 1.130 |
| hand L/R | foreArm | 0, −0.255, 0 | 0.875 |
| thigh L/R | hips | ±0.095, −0.04, 0 | 0.920 |
| shin L/R | thigh | 0, −0.44, 0 | 0.480 |
| foot L/R | shin | 0, −0.405, 0 | 0.075 |

Rest pose = slight A-pose (upper arms 0.1 rad abducted, forearms 0.06 rad flexed).
Bone names are matched case-insensitively with aliases for **Mixamo**, **VRM humanoid** and **Rigify** (`BONE_ALIASES`). Missing optional bones (chest, clavicles, neck) are synthesised.

## 3. Body regions ("SuitParts")

The Spider suit and the civilian clothes are both split into the same 19 regions; a civilian mesh dissolves exactly where its suit region forms.
`partFromName()` (src/character/Civilian.ts) maps mesh names → regions:

| Region | Civilian mesh name contains | Suit mesh |
|---|---|---|
| Head | `Skin_Head`, `Hair_*`, `Face*`, anything else | `Suit_Mask` (+ lenses) |
| Neck | `Neck`, `Collar` | `Suit_Neck` |
| Chest | `Skin_Chest`, `Tee_Chest`, `Blazer_Chest`, `Lapel_*` | `Suit_Chest` |
| Back | – | `Suit_BackPlate`, arm sockets |
| Shoulder_L/R | – | `Suit_Pauldron_*` |
| Arm_L/R | `UpperArm`, `Sleeve_Upper` | `Suit_UpperArm_*` |
| Forearm_L/R | `ForeArm`, `Sleeve_Fore` | `Suit_ForeArm_*`, `Suit_Bracer_*` |
| Hand_L/R | `Hand` | `Suit_Hand_*` |
| Waist | `Pelvis`, `Abdomen`, `Tee_Waist`, `Pants_Hips`, `Blazer_Skirt`, `Blazer_Waist` | `Suit_Pelvis`, `Suit_Abdomen`, `Suit_Buckle` |
| Thigh_L/R | `Thigh` | `Suit_Thigh_*` |
| Shin_L/R | `Shin` | `Suit_Shin_*`, `Suit_KneePlate_*` |
| Foot_L/R | `Shoe`, `Sole`, `Lace` | `Suit_Foot_*` |

## 4. Silhouette profiles (why alignment is guaranteed)
`src/character/profiles.ts` holds the master cross-section profiles (torso, arm, leg, neck, head, shoe).
Skin, clothes and suit are all `sliceProfile()` of the *same* master with a different inflation (skin 0, tee +4 mm, pants +10 mm, blazer +20 mm, suit +6 mm), and every mesh
is a child of the same bone. Replacing the procedural meshes with a GLB therefore only requires respecting these profiles' proportions.

Key dimensions (rx = half-width, rz = half-depth, metres): chest 0.168/0.110 at y 1.30; waist 0.140/0.090 at y 1.12; hips 0.160/0.104 at y 0.98;
thigh 0.092/0.098; knee 0.050/0.054; ankle 0.030/0.033; neck 0.052/0.054; head 0.078/0.098 (chin y −0.055, crown y +0.18 around the head pivot).

## 5. Materials (suit)
| Region colour | Base | Metalness | Roughness | Notes |
|---|---|---|---|---|
| Red | `#C81D25` | 0.42 | 0.30 | clearcoat 0.35; raised web lines (bump) |
| Black | `#0D1016` | 0.05 | 0.62 | diagonal micro-weave in bump/roughness |
| Gold | `#B99545` | 0.93 | 0.36 | brushed noise in roughness |
| Glow | emissive cyan | – | – | drives bloom (threshold ≈ 0.92) |

Texture layout: `u` wraps around the part (`0.25` front, `0.5` character's left, `0.75` back, seam at `0/1`), `v` up (0 = bottom of the slice). Right-side parts mirror U (`u' = 0.5 − u`).
Channels: `map` (sRGB), `orm` (G = roughness, B = metalness), `emissive`, `bump`.

## 6. Drop-in GLB checklist
1. Export `public/models/character.glb` (civilian body/clothes/hair/face), Y-up, metres, feet at 0, facing +Z, A-pose. Bone names as above.
2. Name meshes per §3 (`Skin_*`, `Blazer_*`, `Pants_*`, `Shoe_*`, `Hair_*`, …). Unknown names dissolve with the **Head**.
3. Face: morph targets named like the spec (`Blink_L/R`, `Smile_L/R`, `MouthOpen`, `BrowUp/Down`, `Surprise`, `Angry`, `Sad`, `Squint`) **or** ARKit/VRM names
   (`eyeBlinkLeft`, `mouthSmileLeft`, `jawOpen`, `viseme_aa`, …). Eye bones `LeftEye`/`RightEye` receive gaze.
4. Optimise: `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2` (Draco/Meshopt/KTX2 decoders are served from `/draco` and `/basis`; `npm run dev|build` copies them).
5. `npm run dev`, open the app: the adapter logs `glb.bones.missing` if required bones (`hips, head, upperArm*, thigh*`) are missing.
6. Verify alignment: press **Shift+S** — the procedural suit must wrap the GLB body with no gaps or pokes; adjust the GLB, not the code.
   (The adapter has been smoke-tested with a GLB exported from the procedural rig; third-party skinned assets may need mesh-name tweaks.)

## 7. Spider arms
Four arms `(L1, L2, claw) = (0.50, 0.46, 0.20) m`, sockets on the back plate at chest-space `(±0.085, +0.155/+0.045, −0.15)`.
Two-bone analytic IK per arm + pole vector; stowed = Z-fold along the spine. A production model can replace `SpiderArms` segment meshes with GLB parts named
`Arm_TL_1/2/Claw`, keeping the same lengths.
