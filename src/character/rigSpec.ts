/**
 * Rig specification — the single contract between the procedural rig, animation, the suit
 * and any drop-in GLB/VRM character. World units are metres, +Y up, character faces +Z.
 * "L" is the character's LEFT (+X in world when the character faces +Z).
 */
export const BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'clavicleL', 'upperArmL', 'foreArmL', 'handL',
  'clavicleR', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
] as const
export type BoneName = (typeof BONES)[number]

/** Parent + rest offset (relative to parent) for every bone. Total height ≈ 1.78 m (7.6 heads). */
export const BONE_DEF: Record<BoneName, { parent: BoneName | 'root'; pos: [number, number, number] }> = {
  hips:      { parent: 'root',     pos: [0, 0.96, 0] },
  spine:     { parent: 'hips',     pos: [0, 0.09, 0] },
  chest:     { parent: 'spine',    pos: [0, 0.17, 0] },
  neck:      { parent: 'chest',    pos: [0, 0.235, 0] },
  head:      { parent: 'neck',     pos: [0, 0.145, -0.012] },
  clavicleL: { parent: 'chest',    pos: [0.05, 0.20, 0] },
  upperArmL: { parent: 'clavicleL', pos: [0.135, -0.005, 0] },
  foreArmL:  { parent: 'upperArmL', pos: [0, -0.285, 0] },
  handL:     { parent: 'foreArmL', pos: [0, -0.255, 0] },
  clavicleR: { parent: 'chest',    pos: [-0.05, 0.20, 0] },
  upperArmR: { parent: 'clavicleR', pos: [-0.135, -0.005, 0] },
  foreArmR:  { parent: 'upperArmR', pos: [0, -0.285, 0] },
  handR:     { parent: 'foreArmR', pos: [0, -0.255, 0] },
  thighL:    { parent: 'hips',     pos: [0.095, -0.04, 0] },
  shinL:     { parent: 'thighL',   pos: [0, -0.44, 0] },
  footL:     { parent: 'shinL',    pos: [0, -0.405, 0] },
  thighR:    { parent: 'hips',     pos: [-0.095, -0.04, 0] },
  shinR:     { parent: 'thighR',   pos: [0, -0.44, 0] },
  footR:     { parent: 'shinR',    pos: [0, -0.405, 0] },
}

/** Rest-pose (A-pose) Euler rotation, radians. */
export const REST_EULER: Partial<Record<BoneName, [number, number, number]>> = {
  upperArmL: [0, 0, 0.1], upperArmR: [0, 0, -0.1],
  foreArmL: [-0.06, 0, 0], foreArmR: [-0.06, 0, 0],
}

/** World-space rest Y of each bone (sum of parents' offsets) — used to author part geometry in world Y. */
export function restWorldY(name: BoneName): number {
  let y = 0
  let cur: BoneName | 'root' = name
  while (cur !== 'root') { y += BONE_DEF[cur].pos[1]; cur = BONE_DEF[cur].parent }
  return y
}

/** Aliases used to bind a foreign skeleton (Mixamo, VRM humanoid, Blender rigify) to our bone names. */
export const BONE_ALIASES: Record<BoneName, string[]> = {
  hips: ['hips', 'pelvis', 'mixamorigHips', 'J_Bip_C_Hips'],
  spine: ['spine', 'spine1', 'mixamorigSpine', 'J_Bip_C_Spine'],
  chest: ['chest', 'spine2', 'upperchest', 'mixamorigSpine2', 'J_Bip_C_Chest'],
  neck: ['neck', 'mixamorigNeck', 'J_Bip_C_Neck'],
  head: ['head', 'mixamorigHead', 'J_Bip_C_Head'],
  clavicleL: ['leftshoulder', 'clavicle_l', 'shoulder_l', 'mixamorigLeftShoulder', 'J_Bip_L_Shoulder'],
  upperArmL: ['leftupperarm', 'upperarm_l', 'arm_l', 'mixamorigLeftArm', 'J_Bip_L_UpperArm'],
  foreArmL: ['leftlowerarm', 'lowerarm_l', 'forearm_l', 'mixamorigLeftForeArm', 'J_Bip_L_LowerArm'],
  handL: ['lefthand', 'hand_l', 'mixamorigLeftHand', 'J_Bip_L_Hand'],
  clavicleR: ['rightshoulder', 'clavicle_r', 'shoulder_r', 'mixamorigRightShoulder', 'J_Bip_R_Shoulder'],
  upperArmR: ['rightupperarm', 'upperarm_r', 'arm_r', 'mixamorigRightArm', 'J_Bip_R_UpperArm'],
  foreArmR: ['rightlowerarm', 'lowerarm_r', 'forearm_r', 'mixamorigRightForeArm', 'J_Bip_R_LowerArm'],
  handR: ['righthand', 'hand_r', 'mixamorigRightHand', 'J_Bip_R_Hand'],
  thighL: ['leftupperleg', 'thigh_l', 'upleg_l', 'mixamorigLeftUpLeg', 'J_Bip_L_UpperLeg'],
  shinL: ['leftlowerleg', 'calf_l', 'shin_l', 'leg_l', 'mixamorigLeftLeg', 'J_Bip_L_LowerLeg'],
  footL: ['leftfoot', 'foot_l', 'mixamorigLeftFoot', 'J_Bip_L_Foot'],
  thighR: ['rightupperleg', 'thigh_r', 'upleg_r', 'mixamorigRightUpLeg', 'J_Bip_R_UpperLeg'],
  shinR: ['rightlowerleg', 'calf_r', 'shin_r', 'leg_r', 'mixamorigRightLeg', 'J_Bip_R_LowerLeg'],
  footR: ['rightfoot', 'foot_r', 'mixamorigRightFoot', 'J_Bip_R_Foot'],
}

/** The 19 suit regions (see spec §5) and the bone each one is attached to. */
export const SUIT_PARTS = [
  'Head', 'Neck', 'Chest', 'Back', 'Shoulder_L', 'Shoulder_R', 'Arm_L', 'Arm_R',
  'Forearm_L', 'Forearm_R', 'Hand_L', 'Hand_R', 'Waist', 'Thigh_L', 'Thigh_R',
  'Shin_L', 'Shin_R', 'Foot_L', 'Foot_R',
] as const
export type SuitPartName = (typeof SUIT_PARTS)[number]

export const SUIT_PART_BONE: Record<SuitPartName, BoneName> = {
  Head: 'head', Neck: 'neck', Chest: 'chest', Back: 'chest', Shoulder_L: 'clavicleL', Shoulder_R: 'clavicleR',
  Arm_L: 'upperArmL', Arm_R: 'upperArmR', Forearm_L: 'foreArmL', Forearm_R: 'foreArmR',
  Hand_L: 'handL', Hand_R: 'handR', Waist: 'hips', Thigh_L: 'thighL', Thigh_R: 'thighR',
  Shin_L: 'shinL', Shin_R: 'shinR', Foot_L: 'footL', Foot_R: 'footR',
}

export const CHARACTER_HEIGHT = 1.78
export const HEAD_HEIGHT = 0.235
