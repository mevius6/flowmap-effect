import {
  Renderer,
  Program,
  Texture,
  Mesh,
  Vec2,
  Vec4,
  Flowmap,
  Geometry,
  Triangle
} from 'https://cdn.skypack.dev/ogl';

const win = window;
const doc = document;

const { innerWidth, innerHeight } = win;
// const {w: innerWidth, h: innerHeight} = winSize;

const vertex = `
  attribute vec2 uv;
  attribute vec2 position;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
  }
`;
const fragment = `
  precision highp float;
  precision highp int;

  uniform sampler2D tWater;
  uniform sampler2D tFlow;
  uniform float uTime;

  varying vec2 vUv;
  uniform vec4 res;

  void main() {
    // R and G values are velocity in the x and y direction
    // B value is the velocity length
    vec3 flow = texture2D(tFlow, vUv).rgb;

    // Use flow to adjust the uv lookup of a texture
    vec2 uv = .5 * gl_FragCoord.xy / res.xy ;
    vec2 myUV = (uv - vec2(0.5)) * res.zw + vec2(0.5);
    myUV -= flow.xy * (0.15 * 0.7);
    vec3 tex = texture2D(tWater, myUV).rgb;

    gl_FragColor = vec4(tex.r, tex.g, tex.b, 1.0);
  }
`;

const renderer = new Renderer({ dpr: 2 });
const gl = renderer.gl;
doc.body.appendChild(gl.canvas);

// Variable inputs to control flowmap
let aspect = 1;
const mouse = new Vec2(-1);
const velocity = new Vec2();

// function resize() {
//   renderer.setSize(window.innerWidth, window.innerHeight);
//   aspect = window.innerWidth / window.innerHeight;
// }
// window.addEventListener('resize', resize, false);
// resize();

const flowmap = new Flowmap(gl);

const geometry = new Geometry(gl, {
  position: {
    size: 2,
    data: new Float32Array([-1, -1, 3, -1, -1, 3]),
  },
  uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
});

const texture = new Texture(gl, {
  minFilter: gl.LINEAR,
  magFilter: gl.LINEAR,
});

// Default image dimensions
const imageSize = { w: 3000, h: 4000 };

let a1, a2;
let imgAspectRatio = (imageSize.h / imageSize.w);
let winAspectRatio = (innerHeight / innerWidth);

if (winAspectRatio < imgAspectRatio) {
  a1 = 1;
  a2 = (winAspectRatio / imgAspectRatio);
} else {
  a1 = (innerWidth / innerHeight) * imgAspectRatio;
  a2 = 1;
}

const texturesArray = [
  {
    url: 'images/tex0.jpg',
    ar: [3000, 4000],
  }, {
    url: 'images/tex1.jpg',
    ar: [3000, 4000],
  }, {
    url: 'images/tex2.jpg',
    ar: [3000, 4000],
  }, {
    url: 'images/tex3.jpg',
    ar: [3000, 4000],
  }
], amount = texturesArray.length;

let clicks = 0;

const onClickEv = () => switchTextures();
const onLoadEv = () => switchTextures();

doc.addEventListener('click', onClickEv, false);
win.addEventListener('load', onLoadEv, false);

/**
 * Switch between different textures
 * @param {*} num (Integer) to pick texture from array by
 * @param {*} vars
 * If the images unequal in dimensions — set false, true by default
 * @usage switchTextures({ isEqualInSize: false });
 */
function switchTextures(num = 0, vars = {}) {
  let { isEqualInSize } = vars;
  isEqualInSize = true;

  // Increment a number by triggering
  num = clicks++;
  // Reset incrementor
  if (num >= amount - 1) clicks = 0;
  // Pick texture by ordinal number
  let url = `images/tex${(num)}.jpg`;

  if (!isEqualInSize) {
    texturesArray.map((tex, idx, arr) => {
      if (num == idx) {
        imageSize.w = tex.ar[0];
        imageSize.h = tex.ar[1];
      }
      resize();
    });
  }

  pickTexture(url);
}

/**
 * @returns selected texture
 */
async function pickTexture(url) {
  loadImage(url)
    .then((img) => {resize();
      img.onload = () => (texture.image = img);
    })
    .catch(error => error.message);
}

async function loadImage(url) {
  let img = new Image();

  img.crossOrigin = 'Anonymous';
  img.decoding = 'async';
  img.src = url;

  return img;
}

function resize() {
  let a1, a2;
  let imgAspectRatio = imageSize.h / imageSize.w;
  if (winAspectRatio < imgAspectRatio) {
    a1 = 1;
    a2 = winAspectRatio / imgAspectRatio;
  } else {
    a1 = (innerWidth / innerHeight) * imgAspectRatio;
    a2 = 1;
  }
  mesh.program.uniforms.res.value = new Vec4(
    innerWidth,
    innerHeight,
    a1,
    a2
  );

  renderer.setSize(innerWidth, innerHeight);
  aspect = innerWidth / innerHeight;
}

const program = new Program(gl, {
  vertex,
  fragment,
  uniforms: {
    uTime: { value: 0 },
    tWater: { value: texture },
    res: {
      value: new Vec4(innerWidth, innerHeight, a1, a2),
    },
    img: { value: new Vec2(imageSize.w, imageSize.h) },
    // Note that the uniform is applied w/o using an object and value property
    // This is b/c the class alternates this texture b/w two render targets
    // and updates the value property after each render.
    tFlow: flowmap.uniform,
  },
});
const mesh = new Mesh(gl, { geometry, program });

win.addEventListener('resize', resize, false);
resize();

// Create handlers to get mouse position and velocity
const isTouchCapable = 'ontouchstart' in window;
if (isTouchCapable) {
  win.addEventListener('touchstart', updateMouse, false);
  win.addEventListener('touchmove', updateMouse, { passive: false });
} else {
  win.addEventListener('mousemove', updateMouse, false);
}

let lastTime;
const lastMouse = new Vec2();

function updateMouse(e) {
  e.preventDefault();
  if (e.changedTouches && e.changedTouches.length) {
    e.x = e.changedTouches[0].pageX;
    e.y = e.changedTouches[0].pageY;
  }
  if (e.x === undefined) {
    e.x = e.pageX;
    e.y = e.pageY;
  }
  // Get mouse value in 0–1 range, w/ Y flipped
  mouse.set(e.x / gl.renderer.width, 1.0 - e.y / gl.renderer.height);
  // Calculate velocity
  if (!lastTime) {
    // First frame
    lastTime = performance.now();
    lastMouse.set(e.x, e.y);
  }

  const deltaX = e.x - lastMouse.x;
  const deltaY = e.y - lastMouse.y;

  lastMouse.set(e.x, e.y);

  let time = performance.now();

  // Avoid dividing by 0
  let delta = Math.max(10.4, time - lastTime);
  lastTime = time;
  velocity.x = deltaX / delta;
  velocity.y = deltaY / delta;
  // Flag update to prevent hanging velocity values when not moving
  velocity.needsUpdate = true;
}
requestAnimationFrame(update);

function update(t) {
  requestAnimationFrame(update);

  // Reset velocity when mouse not moving
  if (!velocity.needsUpdate) {
    mouse.set(-1);
    velocity.set(0);
  }

  velocity.needsUpdate = false;
  // Update flowmap inputs
  flowmap.aspect = aspect;
  flowmap.mouse.copy(mouse);
  // Ease velocity input, slower when fading out
  flowmap.velocity.lerp(velocity, velocity.len ? 0.15 : 0.1);
  flowmap.update();
  program.uniforms.uTime.value = t * 0.01;
  renderer.render({ scene: mesh });
}
