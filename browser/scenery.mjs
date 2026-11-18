import { AIRPORTS, airportPosition, runwayCoordinates } from "./flight-model.mjs";

const fieldColors = ["#718953", "#82935e", "#647e49", "#96976a", "#748654"];
export const THAMES = [[3500, -4000], [6500, -4800], [9500, -3000], [13000, -3300],
  [16000, -1000], [19000, -1700], [21500, 800], [23700, 500], [24800, 2200],
  [25500, 3100], [25900, 5300], [28500, 5800], [31000, 3600], [34000, 4000]];

// Hand-simplified coastlines, not navigation data; pairs are longitude/latitude.
export const COASTS = [
  [[-5.7, 50.05], [-5.05, 50.15], [-4.2, 50.35], [-3.65, 50.22],
    [-3.5, 50.6], [-2.45, 50.6], [-2.0, 50.72], [-1.35, 50.75],
    [-0.8, 50.77], [0.25, 50.74], [0.98, 50.92], [1.3, 51.13],
    [1.42, 51.37], [0.9, 51.36], [0.75, 51.47], [0.95, 51.62],
    [1.25, 51.77], [1.28, 52.0], [1.75, 52.48], [1.65, 52.9],
    [0.95, 52.97], [0.35, 52.8], [0.05, 53.0], [0.3, 53.45],
    [-0.12, 53.6], [0.1, 54.0], [-0.7, 54.55], [-1.3, 54.7],
    [-1.65, 55.55], [-2.1, 55.9], [-3.2, 56.0], [-2.5, 56.5],
    [-1.8, 57.5], [-3.1, 57.7], [-4.0, 57.9], [-3.1, 58.6],
    [-5.0, 58.6], [-5.8, 57.8], [-5.7, 56.7], [-6.2, 56.1],
    [-5.1, 55.3], [-4.8, 54.65], [-3.1, 54.95], [-3.6, 54.52],
    [-3.3, 54.1], [-3.05, 53.8], [-3.1, 53.55],
    [-2.9, 53.35], [-4.5, 53.4], [-4.75, 52.8], [-4.1, 52.55],
    [-4.25, 52.0], [-5.3, 51.9], [-5.05, 51.6], [-4.25, 51.55],
    [-3.1, 51.4], [-2.65, 51.6], [-3.0, 51.2], [-4.25, 51.18],
    [-4.6, 50.75], [-5.1, 50.55]],
  [[-5.1, 48.45], [-4.75, 48.7], [-3.5, 48.85], [-2.7, 48.65],
    [-1.95, 48.55], [-1.85, 49.7], [-1.25, 49.7], [-1.0, 49.4],
    [0.15, 49.35], [0.7, 49.87], [1.5, 50.1], [1.6, 50.85],
    [1.85, 50.96], [2.4, 51.05], [3.4, 51.4], [6, 53], [8, 46], [-5, 46]],
];
export const CITIES = [
  ["London", -0.12, 51.51, 12500], ["Slough", -0.59, 51.51, 2800],
  ["Watford", -0.4, 51.66, 3000], ["Luton", -0.42, 51.88, 3500],
  ["Harlow", 0.1, 51.77, 2800], ["Chelmsford", 0.47, 51.74, 3200],
  ["Cambridge", 0.12, 52.2, 3800], ["Southend", 0.71, 51.54, 3500],
  ["Maidstone", 0.52, 51.27, 2800], ["Canterbury", 1.08, 51.28, 2300],
  ["Dover", 1.31, 51.13, 1800], ["Calais", 1.85, 50.95, 3000],
  ["Amiens", 2.3, 49.89, 4000], ["Paris", 2.35, 48.86, 14000],
];
export const ROADS = [
  ["M25", [[-0.55, 51.43], [-0.57, 51.58], [-0.4, 51.72], [-0.05, 51.72],
    [0.2, 51.66], [0.28, 51.47], [0.18, 51.28], [-0.2, 51.26],
    [-0.49, 51.32], [-0.55, 51.43]]],
  ["M11", [[0.04, 51.59], [0.12, 51.77], [0.19, 51.87], [0.15, 52.08], [0.09, 52.23]]],
  ["M1", [[-0.23, 51.58], [-0.4, 51.73], [-0.45, 51.89], [-0.7, 52.05], [-1.1, 52.3]]],
  ["M4", [[-0.23, 51.49], [-0.46, 51.5], [-0.65, 51.5], [-0.98, 51.45], [-1.8, 51.55]]],
  ["M20", [[0.2, 51.4], [0.51, 51.28], [0.88, 51.15], [1.18, 51.09], [1.31, 51.13]]],
  ["M2", [[0.25, 51.39], [0.59, 51.36], [0.88, 51.3], [1.15, 51.28]]],
  ["A12", [[0.0, 51.58], [0.29, 51.63], [0.47, 51.74], [0.9, 51.9], [1.16, 52.06]]],
  ["A1", [[-0.12, 51.55], [-0.22, 51.77], [-0.2, 52.02], [-0.25, 52.3]]],
  ["A16", [[1.85, 50.95], [1.61, 50.72], [1.68, 50.28], [1.83, 50.1], [2.3, 49.89]]],
  ["A1 France", [[2.93, 50.5], [2.85, 50.0], [2.72, 49.6], [2.6, 49.2], [2.5, 49.03], [2.35, 48.86]]],
];
export const HILLS = [
  [-0.75, 51.73, 260, 14000, 6500], [0.15, 51.27, 240, 16000, 4500],
  [-0.25, 50.9, 270, 21000, 5000], [-4.08, 53.07, 1085, 12000, 10000],
  [-3.95, 50.58, 620, 15000, 13000], [-3.21, 54.45, 978, 14000, 14000],
];
export function geographic(longitude, latitude) {
  return [longitude * Math.PI / 180 * 6371000 * Math.cos(50 * Math.PI / 180),
    (latitude - 50) * Math.PI / 180 * 6371000];
}
const land = COASTS.map((coast) => coast.map((p) => geographic(...p)));
export const LAND_SURFACES = land.map((coast) => [coast.map(([x, y]) => [x, y, -0.1]), "#82936e"]);
const cityPositions = CITIES.map(([, lon, lat, radius]) => [geographic(lon, lat), radius]);
export function inCity(x, y) {
  return cityPositions.some(([[cx, cy], radius]) => ((x - cx) / radius) ** 2
    + ((y - cy) / (radius * 0.65)) ** 2 < 1);
}
export function isLand(x, y) {
  return land.some((coast) => {
    let inside = false;
    coast.forEach(([bx, by], i) => {
      const [ax, ay] = coast[(i + coast.length - 1) % coast.length];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    });
    return inside;
  });
}
const cellSeed = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) & 0x7fffffff;

