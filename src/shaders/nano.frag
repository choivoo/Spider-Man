varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vAlpha < 0.01) discard;
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * (1.0 + core * 2.0), vAlpha * core);
}
