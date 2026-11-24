import { AIRCRAFT } from "./flight-model.mjs";

function tube(stations, x = 0, z = 0, flatten = 1, sides = 12) {
  const rings = stations.map(([along, radius]) => Array.from({ length: sides }, (_, i) => [
    x + radius * Math.cos(i * Math.PI * 2 / sides), along,
    z + radius * Math.sin(i * Math.PI * 2 / sides) * flatten,
  ]));
  return rings.slice(1).flatMap((b, n) => Array.from({ length: sides }, (_, i) => [
    [rings[n][i], rings[n][(i + 1) % sides], b[(i + 1) % sides], b[i]],
    i < sides / 2 ? "#eef2f3" : "#a5b4bf",
  ]));
}

const CONCORDE_LENGTH = 61.7;
const CONCORDE_SPAN = 25.6;
const NOSE_HINGE = [24.85, 0];

// Airliner fuselages are rings with a vertex every ~25 degrees (measured up from
// the right-hand horizontal). Sectors 0 and 7 are the cabin-window bands and
// sectors 1-6 can carry cockpit glazing, so windows replace hull panels instead
// of floating over them (which the painter's-order depth sort cannot handle).
const RING = [5, 15, 40, 65, 90, 115, 140, 165, 175, 200, 230, 260, 280, 310, 340];
const WINDOW_SECTORS = [0, 7];
const HULL_TOP = "#eef2f3";
const HULL_BELLY = "#a5b4bf";
const CABIN_WINDOW = "#284e64";
const WINDOW_FRAME = "#e3e9ec";
const GLASS = "#14232d";
const DOOR = "#b4c0c7";
const rad = (degrees) => degrees * Math.PI / 180;

const disc = (x, y, z, radius, sides = 12, flatten = 1) => Array.from({ length: sides }, (_, i) => [
  x + radius * Math.cos(i * Math.PI * 2 / sides), y,
  z + radius * Math.sin(i * Math.PI * 2 / sides) * flatten,
]);

function profileAt(profile, y) {
  for (let i = 0; i + 1 < profile.length; i += 1) {
    const [y0, r0, z0] = profile[i];
    const [y1, r1, z1] = profile[i + 1];
    if (y0 <= y && y <= y1) {
      const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
      return [y, r0 + (r1 - r0) * t, z0 + (z1 - z0) * t];
    }
  }
  return y < profile[0][0] ? profile[0] : profile[profile.length - 1];
}

// Add stations at the glazing limits and keep every hull panel short.
function refine(profile, stops, step = 4) {
  const ys = [...new Set([...profile.map((row) => row[0]), ...stops])].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i + 1 < ys.length; i += 1) {
    const [lo, hi] = [ys[i], ys[i + 1]];
    const pieces = Math.max(1, Math.ceil((hi - lo) / step - 1e-9));
    for (let k = 0; k < pieces; k += 1) result.push(profileAt(profile, lo + (hi - lo) * k / pieces));
  }
  result.push(profileAt(profile, ys[ys.length - 1]));
  return result;
}

const ringPoints = ([y, radius, z]) => RING.map((a) => [
  radius * Math.cos(rad(a)), y, z + radius * Math.sin(rad(a)),
]);
const lerp = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

// Cut one hull sector into alternating cabin windows, frames and doors.
function windowBand(a0, a1, b0, b1, y0, y1, color, cabin, doors) {
  const cuts = new Set([y0, y1]);
  if (cabin) {
    const [front, back, pitch, length] = cabin;
    for (let k = 0; front - k * pitch > back; k += 1) {
      cuts.add(front - k * pitch);
      cuts.add(front - k * pitch - length);
    }
  }
  for (const [low, high] of doors) {
    cuts.add(low);
    cuts.add(high);
  }
  const ys = [...cuts].filter((y) => y >= y0 - 1e-9 && y <= y1 + 1e-9).sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i + 1 < ys.length; i += 1) {
    const [lo, hi] = [ys[i], ys[i + 1]];
    if (hi - lo < 1e-6) continue;
    const mid = (lo + hi) / 2;
    let piece = color;
    if (doors.some(([low, high]) => low <= mid && mid <= high)) piece = DOOR;
    else if (cabin && cabin[1] <= mid && mid <= cabin[0]) {
      piece = (cabin[0] - mid) % cabin[2] < cabin[3] ? CABIN_WINDOW : WINDOW_FRAME;
    }
    const t0 = (lo - y0) / (y1 - y0);
    const t1 = (hi - y0) / (y1 - y0);
    pieces.push([[lerp(a0, b0, t0), lerp(a1, b1, t0), lerp(a1, b1, t1), lerp(a0, b0, t1)], piece]);
  }
  return pieces;
}

