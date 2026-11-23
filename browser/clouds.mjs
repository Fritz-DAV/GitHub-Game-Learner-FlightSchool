// Deterministic, drifting cloud cover built from low-poly shaded blobs.
const SHADES = 8;
const LIGHT = (() => {
  const v = [0.35, -0.3, 0.88];
  const length = Math.hypot(...v);
  return v.map((value) => value / length);
})();
const channels = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t));
// Palette per distance band (near, mid, far) fading into the horizon haze, per light level.
const PALETTE = [0, 0.35, 0.65].map((haze) => Array.from({ length: SHADES }, (_, shade) => {
  const lit = mix(channels("#98a6b7"), channels("#ffffff"), shade / (SHADES - 1));
  return `rgb(${mix(lit, channels("#dce6e3"), haze).join(",")})`;
}));

function hash(x, y, k = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, k) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const smooth = (t) => t * t * (3 - 2 * t);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const top = hash(ix, iy, k) * (1 - fx) + hash(ix + 1, iy, k) * fx;
  const bottom = hash(ix, iy + 1, k) * (1 - fx) + hash(ix + 1, iy + 1, k) * fx;
  return top * (1 - fy) + bottom * fy;
}

// Cloud pattern in the drifting frame; world position = frame position + drift.
export function coverInFrame(u, v) {
  const a = u / 50000;
  const b = v / 50000;
  return 0.6 * valueNoise(a, b, 1) + 0.3 * valueNoise(a * 2.3, b * 2.3, 2) + 0.1 * valueNoise(a * 5, b * 5, 3);
}
export function cloudCover(x, y, drift) {
  return coverInFrame(x - drift[0], y - drift[1]);
}
// Clouds move with the upper wind, faster than the surface wind.
export function cloudDrift(flight) {
  const direction = flight.windFrom * Math.PI / 180;
  const speed = 6 + 2 * flight.windSpeed;
  return [-Math.sin(direction) * speed * flight.time, -Math.cos(direction) * speed * flight.time];
}

const t = (1 + Math.sqrt(5)) / 2;
const ICO_POINTS = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
  [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
  .map((p) => p.map((value) => value / Math.hypot(1, t)));
const ICO_FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
  [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];

function blob(cx, cy, cz, rx, ry, rz, seed) {
  const vertices = ICO_POINTS.map((p, i) => {
    const wobble = 0.88 + 0.24 * hash(seed, i, 9);
    return [cx + p[0] * rx * wobble, cy + p[1] * ry * wobble, cz + p[2] * rz * wobble];
  });
  return ICO_FACES.map((face) => {
    const [a, b, c] = face.map((i) => vertices[i]);
    const u = b.map((value, i) => value - a[i]);
    const v = c.map((value, i) => value - a[i]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal) || 1;
    const centre = [(cx), (cy), (cz)];
    const middle = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3);
    const sign = Math.sign(normal.reduce((sum, value, i) => sum + value * (middle[i] - centre[i]), 0)) || 1;
    const n = normal.map((value) => value * sign / length);
    const light = Math.max(0, Math.min(1, n.reduce((sum, value, i) => sum + value * LIGHT[i], 0) * 0.5 + 0.5));
    return { points: [a, b, c], normal: n, middle, shade: Math.round(light * (SHADES - 1)) };
  });
}

// Each template is a list of blobs so distant clouds can draw fewer of them.
function cumulusTemplate(seed) {
  const count = 5 + Math.floor(hash(seed, 1, 4) * 4);
  return Array.from({ length: count }, (_, i) => {
    const spread = i / count;
    const radius = 650 + 600 * hash(seed, i, 5);
    const x = (hash(seed, i, 6) - 0.5) * 2600;
    const y = (hash(seed, i, 7) - 0.5) * 1400;
    const z = radius * 0.45 + 500 * (1 - Math.abs(x) / 1500) * hash(seed, i, 8) + spread * 250;
    return blob(x, y, z, radius * 1.15, radius, radius * 0.8, seed * 31 + i);
  });
}
function deckTemplate(seed) {
  return Array.from({ length: 3 }, (_, i) => blob((hash(seed, i, 6) - 0.5) * 5000,
    (hash(seed, i, 7) - 0.5) * 3500, 0, 3200 + 1800 * hash(seed, i, 5), 2800 + 1400 * hash(seed, i, 4),
    220 + 120 * hash(seed, i, 3), seed * 17 + i));
}
const CUMULUS = Array.from({ length: 24 }, (_, i) => cumulusTemplate(i + 1));
const DECK = Array.from({ length: 8 }, (_, i) => deckTemplate(i + 40));
const LAYERS = [
  { size: 7000, threshold: 0.47, density: 0.85, base: [1300, 2600], scale: [0.8, 1.5], templates: CUMULUS, key: 11, radius: 45000 },
  { size: 9000, threshold: 0.56, density: 0.95, base: [3800, 4600], scale: [0.9, 1.4], templates: DECK, key: 23, radius: 55000 },
];

// Camera-facing triangles of every cloud near `eye`, as [points, colour] surfaces.
export function cloudSurfaces(eye, drift) {
  const surfaces = [];
  for (const layer of LAYERS) {
    const { size, threshold, density, base, scale, templates, key, radius } = layer;
    const fx = eye[0] - drift[0];
    const fy = eye[1] - drift[1];
    for (let i = Math.floor((fx - radius) / size); i <= Math.floor((fx + radius) / size); i += 1) {
      for (let j = Math.floor((fy - radius) / size); j <= Math.floor((fy + radius) / size); j += 1) {
        const u = (i + 0.15 + 0.7 * hash(i, j, key)) * size;
        const v = (j + 0.15 + 0.7 * hash(i, j, key + 1)) * size;
        if (coverInFrame(u, v) < threshold || hash(i, j, key + 2) > density) continue;
        const wx = u + drift[0];
        const wy = v + drift[1];
        const distance = Math.hypot(wx - eye[0], wy - eye[1]);
        if (distance > radius) continue;
        const wz = base[0] + (base[1] - base[0]) * hash(i, j, key + 3);
        const size3 = scale[0] + (scale[1] - scale[0]) * hash(i, j, key + 4);
        const mirror = hash(i, j, key + 5) < 0.5 ? -1 : 1;
        const template = templates[Math.floor(hash(i, j, key + 6) * templates.length)];
        const band = distance < 18000 ? 0 : distance < 32000 ? 1 : 2;
        for (const faces of band === 2 ? template.slice(0, 3) : template) {
          for (const face of faces) {
            const centre = [wx + mirror * size3 * face.middle[0], wy + size3 * face.middle[1],
              wz + size3 * face.middle[2]];
            const facing = (eye[0] - centre[0]) * mirror * face.normal[0]
              + (eye[1] - centre[1]) * face.normal[1] + (eye[2] - centre[2]) * face.normal[2];
            if (facing <= 0) continue;
            surfaces.push([face.points.map(([x, y, z]) => [wx + mirror * size3 * x, wy + size3 * y,
              wz + size3 * z]), PALETTE[band][face.shade]]);
          }
        }
      }
    }
  }
  return surfaces;
}
