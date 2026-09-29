import * as THREE from 'three'
import noise from '../shaders/noise.glsl?raw'
import revealVert from '../shaders/suitReveal.vert?raw'
import revealFrag from '../shaders/suitReveal.frag?raw'
import type { SuitPartName } from '../character/rigSpec'
import { SUIT_PARTS } from '../character/rigSpec'

type U = { value: number }
export interface PartUniforms { uReveal: U; uMix: U }

/** One uniform block per suit region, shared by every civilian and suit material of that region. */
const parts = {} as Record<SuitPartName, PartUniforms>
for (const p of SUIT_PARTS) parts[p] = { uReveal: { value: 0 }, uMix: { value: 1 } }
export const partUniforms = (p: SuitPartName) => parts[p]

export const globalNano = {
  uTime: { value: 0 },
  uEdgeWidth: { value: 0.11 },
  uEdgeGlow: { value: 2.4 },
  uNoiseScale: { value: 13 },
  uNanoDensity: { value: 95 },
  uEdgeColorA: { value: new THREE.Color('#ffc65a') },  // suit side of the front: molten gold
  uEdgeColorB: { value: new THREE.Color('#8fe4ff') },  // civilian side: cyan burn
}

/**
 * Inject the nano reveal into any built-in material (Standard / Physical / Basic).
 * suit:      visible where reveal > order  (forming)
 * civilian:  visible where reveal <= order (dissolving) — exactly complementary
 */
export function patchNano(mat: THREE.Material, part: SuitPartName, civilian: boolean) {
  const pu = parts[part]
  const invert = civilian ? 1 : 0
  mat.userData.nanoPart = part
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, globalNano, { uReveal: pu.uReveal, uMix: pu.uMix, uInvert: { value: invert } })
    shader.vertexShader = revealVert + '\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vNano = mix(aNano, aNano2, uMix);
       vNanoPos = position;
       #ifdef USE_INSTANCING
         vNanoPos = (instanceMatrix * vec4(position, 1.0)).xyz;
       #endif`,
    )
    shader.fragmentShader = revealFrag + '\n' + noise + '\n' + shader.fragmentShader
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         float nanoN = snoise(vNanoPos * uNoiseScale + vec3(0.0, uTime * 0.35, 0.0)) * 0.5 + 0.5;
         float nanoM = clamp(vNano * 0.82 + nanoN * 0.18, 0.0, 1.0);
         float nanoD = uReveal * (1.0 + uEdgeWidth) - nanoM;
         float nanoSide = mix(nanoD, -nanoD, uInvert);
         if (nanoSide < 0.0) discard;
         float nanoActive = smoothstep(0.002, 0.04, uReveal) * (1.0 - smoothstep(0.985, 0.999, uReveal));
         float nanoBand = (1.0 - smoothstep(0.0, uEdgeWidth, nanoSide)) * nanoActive;
         vec2 nanoHx = nanoHex(vec2(vNanoPos.x + vNanoPos.z * 0.7, vNanoPos.y) * uNanoDensity);
         float nanoCell = smoothstep(0.0, 0.16, nanoHx.x);
         float nanoSpark = step(0.86, fract(nanoHx.y * 7.0 + floor(uTime * 9.0) * 0.137));
         float nanoGlow = nanoBand * (0.35 + 0.65 * (1.0 - nanoCell) + nanoSpark * 1.4);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         gl_FragColor.rgb += mix(uEdgeColorA, uEdgeColorB, uInvert) * nanoGlow * uEdgeGlow;`,
      )
  }
  mat.customProgramCacheKey = () => 'nano-' + (civilian ? 'c' : 's')
  mat.needsUpdate = true
}

export function setPartProgress(p: SuitPartName, reveal: number, mix?: number) {
  parts[p].uReveal.value = reveal
  if (mix !== undefined) parts[p].uMix.value = mix
}
