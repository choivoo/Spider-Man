import type { Section } from './loft'

/** Master body profiles (metres). Every mesh — skin, clothes, suit — is a slice of these,
 *  which is why the silhouettes line up across Civilian ↔ Spider forms. */

/** Torso, world Y (ascending). */
export const TORSO: Section[] = [
  { y: 0.86, rx: 0.128, rz: 0.092 },
  { y: 0.92, rx: 0.152, rz: 0.100 },
  { y: 0.98, rx: 0.160, rz: 0.104 },
  { y: 1.05, rx: 0.148, rz: 0.098 },
  { y: 1.12, rx: 0.140, rz: 0.090 },
  { y: 1.20, rx: 0.152, rz: 0.100 },
  { y: 1.30, rx: 0.168, rz: 0.110, cz: 0.006 },
  { y: 1.38, rx: 0.180, rz: 0.108, cz: 0.002 },
  { y: 1.425, rx: 0.176, rz: 0.098 },
  { y: 1.46, rx: 0.105, rz: 0.075 },
  { y: 1.49, rx: 0.060, rz: 0.058 },
]

/** Arm, Y measured from the shoulder joint (descending). */
export const ARM: Section[] = [
  { y: 0.032, rx: 0.038, rz: 0.040 },
  { y: 0.010, rx: 0.052, rz: 0.054 },
  { y: -0.03, rx: 0.052, rz: 0.054 },
  { y: -0.08, rx: 0.047, rz: 0.049 },
  { y: -0.15, rx: 0.042, rz: 0.044 },
  { y: -0.23, rx: 0.037, rz: 0.039 },
  { y: -0.285, rx: 0.035, rz: 0.036 },
  { y: -0.33, rx: 0.038, rz: 0.040 },
  { y: -0.40, rx: 0.039, rz: 0.041 },
  { y: -0.47, rx: 0.031, rz: 0.030 },
  { y: -0.545, rx: 0.025, rz: 0.021 },
]

/** Leg, Y measured from the hip joint (descending). */
export const LEG: Section[] = [
  { y: 0.10, rx: 0.090, rz: 0.095 },
  { y: 0.02, rx: 0.092, rz: 0.098 },
  { y: -0.10, rx: 0.086, rz: 0.093 },
  { y: -0.25, rx: 0.073, rz: 0.078 },
  { y: -0.38, rx: 0.056, rz: 0.060 },
  { y: -0.44, rx: 0.050, rz: 0.054 },
  { y: -0.50, rx: 0.053, rz: 0.062, cz: -0.010 },
  { y: -0.60, rx: 0.051, rz: 0.062, cz: -0.012 },
  { y: -0.72, rx: 0.038, rz: 0.042 },
  { y: -0.80, rx: 0.031, rz: 0.034 },
  { y: -0.845, rx: 0.030, rz: 0.033 },
]

/** Neck, world Y. */
export const NECK: Section[] = [
  { y: 1.42, rx: 0.058, rz: 0.060 },
  { y: 1.50, rx: 0.052, rz: 0.054 },
  { y: 1.58, rx: 0.049, rz: 0.052, cz: 0.008 },
]

/** Head, local to the head pivot (ascending): chin at −0.055, crown at +0.18 → 0.235 m. */
export const HEAD: Section[] = [
  { y: -0.055, rx: 0.026, rz: 0.034, cz: 0.078, n: 2.2 },
  { y: -0.046, rx: 0.048, rz: 0.058, cz: 0.062, n: 2.1 },
  { y: -0.020, rx: 0.066, rz: 0.084, cz: 0.036, n: 2.15 },
  { y: 0.020, rx: 0.075, rz: 0.095, cz: 0.022, n: 2.15 },
  { y: 0.060, rx: 0.078, rz: 0.098, cz: 0.020, n: 2.15 },
  { y: 0.100, rx: 0.077, rz: 0.097, cz: 0.014, n: 2.15 },
  { y: 0.140, rx: 0.070, rz: 0.090, cz: 0.005, n: 2.1 },
  { y: 0.168, rx: 0.052, rz: 0.072, cz: -0.003, n: 2.2 },
  { y: 0.180, rx: 0.022, rz: 0.040, cz: -0.005, n: 2.0 },
]

/** Shoe, authored along Z (see buildShoe): z, half-width, half-height, centre-height rel. ankle. */
export const SHOE = [
  { z: -0.068, hw: 0.030, hh: 0.036, cy: -0.028 },
  { z: -0.035, hw: 0.037, hh: 0.045, cy: -0.024 },
  { z: 0.030, hw: 0.040, hh: 0.038, cy: -0.033 },
  { z: 0.100, hw: 0.045, hh: 0.029, cy: -0.041 },
  { z: 0.170, hw: 0.042, hh: 0.023, cy: -0.049 },
  { z: 0.208, hw: 0.028, hh: 0.016, cy: -0.057 },
  { z: 0.222, hw: 0.006, hh: 0.006, cy: -0.062 },
]
