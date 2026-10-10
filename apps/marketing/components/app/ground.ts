import * as THREE from 'three'

// What the model stands in: the ground, ruled into squares as far as it goes, and the
// world's three axes through its middle. Both are the app's own
// (src/components/viewport/ground.tsx there): each is drawn over the whole view, and
// works out for every pixel what of it is seen there, so the ground has no edge and its
// squares are the size that suits how near it is looked at.

/** How near two lines of the ground may come, px, before they give way to the next size up. */
const GAP = 8
/** How strongly a line is drawn, and one in ten of them. */
const INK = { fine: 0.1, tenth: 0.24 }
/** How wide an axis is, px, and how strongly it is drawn. */
const AXIS = { width: 1.5, strength: 0.9 }
/** How nearly edge on something may be seen before it fades, and is gone. */
const SQUARE = {
  ground: { none: 0.01, full: 0.12 },
  axis: { none: 0.02, full: 0.15 },
}

const SCREEN = new THREE.BufferGeometry().setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
)

const vertexShader = `
  varying vec2 seen;
  void main() {
    seen = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`

// (the eye is not behind the middle of this view, as it is in the app's: the model is
// put to one side of the window, and \`skew\` is by how much)
const SIGHT = `
  uniform vec2 spread;
  uniform vec2 skew;
  uniform float dpr;
  uniform float shown;
  varying vec2 seen;

  vec3 look() {
    return normalize(vec3((seen + skew) * spread, -1.0));
  }

  vec2 pixel() {
    return vec2(dFdx(seen.x), dFdy(seen.y));
  }

  void away(float counted) {
    gl_FragDepth = clamp(counted, -1.0, 1.0) * 0.5 + 0.5;
  }`

const RULED = `
  ${SIGHT}
  uniform vec3 ink;
  uniform mat3 onGround;
  uniform vec3 depth;
  uniform mat3 turned;

  vec2 at;
  vec2 grain;

  float ruled(float gap) {
    vec2 across = at / gap;
    vec2 off = abs(fract(across - 0.5) - 0.5) * gap / grain;
    off += step(abs(across), vec2(0.5)) * 1e3;
    return clamp(0.5 * (dpr + 1.0) - min(off.x, off.y), 0.0, 1.0);
  }

  void main() {
    vec2 size = pixel();
    float square = abs(dot(look(), turned[2]));
    vec3 found = onGround * vec3(seen, 1.0);
    if (square <= ${SQUARE.ground.none.toFixed(3)} || found.z <= 0.0) discard;
    at = found.xy / found.z;
    vec2 across = (onGround[0].xy - at * onGround[0].z) / found.z * size.x;
    vec2 up = (onGround[1].xy - at * onGround[1].z) / found.z * size.y;
    grain = vec2(length(vec2(across.x, up.x)), length(vec2(across.y, up.y)));
    float level = log(max(grain.x, grain.y) * dpr * ${GAP.toFixed(1)}) / log(10.0);
    float gap = pow(10.0, ceil(level));
    float room = ceil(level) - level;
    float fine = ${INK.fine.toFixed(3)};
    float tenth = ${INK.tenth.toFixed(3)};
    float alpha = max(
      max(ruled(gap) * fine * room, ruled(gap * 10.0) * mix(fine, tenth, room)),
      ruled(gap * 100.0) * tenth
    );
    alpha *= smoothstep(
      ${SQUARE.ground.none.toFixed(3)}, ${SQUARE.ground.full.toFixed(3)}, square
    );
    away(dot(depth, vec3(seen, 1.0)));
    gl_FragColor = vec4(ink, alpha * shown);
    #include <colorspace_fragment>
  }`

