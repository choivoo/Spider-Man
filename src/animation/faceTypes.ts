export const VISEMES = ['AA', 'IH', 'OU', 'EE', 'OH', 'CH', 'FV', 'L', 'M', 'REST'] as const
export type Viseme = (typeof VISEMES)[number]

/** Facial blendshape weights (spec §25) — consumed by the procedural face, the suit eyes, or morph targets on an imported model. */
export interface FaceState {
  Blink_L: number; Blink_R: number
  Smile_L: number; Smile_R: number
  MouthOpen: number
  BrowUp: number; BrowDown: number
  Surprise: number; Angry: number; Sad: number; Squint: number
  /** resolved mouth shape from visemes + jaw */
  mouth: { open: number; width: number; round: number; fv: number }
  visemes: Record<Viseme, number>
}

export const blankFace = (): FaceState => ({
  Blink_L: 0, Blink_R: 0, Smile_L: 0, Smile_R: 0, MouthOpen: 0, BrowUp: 0, BrowDown: 0,
  Surprise: 0, Angry: 0, Sad: 0, Squint: 0,
  mouth: { open: 0, width: 1, round: 0, fv: 0 },
  visemes: { AA: 0, IH: 0, OU: 0, EE: 0, OH: 0, CH: 0, FV: 0, L: 0, M: 0, REST: 1 },
})

/** target mouth shape per viseme: open (0..1), width multiplier, roundness (0..1) */
export const VISEME_SHAPE: Record<Viseme, { open: number; width: number; round: number; fv?: number }> = {
  AA: { open: 0.85, width: 1.0, round: 0 },
  IH: { open: 0.3, width: 1.12, round: 0 },
  OU: { open: 0.35, width: 0.62, round: 1 },
  EE: { open: 0.22, width: 1.28, round: 0 },
  OH: { open: 0.6, width: 0.76, round: 0.7 },
  CH: { open: 0.18, width: 0.82, round: 0.5 },
  FV: { open: 0.1, width: 1.0, round: 0, fv: 1 },
  L: { open: 0.38, width: 1.0, round: 0 },
  M: { open: 0, width: 0.94, round: 0 },
  REST: { open: 0, width: 1, round: 0 },
}
