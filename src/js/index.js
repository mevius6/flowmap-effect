import {
  Flowmap,
  Geometry,
  Mesh,
  Program,
  Renderer,
  Texture,
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

/**
 * The object inludes the essential set of WebGL context attributes
 * that are used by the OGL's {@linkcode Renderer} class.
 *
 * @typedef {Object} ctxAttrs
 * @prop {HTMLCanvasElement} canvas
 * Initially creates the `canvas` element and passes a reference to it.
 * @prop {number} [width=300]
 * It is initially `300`
 * @prop {number} [height=150]
 * It is initially `150`
 * @prop {number} [dpr=1]
 * It is initially `1`
 * @prop {boolean=} alpha
 * It is initially `false`
 * @prop {boolean=} depth
 * It is initially `true`
 * @prop {boolean=} stencil
 * It is initially `false`
 * @prop {boolean=} antialias
 * It is initially `false`
 * @prop {boolean=} premultipliedAlpha
 * It is initially `false`
 * @prop {boolean=} preserveDrawingBuffer
 * It is initially `false`
 * @prop {string=} powerPreference
 * It is initially `'default'`
 * @prop {boolean=} autoClear
 * It is initially `true`
 * @prop {number} [webgl=2]
 * It is initially `2`
 * @prop {Function} gl
 */

/**
 * Represents the class from OGL's [Core Component]{@link [core]}
 * that is used for rendering the scene.
 * Its purpose is to prepare/set up the WebGL context
 * by passing the necessary set of {@link ctxAttrs|context attributes},
 * and start rendering the content.
 *
 * @external @class Renderer
 * @param {...ctxAttrs} attributes A set of context attributes.
 * @constant
 * ___
 * [repo]: https://github.com/oframe/ogl/
 * [core]: https://github.com/oframe/ogl/tree/master/src/core
 * [file]: https://github.com/oframe/ogl/blob/master/src/core/Renderer.js
 * [line]: https://github.com/oframe/ogl/blob/master/src/core/Renderer.js#L16
 * @see
 * [Definition]{@link [line]} _in_ [OGL Source Code]{@link [repo]}
 */
const renderer = new Renderer({ dpr: 2 });

/**
 * The variable `gl` is reference to a successfully initialized context.
 * @summary Initialize the GL context.
 *
 * @memberof external:Renderer#
 * @instance
 * @constant
 * ___
 * [file]: https://github.com/oframe/ogl/blob/master/src/core/Renderer.js
 * [line]: https://github.com/oframe/ogl/blob/master/src/core/Renderer.js#L43
 * @see
 * [Definition]{@link [line]} _in_ [OGL's Renderer Source Code]{@link [file]}
 */
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

/**
 * ### Available parameters
 * | Param         | Type     | Initially | Description                        |
 * | ------------- | -------- | --------- | ---------------------------------- |
 * | `size`        | `number` | `128`     | Default size of the render targets |
 * | `falloff`     | `number` | `0.3`     | Size of the stamp, `%` of the size |
 * | `alpha`       | `number` | `1`       | Opacity of the stamp               |
 * | `dissipation` | `number` | `0.98`    | Affects the speed that the stamp fades |
 * ___
 * @example
 * const flowmap = new ogl.Flowmap(gl, { falloff: 0.2, dissipation: 0.9 });
 *
 * @external
 * @class external:Flowmap#
 * @module Flowmap
 *
 * ---
 * ### References
 * [ref1 demo]: https://oframe.github.io/ogl/examples/?src=mouse-flowmap.html
 * [ref1 code]: https://github.com/oframe/ogl/blob/master/examples/mouse-flowmap.htmll#L20
 * [ref1 by]: https://github.com/gordonnl
 * [ref2 demo]: https://tympanus.net/Development/FlowmapDeformation/
 * [ref2 code]: https://github.com/robin-dela/flowmap-effect
 * [ref2 by]: https://github.com/robin-dela
 * @see
 * [Mouse&nbsp;Flowmap]{@link [ref1 demo]}, [example]{@link [ref1 code]}
 * _by_ [Nathan Gordon]{@link [ref1 by]}
 * @see
 * [Flowmap&nbsp;Demos]{@link [ref2 demo]}, [tutorial]{@link [ref2 code]}
 * _by_ [Robin Delaporte]{@link [ref2 by]}
 */
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

// Default rendered dimensions of the image
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

/** @const @default */
const SRCDIR = 'src'; // source directory

const encodeURL = (str = '') => encodeURIComponent(str);
const decodeURL = (str = '') => decodeURIComponent(str);

/**
 * ### The Dot Character
 *
 * ---
 * ##### SYNOPSIS
 * `002E` `.` `FULL STOP`
 * = _period_, _dot_, _decimal point_
 *
 * ---
 * ##### USAGE
 * The _`dot`_ character is used in paths:
 * 1. To represent the _`current`_ directory
 * 2. To indicate the start of a filename extension
 *
 * ___
 * ##### ESCAPES
 * | Syntax      | Value      |
 * | ----------- | ---------- |
 * | Unicode     | `U+002E`   |
 * | CSS         | `\002E`    |
 * | HTML Number | `&#46;`    |
 * | HTML Name   | `&period;` |
 * | ASCII 0xFF  | `%2E`      |
 *
 * ---
 * ##### REFS
 * [dot]: http://www.linfo.org/dot.html
 * [unicode#page4]: https://www.unicode.org/Public/UCD/latest/charts/CodeCharts.pdf#page=4&zoom=page-actual
 *
 * @see {@link [CodeCharts][unicode#page4]} _by_ UCD
 * @see {@link [Definition][dot]} _by_ LINFO
 *
 * @const @default
 */
const DOT = '.';

/**
 * ### The Slash Character
 *
 * ---
 * ##### SYNOPSIS
 * `002F` `/` `SOLIDUS`
 * = _slash_, _forward slash_, _virgule_
 *
 * ---
 * ##### USAGE
 * The _`slash`_ character is used in paths:
 * 1. As a prefix for the path _or_ file name to represent a _`root`_ directory
 * 2. As a separator for the path _or_ directories
 *
 * ___
 * ##### ESCAPES
 * | Syntax      | Value    |
 * | ----------- | -------- |
 * | Unicode     | `U+002F` |
 * | CSS         | `\002F`  |
 * | HTML Number | `&#47;`  |
 * | HTML Name   | `&sol;`  |
 * | ASCII 0xFF  | `%2F`    |
 *
 * ---
 * ##### REFS
 * [forward_slash]: http://www.linfo.org/forward_slash.html
 * [unicode#page4]: https://www.unicode.org/Public/UCD/latest/charts/CodeCharts.pdf#page=4&zoom=page-actual
 *
 * @see {@link [CodeCharts][unicode#page4]} _by_ UCD
 * @see {@link [Definition][forward_slash]} _by_ LINFO
 *
 * @const @default
 */
const SOL = '/';

/**
 * The {@linkcode SOL|slash} character is used _as_ a _`directory separator`_
 * and to separate directory names from file names.
 * @const @default
 */
const SEP = SOL;

/**
 * ### The current directory
 * ___
 * The combination of a _{@linkcode DOT|dot}_ followed directly
 * by a _{@linkcode SOL|slash}_ that represents the relative path
 * pointing to the current working directory `CWD`.
 *
 * Prefix the file name w/ a _{@linkcode [dot&thinsp;slash][linfo:dotsol]}_
 * (i.e., a _{@linkcode DOT|dot}_ followed by a _{@linkcode SOL|forward slash}_
 * and with no intervening spaces).
 *
 * @summary
 * The _{@linkcode DOT|dot}_ is used in paths to represent
 * the _{@linkcode CURRDIR|current directory}_
 * and
 * the _{@linkcode SOL|slash}_ is use as
 * the _{@linkcode SEP|directory separator}_
 * and to separate directory names from file names.
 *
 * ---
 * ##### REFS
 * [linfo:dotsol]: http://www.linfo.org/dot_slash.html
 * [linfo:curdir]: http://www.linfo.org/current_directory.html
 *
 * @see {@linkcode [Definition][linfo:curdir]} _by_ LINFO
 * @const @default
 */
const CURRDIR = DOT + SOL;

/**
 * ### The root directory
 * ___
 * The _{@linkcode SOL|slash}_ character denotes
 * the _{@linkcode ROOTDIR|root directory}_ of the website.
 *
 * ---
 * ##### REFS
 * [linfo:root]: http://www.linfo.org/root_directory.html
 *
 * @see {@link [Definition][linfo:root]} _by_ LINFO
 * @const @default
 */
const ROOTDIR = SOL;

/**
 * Create URL to load _self-hosted_ media resource from.
 *
 * @param {number} inode File's index node (a unique identification number).
 * @param {Object.<string, (string|number)>} struct URL's structure
 * @returns {string} URL
 *
 * @example
 * // returns 'tex/img0-q80.jpg'
 * assetURL(0, {
 *   path: 'tex',
 *   name: 'img',
 *   suffix: '-q80',
 *   format: 'jpg',
 * });
 */
const assetURL = (inode = 0, struct = {}) => {
  let assetPrefix = struct.prefix || '',
      basePath = `${struct.base || 'images'}/`,
      fileName = `${struct.name || 'img'}`,
      fileDesc = `${struct.desc || inode}`, // File descriptor / identifier
      fileNameExtensions = {
        jpg: 'jpg',
        jpeg: 'jpeg',
        webp: 'webp',
        avif: 'avif',
      },
      extension = `.${fileNameExtensions[struct.format]}`,
      suffix = (struct.suffix ? struct.suffix + extension : extension);

  return `${assetPrefix}${basePath}${fileName}${fileDesc}${suffix}`;
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
 * Check if the current value is the `end-of-queue`.
 *
 * @param {number} currVal Current value
 * @param {number} maxVal Maximum value
 * @returns {Promise.<number>} Promise object represent the current value
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

// Attach event listeners
doc.addEventListener('click', onClickEv, false);
win.addEventListener('load', onLoadEv, false);
win.addEventListener('resize', resize, false);

// https://jsdoc.app/tags-enum.html
/**
 * Enum for imagesComparisonData values.
 * @readonly
 * @enum {(number|boolean)}
 */
let imagesComparisonData = {
  /** The `true` value */
  TRUE: 1,
  /** The `falsy` value */
  FALSE: -1,
  /** @type {boolean} */
  isEqualSizeBySize: true,
  /** @type {boolean} */
  hasDifferInRatios: false,
};

/**
 * @readonly
 * @typedef {Object.<string, (number|boolean)>} imagesComparisonArgs
 * Compare of Textures.
 * Compare pair of images and get {@link imagesComparisonData|data} about their similarity and processing time.
 *
 * TODO:
 * Receive and compare the dimensions and aspect ratios of all array elements
 * (with each other). Check the elements by the chain, for example, like this:
 * > `image1 is size-by-size equivalent to image2,`
 * > `image2 to image3, etc.`
 *
 * ___
 * Indicates whether the elements of the {@link texturesArray|array} are:
 * - {@linkcode switchProps.hasEqualDims|hasEqualDims}
 * `true` `If` → they're equal _in_ size
 * - {@linkcode switchProps.hasDiffSizes|hasDiffSizes}
 * `true` `If` → they're differ _in_ size
 * - {@linkcode switchProps.hasDiffRatio|hasDiffRatio}
 * `true` `If` → they're differ _in_ aspect ratios
 */

/**
 * @typedef {Object} switchProps
 * The object includes a set of options for
 * {@link switchTextures|texture switching}.
 *
 * @prop {boolean} hasEqualDims → True if all elements have the same dimensions.
 * It is initially `true`.
 * @prop {boolean} hasDiffSizes → True if all elements differ in sizes.
 * It is initially `false`.
 * @prop {boolean} hasDiffRatio → True if all elements differ in aspect ratios.
 * It is initially `false`.
 * @prop {boolean} isLooped Indicates whether the switching of elements is continuous.
 * It is initially `true`.
 */

/**
 * Switch between different textures.
 * @class
 * @classdesc Sequentially switch between images using a {@link num|numeric value} as a trigger, which is incremented per-click.
 *
 * @param {number} [num=0] Input value to {@link pickTexture|pick texture} from.
 * @param {switchProps} options A set of texture switching options.
 *
 * @example <caption>The default state</caption>
 * switchTextures({ hasEqualDims: true });
 * @example <caption>The negation of {@linkcode hasEqualDims}</caption>
 * switchTextures({ hasDiffSizes: true });
 *
 * @todo Implement variations w/ autoplay mode _and_ next/previous controls.
 */
function switchTextures(num = 0, options = {}) {
  // Properties added by default to a new instance
  let { hasEqualDims, hasDiffSizes, isLooped = true } = options;

  // If options are not specified
  if (Object.entries(options).length == 0) {
    hasEqualDims = true;

    // TODO: This should be the negation of each other and vice versa
    if (hasEqualDims) hasDiffSizes = false;
    // if (!hasEqualDims) hasDiffSizes = !hasEqualDims;
  }

  // Increment a number by triggering
  if (Number.isInteger(num)) num = clicks++;

  isEndOfQueue(num, amount)
    .then(() => {
      // Reset incrementor at the end-of-queue
      clicks = 0;
      // Detach the click event listener
      doc.removeEventListener('click', onClickEv, false);
    })
    .finally(() => {
      // If the queue is looped — attach the click event listener again
      if (isLooped) doc.addEventListener('click', onClickEv, false);
    });

  if (!hasEqualDims || hasDiffSizes) {
    // Texture's dimensions needs update by image's data
    // (async () => {
    //   texturesArray.map(async (img, idx, arr) => {
    //     if (num == idx) {
    //       imageSize.w = img.ar[0];
    //       imageSize.h = img.ar[1];
    //     }
    //   });
    // })().then(() => resize());
    texturesArray.map((img, idx, arr) => {
      if (num == idx) {
        imageSize.w = img.ar[0];
        imageSize.h = img.ar[1];
      }
    });
  }

  // Static props
  const urlStruct = {
    base: 'tex',
    name: 'img',
    format: 'jpg',
    suffix: '-q80',
  };

  try {
    // Pick an image by identification number in filename
    pickTexture(assetURL(num, {...urlStruct}));
  } catch (e) {
    // Failed to load an image from specified URL
    // console.error(e);
    alert(e.name + '\n' + e.message);
  }
}

/**
 * Get natural/intrinsic dimensions of the image to calc aspect ratio.
 *
 * @param {HTMLImageElement} el The img element.
 * @returns {Object.<string, number>} Aspect ratios.
 */
const getImgAspectRatio = (el) => {
  let {
    naturalWidth: w,
    naturalHeight: h
  } = el;
  let ar = {
    portrait: (w / h),
    landscape: (h / w)
  }
  return ar;
}

// Create an image load event handler
const imgOnLoadEv = (ev) => getImgAspectRatio(ev.currentTarget)
  && resize();

/**
 * Apply the received image as a WebGL texture.
 *
 * @async
 * @function pickTexture
 * @param {URL} location The URL to load media resource from.
 * @returns Selected texture.
 */
async function pickTexture(location) {
  const setImage = await createImage()
    .then((img) => {
      // Applying the received image as a texture
      img
        .onload = () => (texture.image = img)
        .onerror = (e) => (console.error(e));
      // Detach the load event listener if the image has been completely downloaded
      if (img.complete) img.removeEventListener('load', imgOnLoadEv, false);
      // Specify URI to fetch the resource by
      img.src = location;
    })
    .catch(err => err?.message);

  return texture.image;
}

/**
 * @typedef {Object} imageProps
 * __The object includes a set of essential image's attributes:__
 * 1. CORS settings — no credentials flag `''` is the same as `'anonmyous'`
 * 2. Referrer policy
 * 2. Decoding hint
 * 3. Loading deferral
 *
 * @prop {string} [cors=''] Its purpose is to allow images loaded remotely
 * from 3rd-party sites that allow _cross-origin_ access
 * (such as external media hosting service) to be used w/ canvas.
 * @prop {string=} policy Explicitly set a privacy-enhancing policy, such as `'strict-origin-when-cross-origin'` (or stricter)
 * @prop {string=} decode Decoding hint for processing this image
 * @prop {string=} load Used when determining loading deferral
 */

/**
 * Creates a node to load the image resource w/ CORS mode.
 *
 * @async
 * @function createImage
 * @param {...imageProps} attrs A set of essential attributes.
 * @returns The img element.
 */
async function createImage(...attrs) {
  // Create the image node
  let img = new Image();

  // Attach the load event listener
  img.addEventListener('load', imgOnLoadEv, false);
  // img.onload = (ev) => ();
  // img.error = (err) => {
  //   throw new Error(`${err.name}\n${err.message}`)
  // };

  return {
    crossOrigin: attrs.cors = 'anonmyous',
    referrerPolicy: attrs.policy = 'no-referrer',
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
  mesh.program.uniforms.res.value = new Vec4(vw, vh, a1, a2);

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
    // This is b/c the class alternates this texture between two render targets
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