const AXES = `
  ${SIGHT}
  uniform vec3 colour[3];
  uniform mat4 placed;
  uniform mat3 turned;

  void main() {
    vec2 size = pixel();
    vec3 eye = look();
    vec4 middle = placed[3];
    float most = 0.0;
    float off = 0.0;
    vec3 tint = vec3(0.0);
    for (int axis = 0; axis < 3; axis++) {
      float square = length(cross(eye, turned[axis]));
      if (square <= ${SQUARE.axis.none.toFixed(3)}) continue;
      vec4 way = placed[axis];
      vec3 line = cross(middle.xyw, way.xyw);
      float wide = length(line.xy * size);
      if (wide <= 0.0) continue;
      float aside = abs(dot(line, vec3(seen, 1.0))) / wide;
      vec2 run = way.xy - seen * way.w;
      float along = dot(seen * middle.w - middle.xy, run) / dot(run, run);
      float ahead = middle.w + along * way.w;
      if (ahead <= 0.0) continue;
      float drawn =
        clamp(0.5 * (${AXIS.width.toFixed(2)} * dpr + 1.0) - aside, 0.0, 1.0) *
        smoothstep(
          ${SQUARE.axis.none.toFixed(3)}, ${SQUARE.axis.full.toFixed(3)}, square
        );
      if (drawn > most) {
        most = drawn;
        off = (middle.z + along * way.z) / ahead;
        tint = colour[axis];
      }
    }
    if (most <= 0.0) discard;
    away(off);
    gl_FragColor = vec4(tint, most * ${AXIS.strength.toFixed(3)} * shown);
    #include <colorspace_fragment>
  }`

export type Ground = {
  /** the ground and the axes, to put in a scene: they are drawn under the model's lines */
  objects: THREE.Mesh[]
  /** how much of them shows, 0 to 1 */
  show: (by: number) => void
  /** how many of the screen's pixels there are to one of the view's */
  sharpen: (ratio: number) => void
  dispose: () => void
}

export function makeGround(ratio: number, axes: { x: string; y: string; z: string }): Ground {
  const sight = {
    placed: { value: new THREE.Matrix4() },
    turned: { value: new THREE.Matrix3() },
    onGround: { value: new THREE.Matrix3() },
    depth: { value: new THREE.Vector3() },
    spread: { value: new THREE.Vector2() },
    skew: { value: new THREE.Vector2() },
    dpr: { value: ratio },
    shown: { value: 0 },
  }
  const over = { vertexShader, transparent: true, depthWrite: false }
  const ruled = new THREE.ShaderMaterial({
    ...over,
    fragmentShader: RULED,
    uniforms: { ...sight, ink: { value: new THREE.Color('#fafafa') } },
  })
  const lines = new THREE.ShaderMaterial({
    ...over,
    fragmentShader: AXES,
    uniforms: {
      ...sight,
      colour: { value: [new THREE.Color(axes.x), new THREE.Color(axes.y), new THREE.Color(axes.z)] },
    },
  })

  const ground = new THREE.Mesh(SCREEN, ruled)
  const toCamera = new THREE.Matrix4()
  const toScreen = new THREE.Matrix3()
  /** Where the ground is as the eye has it now: worked out as each is about to be drawn. */
  const find = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
    toCamera.multiplyMatrices(camera.matrixWorldInverse, ground.matrixWorld)
    sight.turned.value.setFromMatrix4(toCamera)
    sight.placed.value.multiplyMatrices(camera.projectionMatrix, toCamera)
    const lens = camera.projectionMatrix.elements
    sight.spread.value.set(1 / lens[0], 1 / lens[5])
    sight.skew.value.set(lens[8], lens[9])
    const m = sight.placed.value.elements
    toScreen.set(m[0], m[4], m[12], m[1], m[5], m[13], m[3], m[7], m[15])
    sight.onGround.value.copy(toScreen).invert()
    sight.depth.value
      .set(m[2], m[6], m[14])
      .applyMatrix3(toScreen.copy(sight.onGround.value).transpose())
  }
  const objects = [ground, new THREE.Mesh(SCREEN, lines)]
  objects.forEach((object, index) => {
    object.frustumCulled = false
    object.renderOrder = -2 + index * 0.01
    object.onBeforeRender = find
    object.visible = false
  })

  return {
    objects,
    show(by) {
      sight.shown.value = by
      for (const object of objects) object.visible = by > 0.01
    },
    sharpen(next) {
      sight.dpr.value = next
    },
    dispose() {
      ruled.dispose()
      lines.dispose()
    },
  }
}