// Revolved airliner hull. `glass` is [[sectors, yLow, yHigh], ...]; `cabin` is
// [frontY, backY, pitch, windowLength]; `doors` is [[yLow, yHigh], ...].
function fuselage(profile, { glass = [], cabin = null, doors = [], caps = [true, true] } = {}) {
  const rows = refine(profile, glass.flatMap(([, low, high]) => [low, high]));
  const rings = rows.map(ringPoints);
  const n = RING.length;
  const surfaces = [];
  for (let r = 0; r + 1 < rows.length; r += 1) {
    const [y0, y1] = [rows[r][0], rows[r + 1][0]];
    const [a, b] = [rings[r], rings[r + 1]];
    const middle = (y0 + y1) / 2;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const midAngle = (RING[i] + RING[j] + (j === 0 ? 360 : 0)) / 2;
      let color = Math.sin(rad(midAngle)) > 0 ? HULL_TOP : HULL_BELLY;
      if (glass.some(([sectors, low, high]) => sectors.includes(i)
        && low - 1e-6 <= middle && middle <= high + 1e-6)) color = GLASS;
      if (WINDOW_SECTORS.includes(i) && (cabin || doors.length)) {
        surfaces.push(...windowBand(a[i], a[j], b[i], b[j], y0, y1, color, cabin, doors));
      } else {
        surfaces.push([[a[i], a[j], b[j], b[i]], color]);
      }
    }
  }
  if (caps[0]) surfaces.push([rings[0], HULL_TOP]);
  if (caps[1]) surfaces.push([rings[rings.length - 1], HULL_TOP]);
  return surfaces;
}

// Swept wing from [across, leadingY, trailingY] stations with dihedral; the
// trailing edge is split off as a flap/aileron strip.
function wing(side, stations, rootZ, slope, flap = 0.24) {
  const at = ([x, leading, trailing], fraction) => [
    side * x, trailing + (leading - trailing) * fraction, rootZ + (x - stations[0][0]) * slope,
  ];
  const cut = 1 - flap;
  return [
    [[...stations.map((s) => at(s, 1)), ...[...stations].reverse().map((s) => at(s, cut))], "#cbd8e1"],
    [[...stations.map((s) => at(s, cut)), ...[...stations].reverse().map((s) => at(s, 0))], "#b3c1cb"],
  ];
}

function fin(points, thickness, color) {
  const surfaces = [-1, 1].map((side) => [points.map(([y, z]) => [side * thickness, y, z]), color]);
  points.slice(1).forEach(([by, bz], i) => {
    const [ay, az] = points[i];
    surfaces.push([[[-thickness, ay, az], [thickness, ay, az], [thickness, by, bz], [-thickness, by, bz]], color]);
  });
  return surfaces;
}

const slab = (side, points, color) => [points.map(([x, y, z]) => [side * x, y, z]), color];

