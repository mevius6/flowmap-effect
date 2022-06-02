import {
  Flowmap,
  Geometry,
  Mesh,
  Program,
  Renderer,
  Texture,
  Triangle,
  Vec2,
  Vec4,
} from 'https://cdn.skypack.dev/ogl';

let win = window,
  { innerWidth: vw, innerHeight: vh } = win;

let doc = document,
  { documentElement: root, body } = doc;

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
  }
`;
const fragment = /* glsl */ `
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

body.appendChild(gl.canvas);

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

// Default rendered dimensions of the image texture
// w/ 3:4 (SD) aspect ratio
const imageSize = { w: 3000, h: 4000, ar: [(3/4), (4/3)] };

let a1, a2;
let imgAspectRatio = (imageSize.h / imageSize.w);
let winAspectRatio = (vh / vw);

if (winAspectRatio < imgAspectRatio) {
  a1 = 1;
  a2 = (winAspectRatio / imgAspectRatio);
} else {
  a1 = (vw / vh) * imgAspectRatio;
  a2 = 1;
}

// Create URL to load media resource from
const assetURL = (num = 0, struct = {}) => {
  let assetPrefix = struct.prefix || '',
      basePath = `${struct.path || 'images'}/`,
      fileName = `${struct.name || 'img'}`;

  let fileIndex = `${struct.index || num}`,
      fileFormat = {
        jpg: 'jpg',
        jpeg: 'jpeg',
        webp: 'webp',
        avif: 'avif',
      };

  let suffix = struct.suffix,
      extension = `.${fileFormat[struct.format]}`;

  let url = assetPrefix + basePath + fileName + fileIndex + (suffix ? suffix + extension : extension);

  return url;
}

const texturesArray = [
  {
    url: 'tex/img0-q80.jpg',
    ar: [3000, 4000],
  }, {
    url: 'tex/img1-q80.jpg',
    ar: [3000, 4000],
  }, {
    url: 'tex/img2-q80.jpg',
    ar: [3000, 4000],
  }, {
    url: 'tex/img3-q80.jpg',
    ar: [3000, 4000],
  }
],
  { length: amount, [amount - 1]: lastEl } = texturesArray;

let clicks = 0;

/**
 * Check if the current number is the end-of-queue.
 *
 * @param {number} currVal Current value
 * @param {number} maxVal Maximum value
 * @return {Promise<number>} The current number
 */
const isEndOfQueue = (currVal, maxVal) => {
  return new Promise((resolve, reject) => {
    if (currVal >= maxVal - 1) {
      resolve(currVal);
    } else {
      reject(currVal);
    }
  });
};

// Initially set the image as a texture
const onLoadEv = () => switchTextures();
// Update image on click
const onClickEv = () => switchTextures();

// Create handlers
doc.addEventListener('click', onClickEv, false);

win.addEventListener('load', onLoadEv, false);
win.addEventListener('resize', resize, false);

/**
 * @typedef {Object} texSwitchProps
 * Texture-switching options.
 *
 * Indicates whether images in {@linkcode texturesArray} are:
 * 1. Same in dimensions
 * 2. Diff in sizes
 * 3. Diff in aspect ratios
 *
 * @prop {boolean} hasEqualDims - Is all textures have the equal dimensions.
 * It is initially true.
 * @prop {boolean} hasDiffSizes - Is all textures differ in sizes.
 * It is initially false.
 * @prop {boolean} hasDiffRatio - Is all textures differ in aspect ratios.
 * It is initially false.
 * @prop {boolean} isLooped - Is a continuous sequence of images.
 * It is initially true.
 */

/**
 * Switch between different textures.
 * @class
 * @classdesc Sequential loop/cycling between images using a {@linkcode num} that increases per-click.
 *
 * @param {number} [num=0] Input value to {@linkcode pickTexture} from.
 * @param {texSwitchProps} props Texture switching options.
 *
 * @example <caption>The default state</caption>
 * switchTextures({ hasEqualDims: true });
 * @example <caption>The negation of {@linkcode hasEqualDims} and vice versa</caption>
 * switchTextures({ hasDiffSizes: true });
 * @example <caption>Resizes images relative to the texture's aspect ratio</caption>
 * switchTextures({ hasDiffRatio: true });
 *
 * @todo Implement variations w/ next/previous controls and autoplay.
 */
