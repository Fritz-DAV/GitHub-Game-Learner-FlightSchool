import { AIRCRAFT } from "./flight-model.mjs";

function tube(stations, x = 0, z = 0, flatten = 1) {
  const rings = stations.map(([along, radius]) => Array.from({ length: 12 }, (_, i) => [
    x + radius * Math.cos(i * Math.PI * 2 / 12), along,
    z + radius * Math.sin(i * Math.PI * 2 / 12) * flatten,
  ]));
  return rings.slice(1).flatMap((b, n) => Array.from({ length: 12 }, (_, i) => [
    [rings[n][i], rings[n][(i + 1) % 12], b[(i + 1) % 12], b[i]],
    i < 6 ? "#eef2f3" : "#a5b4bf",
  ]));
}

const CONCORDE_LENGTH = 61.7;
const CONCORDE_SPAN = 25.6;
const NOSE_HINGE = [24.85, 0];

const disc = (x, y, z, radius, sides = 12) => Array.from({ length: sides }, (_, i) => [
  x + radius * Math.cos(i * Math.PI * 2 / sides), y, z + radius * Math.sin(i * Math.PI * 2 / sides),
]);

// Slender needle-nosed fuselage, ogival delta wing, four underwing Olympus
// engines in pairs and a tall fin with no horizontal tail.
function concordeHull() {
  const half = CONCORDE_LENGTH / 2;
  const blue = "#1d3f7a";
  const surfaces = tube([[-half, 0.25], [-half + 5, 0.85], [-16, 1.3], [0, 1.4],
    [14, 1.3], [NOSE_HINGE[0], 1.05]]);
  const leading = [[1.2, 12], [2.6, 5], [4.6, -3], [7.6, -10], [10.5, -14.5], [CONCORDE_SPAN / 2, -17]];
  const trailing = leading.map(([x]) => [x, -30.5 + (x - 1.2) * 7.5 / (CONCORDE_SPAN / 2 - 1.2)]);
  const wingZ = -0.6;
  for (const side of [-1, 1]) {
    leading.slice(1).forEach(([nx, ny], i) => {
      const [lx, ly] = leading[i];
      const [tx, ty] = trailing[i];
      const [ux, uy] = trailing[i + 1];
      surfaces.push([[[side * lx, ly, wingZ], [side * nx, ny, wingZ],
        [side * ux, uy, wingZ], [side * tx, ty, wingZ]], "#e4eaee"]);
    });
    for (const x of [3.2, 4.6]) {
      surfaces.push(...tube([[-24, 0.5], [-21, 0.62], [3, 0.62], [3.3, 0.55]], side * x, -1.35));
      surfaces.push([disc(side * x, 3.32, -1.35, 0.5), "#24333c"]);
    }
    for (let i = 0; i < 36; i += 1) {
      const along = 21 - i * 1.15;
      const x = side * 1.38;
      surfaces.push([[[x, along, 0.35], [x, along + 0.4, 0.35],
        [x, along + 0.4, 0.7], [x, along, 0.7]], "#284e64"]);
    }
    surfaces.push([[[side * 0.75, 24.6, 0.75], [side * 0.2, 25.5, 0.85],
      [side * 0.2, 25.5, 0.55], [side * 0.75, 24.6, 0.45]], "#25485c"]);
  }
  const fin = [[-14, 1.1], [-25, 7.4], [-29, 7.4], [-30.8, 0.9]];
  for (const side of [-1, 1]) surfaces.push([fin.map(([y, z]) => [side * 0.12, y, z]), blue]);
  fin.slice(1).forEach(([by, bz], i) => {
    const [ay, az] = fin[i];
    surfaces.push([[[-0.12, ay, az], [0.12, ay, az], [0.12, by, bz], [-0.12, by, bz]], blue]);
  });
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
  return tube([[hingeY, 1.05], [28, 0.6], [CONCORDE_LENGTH / 2, 0.06]])
    .map(([points, color]) => [points.map(drop), color]);
}