// Slender needle-nosed fuselage, ogival delta wing with elevons, four underwing
// Olympus engines in pairs and a tall fin with no horizontal tail.
function concordeHull() {
  const half = CONCORDE_LENGTH / 2;
  const blue = "#1d3f7a";
  const profile = [[-half, 0.22, 0.25], [-half + 5, 0.85, 0.1], [-16, 1.3, 0], [0, 1.4, 0],
    [14, 1.3, 0], [NOSE_HINGE[0], 1.05, 0]];
  const surfaces = fuselage(profile, {
    glass: [[[1, 6], 22.4, NOSE_HINGE[0]], [[3, 4], 23.9, NOSE_HINGE[0]]],
    cabin: [20.5, -20.5, 0.86, 0.22], doors: [[18.4, 19.5], [-23.2, -22.1]], caps: [true, false],
  });
  const leading = [[1.2, 12], [2.6, 5], [4.6, -3], [7.6, -10], [10.5, -14.5], [CONCORDE_SPAN / 2, -17]];
  const trailing = leading.map(([x]) => [x, -30.5 + (x - 1.2) * 7.5 / (CONCORDE_SPAN / 2 - 1.2)]);
  const wingZ = -0.6;
  for (const side of [-1, 1]) {
    leading.slice(1).forEach(([nx, ny], i) => {
      const [lx, ly] = leading[i];
      const [tx, ty] = trailing[i];
      const [ux, uy] = trailing[i + 1];
      // The outer 14 percent of the chord is the elevon.
      const [mx, my] = [tx + 0.14 * (lx - tx), ty + 0.14 * (ly - ty)];
      const [ox, oy] = [ux + 0.14 * (nx - ux), uy + 0.14 * (ny - uy)];
      surfaces.push([[[side * lx, ly, wingZ], [side * nx, ny, wingZ],
        [side * ox, oy, wingZ], [side * mx, my, wingZ]], "#e4eaee"]);
      surfaces.push([[[side * mx, my, wingZ], [side * ox, oy, wingZ],
        [side * ux, uy, wingZ], [side * tx, ty, wingZ]], "#c3ced6"]);
    });
    for (const x of [3.2, 4.6]) {
      surfaces.push(...tube([[-24, 0.5], [-21, 0.62], [3, 0.62], [3.3, 0.55]], side * x, -1.35, 1, 8));
      surfaces.push([disc(side * x, 3.32, -1.35, 0.5, 8), "#24333c"]);
    }
  }
  surfaces.push(...fin([[-14.5, 1.1], [-24.2, 8.3], [-28.4, 8.3], [-30.5, 0.9]], 0.12, blue));
  return surfaces;
}

// Needle nose that droops 5 degrees with the gear down for visibility.
function concordeNose(gear) {
  const droop = 5 * Math.PI / 180 * gear;
  const [hingeY, hingeZ] = NOSE_HINGE;
  const cos = Math.cos(droop);
  const sin = Math.sin(droop);
  const drop = ([x, y, z]) => {
    const dy = y - hingeY;
    const dz = z - hingeZ;
    return [x, hingeY + dy * cos + dz * sin, hingeZ - dy * sin + dz * cos];
  };
  return fuselage([[hingeY, 1.05, 0], [28, 0.6, 0], [CONCORDE_LENGTH / 2, 0.06, 0]],
    { caps: [false, true] }).map(([points, color]) => [points.map(drop), color]);
}