function switchTextures(num = 0, props = {}) {
  // Properties added by default to a new instance
  let { hasEqualDims, hasDiffSizes, isLooped } = props;

  // If options are not specified
  if (Object.entries(props).length == 0) {
    hasEqualDims = true;
    hasDiffSizes = false;
    isLooped = true;
  }

  // Increment a number by triggering
  if (Number.isInteger(num)) num = clicks++;

  isEndOfQueue(num, amount)
    .then(() => {
      // Reset incrementor at the end of loop
      clicks = 0;
      doc.removeEventListener('click', onClickEv, false);
    })
    .finally(() => {
      if (isLooped) doc.addEventListener('click', onClickEv, false);
    });

  if (!hasEqualDims || hasDiffSizes) {
    // Texture dimensions needs update per-image load
    const upd = texturesArray.map((img, idx, arr) => {
      if (num == idx && arr.includes(img.ar)) {
        imageSize.w = img.ar[0];
        imageSize.h = img.ar[1];
      }
      resize();
    });
  }

  try {
    // Pick image by index
    let struct = {
      path: 'tex',
      name: 'img',
      // index: num,
      suffix: '-q80',
      format: 'jpg',
    };
    pickTexture(assetURL(num, {...struct}));
  } catch (e) {
    // Could not load image from specified URL
    // console.error(e);
    alert(e.name + '\n' + e.message);
  }
}

/**
 * Get image natural/intrinsic dimensions for calc aspect ratio.
 *
 * @param {HTMLImageElement} el The img element.
 * @returns {Object.<string, number>[]} Aspect ratios.
 */
const getImgAspectRatio = (el) => {
  let {
    width: w,
    height: h,
    naturalWidth: nw,
    naturalHeight: nh
  } = el;

  let ar = [{
    portrait: (w/h),
    landscape: (h/w),
  }, {
    portrait: (nw/nh),
    landscape: (nh/nw),
  }];

  return ar;
}

// Create image load handler
const imgOnLoadEv = (ev) => getImgAspectRatio(ev.currentTarget);

/**
 * Apply the received image as a WebGL texture.
 *
 * @async
 * @function pickTexture
 * @param {string} query The URL to load media resource from.
 * @return Selected texture.
 */
async function pickTexture(query) {
  const texImage = await createImage()
    .then((img) => {
      // Applying the received image as a texture
      img
        .onload = () => (texture.image = img)
        .onerror = (e) => (console.error(e))
        .removeEventListener('load', imgOnLoadEv, false);

      // Set address of the resource
      img.src = query;
    })
    .catch(err => err?.message);

  return texture.image;
}

/**
 * @typedef {Object} imageProps
 * A set of essential image attributes:
 * 1. CORS mode — no credentials flag ('') is the same as 'anonmyous'
 * 2. Referrer policy
 * 2. Decoding hint
 * 3. Loading deferral
 *
 * @prop {string=} cors - If the image download remotely from an external media hosting service
 * @prop {string=} policy - Referrer policy for fetches initiated by the element
 * @prop {string=} decode - Decoding hint for processing this image
 * @prop {string=} load - Used when determining loading deferral
 */

/**
 * Create node for load image resource w/ CORS mode.
 *
 * @async
 * @function createImage
 * @param {...imageProps} attrs A set of essential attributes.
 * @returns The img element.
 */
async function createImage(...attrs) {
  // Create image node
  let img = new Image();

  // Create image load handler
  img.addEventListener('load', imgOnLoadEv, false);
  // img.onload = (ev) => ();
  // img.error = (err) => ({name, message});

  return {
    crossOrigin: attrs.cors = 'anonmyous',
    decoding: attrs.decode = 'async',
    loading: attrs.load = 'eager',
  } = img;
}

function resize() {
  let a1, a2;
  let imgAspectRatio = imageSize.h / imageSize.w;
  if (winAspectRatio < imgAspectRatio) {
    a1 = 1;
    a2 = winAspectRatio / imgAspectRatio;
  } else {
    a1 = (vw / vh) * imgAspectRatio;
    a2 = 1;
  }
  mesh.program.uniforms.res.value = new Vec4(
    vw,
    vh,
    a1,
    a2
  );

  renderer.setSize(vw, vh);
  aspect = vw / vh;
}

const program = new Program(gl, {
  vertex,
  fragment,
  uniforms: {
    uTime: { value: 0 },
    tWater: { value: texture },
    res: { value: new Vec4(vw, vh, a1, a2) },
    img: { value: new Vec2(imageSize.w, imageSize.h) },
    // Note that the uniform is applied w/o using an object and value property
    // This is b/c the class alternates this texture b/w two render targets
    // and updates the value property after each render.
    tFlow: flowmap.uniform,
  },
});

const mesh = new Mesh(gl, { geometry, program });

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
  // Get mouse value in 0–1 range, w/ y flipped
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
