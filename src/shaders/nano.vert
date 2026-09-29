// Nano-particle swarm: every particle belongs to a suit region, flies from the chest core to a point on that
// region's surface (a capsule around the bone segment) while the region's reveal progress advances, and flies back
// when it runs in reverse.
attribute float aPart;
attribute float aT;
attribute float aAngle;
attribute vec4 aRand;
uniform vec3 uSegA[19];
uniform vec3 uSegB[19];
uniform float uRad[19];
uniform float uProg[19];
uniform vec3 uCore;
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uFlow;
varying float vAlpha;
varying vec3 vColor;

void main() {
  int p = int(aPart + 0.5);
  vec3 A = uSegA[p]; vec3 B = uSegB[p];
  vec3 axis = normalize(B - A + vec3(0.0001));
  vec3 n1 = normalize(cross(axis, vec3(0.0, 0.0, 1.0)) + vec3(0.0001, 0.0, 0.0));
  vec3 n2 = cross(axis, n1);
  float ang = aAngle;
  vec3 radial = (n1 * cos(ang) + n2 * sin(ang)) * uRad[p] * (1.0 + aRand.w * 0.12);
  vec3 target = mix(A, B, aT) + radial;

  float s = uProg[p];
  float delay = aRand.x * 0.55;
  float f = smoothstep(delay, delay + 0.45, s * 1.35);
  float ease = f * f * (3.0 - 2.0 * f);
  vec3 dir = target - uCore;
  // curl-like swirl that vanishes at both ends of the flight
  float sw = sin(f * 3.14159265);
  vec3 swirl = vec3(sin(uTime * 3.0 + aRand.y * 40.0), cos(uTime * 2.3 + aRand.z * 40.0), sin(uTime * 2.7 + aRand.x * 40.0)) * 0.09 * sw;
  vec3 pos = uCore + dir * ease + swirl + normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(0.001)) * sw * 0.12 * (aRand.y - 0.5);
  // slight hover shimmer near the surface
  pos += radial * 0.06 * sin(uTime * 9.0 + aRand.z * 30.0) * smoothstep(0.7, 1.0, f);

  float life = sw;                                   // 0 at core and at target, 1 mid-flight
  float settle = smoothstep(0.9, 1.0, f) * (1.0 - smoothstep(0.97, 1.0, s)) * (0.45 + 0.55 * step(0.6, aRand.y));
  vAlpha = clamp(pow(life, 0.7) + settle * 0.7, 0.0, 1.0) * uFlow * step(0.001, s);
  float k = aRand.z;
  vColor = k < 0.5 ? vec3(1.0, 0.12, 0.1) : (k < 0.8 ? vec3(1.0, 0.72, 0.25) : (k < 0.93 ? vec3(1.0, 0.95, 0.85) : vec3(0.5, 0.9, 1.0)));

  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.55 + aRand.y * 0.9) * uScale / max(0.1, -mv.z) * (0.5 + life);
}