// Airliner dimensions (metres); fuselage rows are [along, radius, axis height].
const AIRLINERS = {
  boeing: {
    color: "#276397",
    profile: [[-19.75, 0.15, 1.55], [-18.5, 0.45, 1.3], [-16.5, 0.9, 0.95], [-14, 1.45, 0.45],
      [-11.5, 1.8, 0.1], [-9, 1.88, 0], [11, 1.88, 0], [13.2, 1.84, -0.02], [15.2, 1.7, -0.1],
      [17, 1.45, -0.22], [18.3, 1.05, -0.35], [19.2, 0.62, -0.45], [19.75, 0.28, -0.5]],
    glass: [[[3, 4], 17, 18.2], [[2, 5], 16.2, 17], [[1, 6], 15.4, 16.2]],
    cabin: [13.2, -11.6, 0.52, 0.3], doors: [[13.5, 14.5], [-12.7, -11.7]],
    wing: [[1.7, 3.6, -2.5], [5.5, 2, -3], [17.15, -3.6, -5.1]], wingZ: -1.25, slope: 0.104,
    winglet: [0.75, 2.4, -5.1, -6],
    engine: [5, -1.95, 0.92, 0.85, 3.9],
    fin: [[-9.2, 1.6], [-14.9, 9], [-17.3, 9], [-17.6, 1.3]],
    stabiliser: [7.1, [[-13.6, 1.1], [-17.2, 1.9], [-18.6, 1.9], [-17.4, 1.1]]],
    gear: [-1.3, 14],
  },
  airbus: {
    color: "#168e9b",
    profile: [[-18.785, 0.18, 1.5], [-17.6, 0.5, 1.25], [-15.6, 0.95, 0.9], [-13.2, 1.5, 0.4],
      [-10.8, 1.88, 0.08], [-8.5, 1.975, 0], [10.6, 1.975, 0], [12.8, 1.93, -0.04],
      [14.8, 1.8, -0.12], [16.4, 1.55, -0.26], [17.6, 1.15, -0.4], [18.3, 0.78, -0.5],
      [18.785, 0.4, -0.56]],
    glass: [[[3, 4], 16.4, 17.7], [[2, 5], 15.7, 16.4], [[1, 6], 15, 15.7]],
    cabin: [12.6, -10.8, 0.52, 0.32], doors: [[13, 14], [-12, -11]],
    wing: [[1.7, 3.3, -2.4], [5.6, 1.7, -2.9], [17.35, -3.5, -5]], wingZ: -1.35, slope: 0.092,
    winglet: [0.55, 2.4, -4.9, -5.9],
    engine: [5.75, -1.95, 0.98, 1, 3.6],
    fin: [[-9, 1.6], [-13.7, 8.6], [-16.3, 8.6], [-16.8, 1.3]],
    stabiliser: [6.2, [[-12.6, 1.1], [-16, 1.8], [-17.4, 1.8], [-16.4, 1.1]]],
    gear: [-1.3, 13.5],
  },
};

const airlinerSpec = (aircraft) => AIRLINERS[aircraft === AIRCRAFT[1] ? "boeing" : "airbus"];

function airlinerHull(spec) {
  const surfaces = fuselage(spec.profile, { glass: spec.glass, cabin: spec.cabin, doors: spec.doors });
  const [engineX, engineZ, engineR, flat, inlet] = spec.engine;
  const tip = spec.wing[spec.wing.length - 1];
  const [dx, dz, topLeading, topTrailing] = spec.winglet;
  const tipZ = spec.wingZ + (tip[0] - spec.wing[0][0]) * spec.slope;
  for (const side of [-1, 1]) {
    surfaces.push(...wing(side, spec.wing, spec.wingZ, spec.slope));
    // Blended winglet / sharklet rising from the wingtip.
    surfaces.push(slab(side, [[tip[0], tip[1], tipZ], [tip[0], tip[2], tipZ],
      [tip[0] + dx, topTrailing, tipZ + dz], [tip[0] + dx, topLeading, tipZ + dz]], spec.color));
    const nacelle = [[inlet, engineR * 0.93], [inlet - 0.3, engineR], [inlet - 1.3, engineR * 1.03],
      [inlet - 2.7, engineR * 0.85], [inlet - 3.4, engineR * 0.6], [inlet - 4.2, engineR * 0.42],
      [inlet - 4.9, engineR * 0.14]];
    surfaces.push(...tube(nacelle, side * engineX, engineZ, flat, 16));
    surfaces.push([disc(side * engineX, inlet + 0.01, engineZ, engineR * 0.82, 16, flat), "#24333c"]);
    surfaces.push([disc(side * engineX, inlet + 0.02, engineZ, engineR * 0.22, 16, flat), "#aab6bd"]);
    const wingZ = spec.wingZ + (engineX - spec.wing[0][0]) * spec.slope;
    surfaces.push(slab(side, [[engineX, inlet - 1.2, wingZ - 0.05], [engineX, inlet - 4.4, wingZ - 0.05],
      [engineX, inlet - 3.8, engineZ + engineR * flat * 0.7],
      [engineX, inlet - 0.6, engineZ + engineR * flat * 0.7]], "#9fb0ba"));
  }
  const [span, stab] = spec.stabiliser;
  for (const side of [-1, 1]) {
    surfaces.push(slab(side, [[0.4, stab[0][0], stab[0][1]], [span, stab[1][0], stab[1][1]],
      [span, stab[2][0], stab[1][1]], [0.4, stab[3][0], stab[0][1]]], "#cbd8e1"));
  }
  surfaces.push(...fin(spec.fin, 0.12, spec.color));
  return surfaces;
}