const hullCache = new Map();
function aircraftHull(aircraft) {
  if (hullCache.has(aircraft)) return hullCache.get(aircraft);
  if (aircraft.supersonic) {
    const concorde = concordeHull();
    hullCache.set(aircraft, concorde);
    return concorde;
  }
  const cessna = aircraft === AIRCRAFT[0];
  const boeing = aircraft === AIRCRAFT[1];
  const length = cessna ? 8.3 : boeing ? 39.5 : 37.6;
  const radius = cessna ? 0.6 : boeing ? 1.88 : 1.98;
  const span = cessna ? 5.5 : 17.9;
  const tail = -length * 0.48 + (cessna ? 0.5 : 1.3);
  const color = cessna ? "#c84538" : boeing ? "#276397" : "#168e9b";
  const surfaces = tube([[tail, 0.12], [-length * 0.26, radius * 0.8],
    [length * 0.27, radius], [length * 0.43, radius * (cessna || boeing ? 0.65 : 0.8)],
    [length * 0.52, cessna || boeing ? 0.06 : 0.22]]);
  for (const side of [-1, 1]) {
    const wingZ = cessna ? 0.65 : -0.5;
    const tipY = cessna ? -0.3 : -6;
    surfaces.push([[[side * radius * 0.6, cessna ? 1.2 : 3.5, wingZ],
      [side * span, tipY, wingZ + 0.3], [side * span, tipY - (cessna ? 1.2 : 1.8), wingZ + 0.3],
      [side * radius, cessna ? -1.3 : -4, wingZ]], "#cbd8e1"]);
    surfaces.push([[[side * 0.2, tail + 1.5, 0.25], [side * (cessna ? 2 : 6.2), tail + (cessna ? 0.2 : -0.7), 0.5],
      [side * (cessna ? 2 : 6.2), tail - (cessna ? 0.5 : 1.3), 0.5], [side * 0.2, tail - 0.5, 0.25]], "#cbd8e1"]);
    if (cessna) {
      surfaces.push([[[side * 0.5, 0, -0.3], [side * 4, -0.4, 0.65],
        [side * 4, -0.5, 0.65], [side * 0.5, -0.1, -0.3]], "#687c88"]);
    } else {
      surfaces.push([[[side * span, tipY, wingZ + 0.3],
        [side * (span + 0.35), tipY - 0.5, boeing ? 2 : 1.7],
        [side * (span + 0.35), tipY - 1.2, 1.8], [side * span, tipY - 1.8, wingZ + 0.3]], color]);
      surfaces.push(...tube([[-2.9, 0.6], [-2.4, 1], [0.8, 1], [1, 0.91]],
        side * 5.4, -1.65, boeing ? 0.8 : 1));
      surfaces.push([Array.from({ length: 12 }, (_, i) => [
        side * 5.4 + 0.82 * Math.cos(i * Math.PI * 2 / 12), 1.02,
        -1.65 + 0.75 * Math.sin(i * Math.PI * 2 / 12),
      ]), "#24333c"]);
    }
    for (let i = 0; i < (cessna ? 3 : 28); i += 1) {
      const along = cessna ? 0.9 - i * 0.6 : length * 0.29 - i * 0.8;
      const x = side * radius * 0.94;
      surfaces.push([[[x, along, 0.2], [x, along + 0.3, 0.2],
        [x, along + 0.3, 0.55], [x, along, 0.55]], "#284e64"]);
    }
    surfaces.push([[[side * radius * 0.85, length * 0.32, radius * 0.48],
      [side * radius * 0.4, length * 0.4, radius * 0.52],
      [side * radius * 0.35, length * 0.34, radius * 0.86],
      [side * radius * 0.75, length * 0.28, radius * 0.8]], "#25485c"]);
  }
  const fin = [[tail - 0.4, 0], [tail - 0.1, cessna ? 2 : 6.5],
    [tail + (cessna ? 1 : 2), cessna ? 2 : 6], [tail + (cessna ? 2 : 5), 0]];
  const thickness = cessna ? 0.04 : 0.12;
  for (const side of [-1, 1]) surfaces.push([fin.map(([y, z]) => [side * thickness, y, z]), color]);
  fin.slice(1).forEach(([by, bz], i) => {
    const [ay, az] = fin[i];
    surfaces.push([[[-thickness, ay, az], [thickness, ay, az],
      [thickness, by, bz], [-thickness, by, bz]], color]);
  });
  hullCache.set(aircraft, surfaces);
  return surfaces;
}

export function aircraftSurfaces(aircraft, gear, time = 0, enginePower = 0) {
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
  const positions = aircraft.supersonic ? [[-5.9, -6], [5.9, -6], [0, 19]]
    : [[cessna ? -1.2 : -2.7, cessna ? -1.1 : -2.5],
      [cessna ? 1.2 : 2.7, cessna ? -1.1 : -2.5], [0, cessna ? 2.5 : 12]];
  for (const [x, y] of positions) {
    const wheelZ = -0.65 + (-datum + radius + 0.65) * gear;
    const wheelX = x * gear;
    surfaces.push([[[wheelX - 0.06, y, -0.5], [wheelX + 0.06, y, -0.5],
      [wheelX + 0.06, y, wheelZ], [wheelX - 0.06, y, wheelZ]], "#bbc5ca"]);
    for (const offset of cessna ? [0] : [-0.28, 0.28]) {
      const rings = [-1, 1].map((side) => Array.from({ length: 10 }, (_, i) => [
        wheelX + offset + side * radius * 0.35,
        y + radius * Math.cos(i * Math.PI * 2 / 10), wheelZ + radius * Math.sin(i * Math.PI * 2 / 10),
      ]));
      surfaces.push(...rings.map((ring) => [ring, "#20272c"]));
      for (let i = 0; i < 10; i += 1) {
        surfaces.push([[rings[0][i], rings[0][(i + 1) % 10],
          rings[1][(i + 1) % 10], rings[1][i]], "#30373b"]);
      }
    }
  }
  return surfaces;
}