export function regionalScenery() {
  const ground = [];
  const roads = [];
  const solids = [];
  for (const [name, route] of ROADS) {
    const points = route.map((p) => geographic(...p));
    const motorway = name.startsWith("M") || ["A16", "A1 France"].includes(name);
    roads.push(...ribbon(points, motorway ? 32 : 14, "#666b69"));
    if (motorway) roads.push(...ribbon(points, 3, "#b0b295"));
  }
  for (const [city, lon, lat, radius] of CITIES) {
    const [x, y] = geographic(lon, lat);
    for (let i = 0; i < 32; i += 1) {
      const a = i * Math.PI * 2 / 32;
      const b = (i + 1) * Math.PI * 2 / 32;
      const sector = [[x, y, 0.005],
        [x + radius * Math.cos(a), y + radius * Math.sin(a) * 0.65, 0.005],
        [x + radius * Math.cos(b), y + radius * Math.sin(b) * 0.65, 0.005]];
      if (sector.every(([px, py]) => isLand(px, py) && airportClear(px, py))) ground.push([sector, "#92917f"]);
    }
    for (let i = -4; i <= 4; i += 1) {
      const offset = radius * i / 5;
      const extent = Math.sqrt(radius * radius - offset * offset);
      for (const points of [[[x - extent, y + offset * 0.65], [x + extent, y + offset * 0.65]],
        [[x + offset, y - extent * 0.65], [x + offset, y + extent * 0.65]]]) {
        if (points.every((p) => isLand(...p) && airportClear(...p))) ground.push(...ribbon(points, 12, "#777872"));
      }
    }
    const count = ["London", "Paris"].includes(city) ? 320 : 80;
    for (let i = 0; i < count; i += 1) {
      const seed = cellSeed(i + 1, Math.trunc(lon * 1000));
      const angle = i * 2.399963;
      const distance = radius * Math.sqrt((i + 0.5) / count);
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance * 0.65;
      if (!isLand(px, py) || !airportClear(px, py)) continue;
      const w = 100 + seed % 220;
      const d = 80 + seed % 150;
      const height = 8 + seed % 20 + (["London", "Paris"].includes(city) && i < 10 ? 55 : 0);
      const block = [[px - 260, py - 220, 0.01], [px + 260, py - 220, 0.01],
        [px + 260, py + 220, 0.01], [px - 260, py + 220, 0.01]];
      if (block.every(([a, b]) => isLand(a, b) && airportClear(a, b))) {
        ground.push([block, ["#92917f", "#9d9685", "#888e7b"][i % 3]]);
      }
      ground.push(...ribbon([[px - w, py - d], [px + w, py - d]], 10, "#777872"));
      solids.push(...box(px, py, w, d, height));
      solids.push([[[px - w / 2, py - d / 2, height], [px + w / 2, py - d / 2, height],
        [px + w / 2, py + d / 2, height], [px - w / 2, py + d / 2, height]], "#916d58"]);
    }
  }
  for (const [lon, lat, height, rx, ry] of HILLS) {
    const [x, y] = geographic(lon, lat);
    for (let i = 0; i < 20; i += 1) {
      const a = i * Math.PI * 2 / 20;
      const b = (i + 1) * Math.PI * 2 / 20;
      solids.push([[[x + rx * Math.cos(a), y + ry * Math.sin(a), 0],
        [x + rx * Math.cos(b), y + ry * Math.sin(b), 0], [x + rx * 0.12, y, height]],
      ["#64794f", "#718159", "#7d8964", "#596e49"][i % 4]]);
    }
  }
  return { ground: [...ground, ...roads], solids };
}