function cessnaHull() {
  const length = 8.3;
  const radius = 0.6;
  const span = 5.5;
  const tail = -length * 0.48 + 0.5;
  const color = "#c84538";
  const surfaces = tube([[tail, 0.12], [-length * 0.26, radius * 0.8],
    [length * 0.27, radius], [length * 0.43, radius * 0.65], [length * 0.52, 0.06]]);
  for (const side of [-1, 1]) {
    const wingZ = 0.65;
    const tipY = -0.3;
    surfaces.push([[[side * radius * 0.6, 1.2, wingZ],
      [side * span, tipY, wingZ + 0.3], [side * span, tipY - 1.2, wingZ + 0.3],
      [side * radius, -1.3, wingZ]], "#cbd8e1"]);
    surfaces.push([[[side * 0.2, tail + 1.5, 0.25], [side * 2, tail + 0.2, 0.5],
      [side * 2, tail - 0.5, 0.5], [side * 0.2, tail - 0.5, 0.25]], "#cbd8e1"]);
    surfaces.push([[[side * 0.5, 0, -0.3], [side * 4, -0.4, 0.65],
      [side * 4, -0.5, 0.65], [side * 0.5, -0.1, -0.3]], "#687c88"]);
    for (let i = 0; i < 3; i += 1) {
      const along = 0.9 - i * 0.6;
      const x = side * radius * 0.94;
      surfaces.push([[[x, along, 0.2], [x, along + 0.3, 0.2],
        [x, along + 0.3, 0.55], [x, along, 0.55]], "#284e64"]);
    }
    surfaces.push([[[side * radius * 0.85, length * 0.32, radius * 0.48],
      [side * radius * 0.4, length * 0.4, radius * 0.52],
      [side * radius * 0.35, length * 0.34, radius * 0.86],
      [side * radius * 0.75, length * 0.28, radius * 0.8]], "#25485c"]);
  }
  surfaces.push(...fin([[tail - 0.4, 0], [tail - 0.1, 2], [tail + 1, 2], [tail + 2, 0]], 0.04, color));
  return surfaces;
}

const hullCache = new Map();
function aircraftHull(aircraft) {
  if (hullCache.has(aircraft)) return hullCache.get(aircraft);
  const hull = aircraft.supersonic ? concordeHull()
    : aircraft === AIRCRAFT[0] ? cessnaHull() : airlinerHull(airlinerSpec(aircraft));
  hullCache.set(aircraft, hull);
  return hull;
}

// A sheared strut stub with its wheel lying flat on the ground beside it.
function brokenLeg(x, y, ground, radius, cessna) {
  const side = x >= 0 ? 1 : -1;
  const reach = cessna ? 0.6 : 1.6;
  const wx = x + side * reach;
  const wy = y + radius * 1.6;
  const disc = [0, 0.25 * radius].map((lift) => Array.from({ length: 10 }, (_, i) => [
    wx + radius * Math.cos(i * Math.PI * 2 / 10), wy + radius * Math.sin(i * Math.PI * 2 / 10),
    ground + 0.06 + lift,
  ]));
  return [
    [[[x - 0.06, y, -0.5], [x + 0.06, y, -0.5],
      [x + side * 0.4 + 0.06, y, -0.95], [x + side * 0.4 - 0.06, y, -0.95]], "#bbc5ca"],
    ...disc.map((ring) => [ring, "#20272c"]),
    ...Array.from({ length: 10 }, (_, i) => [[disc[0][i], disc[0][(i + 1) % 10],
      disc[1][(i + 1) % 10], disc[1][i]], "#30373b"]),
  ];
}

