/**
 * Filter worker — runs in a Web Worker thread.
 * Lazily loads filter modules on demand, caches them for subsequent calls.
 * Uses self.location to derive base path for dynamic imports.
 */
const BASE = self.location.href.replace(/\/worker\.js$/, '');
const BASE_URL = BASE.endsWith('/') ? BASE : BASE + '/';

// filterId → relative module path (must match FILTERS keys)
const FILTER_FILES = {
  channel:       'channel.js',
  bitplane:      'bitplane.js',
  'bitplane-xor':'bitplane-xor.js',
  colormap:      'colormap.js',
  palette:       'palette.js',
  gradient:      'gradient.js',
  noise:         'noise.js',
  frequency:     'frequency.js',
  wavelet:       'wavelet.js',
  histogram:     'histogram.js',
  curves:        'curves.js',
  entropy:       'entropy.js',
  pca:           'pca.js',
  fft:           'fft.js',
  dct:           'dct.js',
  'byte-histogram': 'byte-histogram.js',
  'chi-square':  'chi-square.js',
  clone:         'clone.js',
  strings:       'strings.js',
  'lsb-extract': 'lsb-extract.js',
  metadata:      'metadata.js',
  thumbnail:     'thumbnail.js',
  gps:           'gps.js',
  quantization:  'quantization.js',
  autodetect:    'autodetect.js',
  embedded:      'embedded.js',
  hsv:           'hsv.js',
  lab:           'lab.js',
  ela:           'ela.js',
  'jpeg-ghost': 'jpeg-ghost.js',
};

const moduleCache = new Map(); // filterId → filter object

let _initDone = null;

async function ensureLoaded(filterId) {
  if (moduleCache.has(filterId)) return moduleCache.get(filterId);
  const path = FILTER_FILES[filterId];
  if (!path) throw new Error(`Unknown filter: ${filterId}`);
  const mod = await import(`${BASE_URL}${path}`);
  // Filter is the default export or the named export keyed by id
  const filter = mod.default || mod[filterId] || Object.values(mod).find(v => v && v.id === filterId);
  if (!filter) throw new Error(`Filter ${filterId} not found in module`);
  moduleCache.set(filterId, filter);
  return filter;
}

self.onmessage = async function (e) {
  const { id, filterId, imageData, params, rawFile } = e.data;

  const filter = await ensureLoaded(filterId);

  const imgData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );

  try {
    const result = await filter.apply(imgData, params, null, rawFile);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