export function clipPolygon(points, distance) {
  const result = [];
  points.forEach((current, i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const a = distance(previous);
    const b = distance(current);
    if ((a >= 0) !== (b >= 0)) {
      const ratio = a / (a - b);
      result.push(previous.map((value, axis) => value + ratio * (current[axis] - value)));
    }
    if (b >= 0) result.push(current);
  });
  return result;
}

function box(x, y, width, depth, height, base = 0) {
  const bottom = [[x - width / 2, y - depth / 2, base], [x + width / 2, y - depth / 2, base],
    [x + width / 2, y + depth / 2, base], [x - width / 2, y + depth / 2, base]];
  const top = bottom.map(([a, b]) => [a, b, base + height]);
  const colors = ["#647b86", "#8ba1ac", "#536c78", "#95a7aa"];
  return [[top, "#b8c5c6"], ...bottom.map((point, i) => [
    [point, bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]], colors[i],
  ])];
}

function ribbon(points, width, color) {
  const edges = points.map(([x, y], i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const scale = width / (2 * Math.hypot(dx, dy));
    return [[x - dy * scale, y + dx * scale, 0.02], [x + dy * scale, y - dx * scale, 0.02]];
  });
  return edges.slice(1).map((b, i) => [[edges[i][0], edges[i][1], b[1], b[0]], color]);
}

export function airportClear(x, y) {
  for (const airport of AIRPORTS) {
    const [along, across] = runwayCoordinates(airport, x, y);
    if (Math.abs(along) < airport.runwayLength / 2 + 450 && Math.abs(across) < 1200) return false;
  }
  const [hx, hy] = airportPosition(AIRPORTS[0]);
  for (let i = 1; i < THAMES.length; i += 1) {
    const [ax, ay] = THAMES[i - 1];
    const [bx, by] = THAMES[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - hx - ax) * dx + (y - hy - ay) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(x - hx - ax - t * dx, y - hy - ay - t * dy) < 240) return false;
  }
  return true;
}

let terrainCache = null;

