import * as THREE from 'three'
import { clamp } from './pose'

export interface LookOutput {
  /** radians, +yaw = towards character's left (+X) ; +pitch = up */
  yaw: number; pitch: number
  eyeYaw: number; eyePitch: number
}

type Mode = 'user' | 'away' | 'scan' | 'manual'

/** Eye + head look-at with idle glances away, scanning ("look around") and pointer/touch reaction. */
export class LookAtController {
  out: LookOutput = { yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0 }
  private mode: Mode = 'user'
  private timer = 3
  private awayYaw = 0
  private awayPitch = 0
  private scanT = 0
  private smoothYaw = 0
  private smoothPitch = 0
  private eyeYaw = 0
  private eyePitch = 0
  private saccadeT = 0
  private sacYaw = 0
  private sacPitch = 0
  pointerNdc = new THREE.Vector2()
  pointerActive = 0
  userBias = 1 // 0 = ignore user completely
  reducedMotion = false
  private tmp = new THREE.Vector3()

  lookAwayFor(sec: number, dirYaw?: number, dirPitch?: number) {
    this.mode = 'away'; this.timer = sec
    this.awayYaw = dirYaw ?? (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45)
    this.awayPitch = dirPitch ?? 0.05 + Math.random() * 0.3
  }
  lookAround() { this.mode = 'scan'; this.scanT = 0; this.timer = 3.6 }
  lookAtUser() { this.mode = 'user'; this.timer = 2 + Math.random() * 4 }
  /** true if currently glancing away */
  get isAway() { return this.mode === 'away' || this.mode === 'scan' }

  update(dt: number, cam: THREE.Camera, headWorld: THREE.Vector3, rootQuat: THREE.Quaternion, talking: boolean) {
    // --- schedule behaviours
    this.timer -= dt
    if (this.timer <= 0) {
      if (this.mode === 'user') {
        const r = Math.random()
        if (this.reducedMotion) this.timer = 6
        else if (r < 0.14) this.lookAround()
        else if (r < 0.55) this.lookAwayFor(0.9 + Math.random() * 1.4)
        else this.timer = 3 + Math.random() * 5
        if (talking && this.mode !== 'user') this.timer *= 0.6
      } else this.lookAtUser()
    }
    // --- target direction (relative to character forward in root space)
    let ty = 0, tp = 0
    if (this.mode === 'user' || this.mode === 'manual') {
      // camera position as the user's eyes, nudged by the pointer
      const camPos = this.tmp.copy(cam.position)
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
      camPos.addScaledVector(right, this.pointerNdc.x * 1.6).addScaledVector(up, this.pointerNdc.y * 1.1)
      const inv = rootQuat.clone().invert()
      const d = camPos.sub(headWorld).applyQuaternion(inv)
      ty = Math.atan2(d.x, d.z)
      tp = Math.atan2(d.y, Math.hypot(d.x, d.z))
      ty *= this.userBias; tp *= this.userBias
    } else if (this.mode === 'away') {
      ty = this.awayYaw; tp = this.awayPitch
    } else if (this.mode === 'scan') {
      this.scanT += dt
      const p = this.scanT / 3.6
      ty = Math.sin(p * Math.PI * 2) * 0.7; tp = 0.1 + Math.sin(p * Math.PI * 4) * 0.08
    }
    // micro-saccades
    this.saccadeT -= dt
    if (this.saccadeT <= 0) {
      this.saccadeT = 0.4 + Math.random() * 1.6
      this.sacYaw = (Math.random() - 0.5) * 0.05
      this.sacPitch = (Math.random() - 0.5) * 0.035
    }
    const headLimitYaw = 1.0, headLimitPitch = 0.55
    const wantHeadYaw = clamp(ty * 0.6, -headLimitYaw, headLimitYaw)
    const wantHeadPitch = clamp(tp * 0.55, -0.4, headLimitPitch)
    const kh = 1 - Math.exp(-dt * (this.mode === 'away' ? 6 : 4.2))
    this.smoothYaw += (wantHeadYaw - this.smoothYaw) * kh
    this.smoothPitch += (wantHeadPitch - this.smoothPitch) * kh
    // eyes are faster and cover the remainder
    const restYaw = clamp(ty - this.smoothYaw + this.sacYaw, -0.5, 0.5)
    const restPitch = clamp(tp - this.smoothPitch + this.sacPitch, -0.35, 0.35)
    const ke = 1 - Math.exp(-dt * 16)
    this.eyeYaw += (restYaw - this.eyeYaw) * ke
    this.eyePitch += (restPitch - this.eyePitch) * ke
    this.out.yaw = this.smoothYaw; this.out.pitch = this.smoothPitch
    this.out.eyeYaw = this.eyeYaw; this.out.eyePitch = this.eyePitch
    return this.out
  }
}