export function aircraftSurfaces(aircraft, gear, time = 0, enginePower = 0, damage = []) {
  const surfaces = [...aircraftHull(aircraft)];
  const cessna = aircraft === AIRCRAFT[0];
  const datum = aircraft.datum;
  if (aircraft.supersonic) surfaces.push(...concordeNose(gear));
  if (cessna) {
    const angle = time * (8 + enginePower * 90);
    const dx = 1.05 * Math.cos(angle);
    const dz = 1.05 * Math.sin(angle);
    surfaces.push([[[-dx, 4.35, -dz], [dx, 4.35, dz],
      [dx + 0.06, 4.35, dz + 0.06], [-dx + 0.06, 4.35, -dz + 0.06]], "#34434c"]);
    gear = 1;
  }
  if (gear <= 0.01) return surfaces;
  const radius = cessna ? 0.28 : aircraft.supersonic ? 0.6 : 0.55;
  let positions;
  if (aircraft.supersonic) positions = [[-5.9, -6], [5.9, -6], [0, 19]];
  else if (cessna) positions = [[-1.2, -1.1], [1.2, -1.1], [0, 2.5]];
  else {
    const [main, nose] = airlinerSpec(aircraft).gear;
    positions = [[-2.7, main], [2.7, main], [0, nose]];
  }
  const mainBroken = damage.includes("gear") || damage.includes("terrain");
  const flat = damage.includes("tyres");
  for (const [index, [x, y]] of positions.entries()) {
    if ((mainBroken && index < 2) || (damage.includes("nose_gear") && index === 2)) {
      surfaces.push(...brokenLeg(x, y, -datum, radius, cessna));
      continue;
    }
    const tyre = radius * (flat ? 0.55 : 1);
    const wheelZ = -0.65 + (-datum + tyre + 0.65) * gear;
    const wheelX = x * gear;
    surfaces.push([[[wheelX - 0.06, y, -0.5], [wheelX + 0.06, y, -0.5],
      [wheelX + 0.06, y, wheelZ], [wheelX - 0.06, y, wheelZ]], "#bbc5ca"]);
    for (const offset of cessna ? [0] : [-0.28, 0.28]) {
      // Burst tyres sag and spread, with a dark red scorched sidewall.
      const halfWidth = radius * (flat ? 0.55 : 0.35);
      const rings = [-1, 1].map((side) => Array.from({ length: 10 }, (_, i) => [
        wheelX + offset + side * halfWidth,
        y + tyre * Math.cos(i * Math.PI * 2 / 10), wheelZ + tyre * Math.sin(i * Math.PI * 2 / 10),
      ]));
      surfaces.push(...rings.map((ring) => [ring, "#20272c"]));
      for (let i = 0; i < 10; i += 1) {
        surfaces.push([[rings[0][i], rings[0][(i + 1) % 10],
          rings[1][(i + 1) % 10], rings[1][i]], flat ? "#7a2f2f" : "#30373b"]);
      }
    }
  }
  return surfaces;
}

// Navigation, tail and strobe lights as [point, colour, metres] in aircraft coordinates.
export function aircraftLights(aircraft, time = 0) {
  let wingtip;
  let tail;
  if (aircraft === AIRCRAFT[0]) {
    wingtip = [5.5, -0.5, 0.95];
    tail = [0, -3.4, 2];
  } else if (aircraft.supersonic) {
    wingtip = [CONCORDE_SPAN / 2, -20, -0.6];
    tail = [0, -29, 8.3];
  } else {
    const spec = airlinerSpec(aircraft);
    const tip = spec.wing[spec.wing.length - 1];
    const [dx, dz, , topTrailing] = spec.winglet;
    wingtip = [tip[0] + dx, topTrailing + 0.3,
      spec.wingZ + (tip[0] - spec.wing[0][0]) * spec.slope + dz];
    tail = [0, spec.fin[2][0], spec.fin[2][1] - 0.2];
  }
  const strobe = time % 1.3 < 0.12 ? "#ffffff" : null;
  return [
    [[-wingtip[0], wingtip[1], wingtip[2]], "#ff3b30", 0.7],
    [[wingtip[0], wingtip[1], wingtip[2]], "#3ddc84", 0.7],
    [tail, "#ffffff", 0.6],
    ...(strobe ? [[[-wingtip[0], wingtip[1], wingtip[2]], strobe, 2.2],
      [[wingtip[0], wingtip[1], wingtip[2]], strobe, 2.2], [tail, strobe, 2.2]] : []),
  ];
}