export function terrain(x, y) {
  const cx = Math.floor(x / 800);
  const cy = Math.floor(y / 800);
  if (terrainCache?.cx === cx && terrainCache?.cy === cy) return terrainCache.geometry;
  const ground = [];
  const solids = [];
  for (let ix = cx - 10; ix <= cx + 10; ix += 1) {
    for (let iy = cy - 10; iy <= cy + 10; iy += 1) {
      const seed = cellSeed(ix, iy);
      const px = ix * 800;
      const py = iy * 800;
      if (![[px, py], [px + 800, py], [px + 800, py + 800], [px, py + 800]]
        .every(([a, b]) => isLand(a, b))) continue;
      ground.push([[[px, py, 0], [px + 800, py, 0], [px + 800, py + 800, 0], [px, py + 800, 0]],
        fieldColors[seed % fieldColors.length]]);
      ground.push(...ribbon([[px, py], [px + 800, py]], 5, "#4e6840"),
        ...ribbon([[px, py], [px, py + 800]], 5, "#4e6840"));
      if (Math.abs(ix - cx) > 4 || Math.abs(iy - cy) > 4) continue;
      for (let n = 0; n < 3; n += 1) {
        const tx = px + 60 + (seed + n * 239) % 680;
        const ty = py + 60 + (Math.floor(seed / 97) + n * 317) % 680;
        if (!airportClear(tx, ty) || inCity(tx, ty)) continue;
        const height = 12 + seed % 13;
        solids.push(...box(tx, ty, 2, 2, height * 0.55).map(([points]) => [points, "#71533b"]));
        const corners = [[tx - 9, ty - 9, 5], [tx + 9, ty - 9, 5],
          [tx + 9, ty + 9, 5], [tx - 9, ty + 9, 5]];
        const colors = ["#315d37", "#427344", "#285132", "#527b40"];
        corners.forEach((point, i) => solids.push([[point, corners[(i + 1) % 4], [tx, ty, height]], colors[i]]));
      }
    }
  }
  const geometry = { ground, solids };
  terrainCache = { cx, cy, geometry };
  return geometry;
}

function ribbon3d(a, b, width, color) {
  return [[[[a[0] - width, a[1], a[2]], [b[0] - width, b[1], b[2]],
    [b[0] + width, b[1], b[2]], [a[0] + width, a[1], a[2]]], color]];
}

export function heathrowScenery() {
  const [hx, hy] = airportPosition(AIRPORTS[0]);
  const ground = ribbon(THAMES.map(([x, y]) => [hx + x, hy + y]), 220, "#468b9e");
  const solids = [];
  for (const [dx, dy, w, d] of [[-1250, 650, 400, 180], [150, 500, 500, 150], [1000, -650, 450, 180]]) {
    const x = hx + dx;
    const y = hy + dy;
    ground.push([[[x - w, y - d * 2, 0.03], [x + w, y - d * 2, 0.03],
      [x + w, y + d * 2, 0.03], [x - w, y + d * 2, 0.03]], "#89908a"]);
    ground.push(...ribbon([[x, y], [x, hy]], 28, "#737b7c"));
    solids.push(...box(x, y, w, d, 24));
    for (const offset of [-0.35, 0, 0.35]) solids.push(...box(x + w * offset, y - d * 0.7, 24, 160, 10));
  }
  solids.push(...box(hx + 450, hy + 280, 18, 18, 65), ...box(hx + 450, hy + 280, 40, 35, 12, 65));
  // Approximate central London, about 25 km east of Heathrow.
  const ex = hx + 25400;
  const ey = hy + 2900;
  const ring = (angle, radius) => [ex + radius * Math.cos(angle) * 0.35,
    ey + radius * Math.cos(angle) * 0.94, 70 + radius * Math.sin(angle)];
  for (let i = 0; i < 32; i += 1) {
    const a = i * Math.PI * 2 / 32;
    const b = (i + 1) * Math.PI * 2 / 32;
    solids.push([[ring(a, 65), ring(b, 65), ring(b, 61), ring(a, 61)], "#e4e6df"]);
    solids.push(...ribbon3d([ex, ey, 70], ring(a, 62), 0.7, "#bfcdd0"));
    if (i % 2 === 0) {
      const [px, py, pz] = ring(a, 65);
      solids.push(...box(px, py, 6, 8, 4, pz - 2));
    }
  }
  for (const dx of [-30, 30]) solids.push(...ribbon3d([ex + dx, ey - 15, 0], [ex, ey, 70], 3, "#e4e6df"));
  solids.push(...box(ex - 450, ey - 250, 140, 70, 25), ...box(ex - 440, ey - 250, 18, 18, 96));
  for (const [x, y] of [[23700, 500], [25500, 3100], [28500, 5800]]) solids.push(...box(hx + x, hy + y, 350, 22, 10));
  return { ground, solids };
}
