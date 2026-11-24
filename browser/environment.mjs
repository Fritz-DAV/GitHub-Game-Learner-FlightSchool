import { AIRPORTS, airportPosition, allRunways } from "./flight-model.mjs";
import { CITY_OUTLINES, ROADS, airportClear, geographic, inCity, isLand } from "./scenery.mjs";

export const FOG_CHANCE = 0.2; // share of "random" flights that start in fog
export const NIGHT_CHANCE = 0.35; // share of "random" flights that start at night

// "clear" | "foggy" | "random" -> true when the flight is foggy.
export function resolveFog(choice, random = Math.random) {
  return choice === "foggy" || (choice === "random" && random() < FOG_CHANCE);
}
// "day" | "night" | "random" -> true when the flight is at night.
export function resolveNight(choice, random = Math.random) {
  return choice === "night" || (choice === "random" && random() < NIGHT_CHANCE);
}

const SKY = {
  day: [[0, "#5f9fcf"], [0.55, "#a5cde6"], [1, "#c3dcec"]],
  foggyDay: [[0, "#9fb3c2"], [0.55, "#c9d3d8"], [1, "#e0e6e6"]],
  night: [[0, "#02040a"], [0.55, "#0a1424"], [1, "#18283d"]],
  foggyNight: [[0, "#0b1018"], [0.55, "#1a222d"], [1, "#2a3442"]],
};
export function skyStops({ foggy, night }) {
  return SKY[`${foggy ? "foggy" : ""}${night ? (foggy ? "Night" : "night") : (foggy ? "Day" : "day")}`];
}

// Fog is the only thing that blends the distance into the sky.
export function hazeSettings({ foggy, night }) {
  if (!foggy) return null;
  return { rgb: night ? "30,40,55" : "224,233,221", alpha: 0.92, up: 0.16, down: 0.5, veil: 0.2 };
}

const channels = (color) => {
  if (color.startsWith("rgb")) return color.match(/\d+/g).slice(0, 3).map(Number);
  let hex = color.slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
};
// Built-up areas glow a dim warm orange under their street lamps.
const URBAN = new Map([["#8b9172", "#4a3d2a"], ["#92917f", "#574630"], ["#9a9886", "#68502f"],
  ["#9d9685", "#574630"], ["#888e7b", "#4a3d2a"], ["#777872", "#3a3126"]]);
const nightCache = new Map();
export function nightColor(color) {
  if (nightCache.has(color)) return nightCache.get(color);
  let result = color;
  if (/^(#|rgb)/.test(color)) {
    const [r, g, b] = channels(URBAN.get(color) ?? color);
    const dim = URBAN.has(color) ? [1, 1, 1] : [0.15, 0.19, 0.3];
    result = `rgb(${[r * dim[0] + 2, g * dim[1] + 4, b * dim[2] + 9].map(Math.round).join(",")})`;
  }
  nightCache.set(color, result);
  return result;
}

// Deterministic stars as unit directions above the horizon.
export const STARS = Array.from({ length: 180 }, (_, i) => {
  const a = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const b = (Math.sin(i * 78.233 + 1.7) * 24634.6345) % 1;
  const c = (Math.sin(i * 39.346 + 4.1) * 51417.3171) % 1;
  const azimuth = Math.abs(a) * Math.PI * 2;
  const z = 0.03 + 0.97 * Math.abs(b);
  const flat = Math.sqrt(1 - z * z);
  return { dir: [flat * Math.cos(azimuth), flat * Math.sin(azimuth), z], bright: 0.4 + 0.6 * Math.abs(c) };
});

export const LIGHT_COLORS = ["#ffd98a", "#fff2cf", "#ff9d4d", "#ffb54a", "#ffffff", "#3ddc84", "#ff3b30"];
const [WARM, PALE, AMBER, SODIUM, WHITE, GREEN, RED] = [0, 1, 2, 3, 4, 5, 6];

const hash = (a, b) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0) / 4294967296;

function cityLights(lights) {
  for (const city of CITY_OUTLINES) {
    const tall = ["London", "Paris"].includes(city.name);
    const count = tall ? 1100 : 260;
    const seed = Math.trunc(city.lon * 1000);
    for (let i = 0; i < count * 3; i += 1) {
      const distance = city.reach * Math.sqrt((i + 0.5) / (count * 3));
      const angle = i * 2.399963;
      const x = city.centre[0] + Math.cos(angle) * distance;
      const y = city.centre[1] + Math.sin(angle) * distance;
      if (!inCity(x, y) || !isLand(x, y) || !airportClear(x, y)) continue;
      const roll = hash(i + 1, seed);
      lights.push([x, y, 4 + 40 * (tall && roll > 0.97), roll < 0.6 ? WARM : roll < 0.85 ? PALE : AMBER, 5]);
    }
  }
}

function motorwayLights(lights) {
  for (const [name, route] of ROADS) {
    if (!name.startsWith("M") && !["A16", "A1 France"].includes(name)) continue;
    const points = route.map((p) => geographic(...p));
    let side = 1;
    points.slice(1).forEach(([bx, by], i) => {
      const [ax, ay] = points[i];
      const length = Math.hypot(bx - ax, by - ay);
      const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
      for (let d = 0; d < length; d += 320) {
        side = -side;
        lights.push([ax + ux * d - uy * 26 * side, ay + uy * d + ux * 26 * side, 9, SODIUM, 6]);
      }
    });
  }
}

function runwayLights(lights, runway) {
  const [x, y] = airportPosition(runway);
  const heading = runway.runwayHeading * Math.PI / 180;
  const at = (along, across, z, color, size) => lights.push([
    x + along * Math.sin(heading) + across * Math.cos(heading),
    y + along * Math.cos(heading) - across * Math.sin(heading), z, color, size,
  ]);
  const half = runway.runwayLength / 2;
  const wide = runway.runwayWidth / 2;
  for (let along = -half; along <= half; along += 60) {
    at(along, -wide, 0.4, WHITE, 1.6);
    at(along, wide, 0.4, WHITE, 1.6);
    if (Math.abs(along) < half - 300) at(along, 0, 0.3, WHITE, 1.2);
  }
  for (const end of [-1, 1]) {
    for (let across = -wide; across <= wide; across += 5) {
      at(end * (half + 2), across, 0.4, end > 0 ? RED : GREEN, 1.6);
      at(end * (half - 1), across, 0.4, end > 0 ? GREEN : RED, 1.6);
    }
    for (let out = 30; out <= 900; out += 30) {
      at(end * (half + out), 0, 0.5, WHITE, 1.8);
      if (out % 150 === 0) for (const across of [-12, -8, -4, 4, 8, 12]) at(end * (half + out), across, 0.5, WHITE, 1.6);
    }
  }
}

// All static night lights as [x, y, height, colourIndex, size] grouped by colour.
let cached = null;
export function nightLights() {
  if (cached) return cached;
  const lights = [];
  cityLights(lights);
  motorwayLights(lights);
  for (const airport of AIRPORTS) {
    for (const runway of allRunways(airport)) runwayLights(lights, runway);
  }
  cached = lights.sort((a, b) => a[3] - b[3]);
  return cached;
}
