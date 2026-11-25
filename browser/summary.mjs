import { CITY_OUTLINES, COASTS, clipPolygon, geographic } from "./scenery.mjs";

const FEET = 3.28084;

export function formatDuration(seconds) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, "0")} s`;
}

export function formatDistance(metres) {
  return metres < 2000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

export function trace(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(...p) : ctx.lineTo(...p)));
}

// Coastlines and cities with the planned route (dashed) over the track actually flown.
export function drawSummaryMap(ctx, w, h, summary, flight) {
  const [from, to] = summary.planned;
  const points = [...summary.track.map((p) => [p[0], p[1]]), from, to];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 30000) * 1.3;
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 30000 * h / w) * 1.3;
  const scale = Math.min(w / spanX, h / spanY);
  const point = ([x, y]) => [w / 2 + (x - centre[0]) * scale, h / 2 - (y - centre[1]) * scale];
  const fillClipped = (shapePoints, color) => {
    let shape = shapePoints;
    for (const edge of [(p) => p[0], (p) => w - p[0], (p) => p[1], (p) => h - p[1]]) shape = clipPolygon(shape, edge);
    if (shape.length < 3) return;
    trace(ctx, shape);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#2c5f7a";
  ctx.fillRect(0, 0, w, h);
  for (const coast of COASTS) fillClipped(coast.map((p) => point(geographic(...p))), "#78915f");
  for (const city of CITY_OUTLINES) fillClipped(city.points.map(point), "#aaa99a");
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#f2d16b";
  trace(ctx, [point(from), point(to)]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ff6a2b";
  trace(ctx, summary.track.map((p) => point([p[0], p[1]])));
  ctx.stroke();
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  for (const [airport, position] of [[flight.departure, from], [flight.destination, to]]) {
    const [x, y] = point(position);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(airport.code, x, y - 8);
  }
  ctx.fillStyle = "#f2d16b";
  ctx.textAlign = "left";
  ctx.fillText("- - planned route", 8, h - 22);
  ctx.fillStyle = "#ff9c6e";
  ctx.fillText("— route flown", 8, h - 8);
}

// Altitude in feet against elapsed time.
export function drawAltitudeChart(ctx, w, h, summary) {
  const left = 44;
  const bottom = h - 20;
  const top = 12;
  const right = w - 10;
  const peak = Math.max(...summary.track.map((p) => p[2] * FEET), 100);
  const step = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].find((value) => peak / value <= 5) ?? 20000;
  const maxAlt = Math.ceil(peak / step) * step;
  const duration = Math.max(summary.time, 1);
  const x = (t) => left + (t / duration) * (right - left);
  const y = (alt) => bottom - (alt / maxAlt) * (bottom - top);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#13232c";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "10px system-ui";
  ctx.textAlign = "right";
  ctx.lineWidth = 1;
  for (let alt = 0; alt <= maxAlt; alt += step) {
    ctx.strokeStyle = "#ffffff22";
    trace(ctx, [[left, y(alt)], [right, y(alt)]]);
    ctx.stroke();
    ctx.fillStyle = "#93a9a2";
    ctx.fillText(`${alt} ft`, left - 4, y(alt) + 3);
  }
  const line = summary.track.map((p) => [x(p[3]), y(p[2] * FEET)]);
  trace(ctx, [[left, bottom], ...line, [line[line.length - 1][0], bottom]]);
  ctx.closePath();
  ctx.fillStyle = "#ff6a2b40";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff8b38";
  trace(ctx, line);
  ctx.stroke();
  ctx.fillStyle = "#93a9a2";
  ctx.textAlign = "center";
  ctx.fillText("0", left, h - 6);
  ctx.fillText(formatDuration(duration), right - 30, h - 6);
}

// Damage kind -> points lost per part (game scores only).
const CONDITION_LOSS = Object.freeze({
  tyres: { wheels: 40 },
  gear: { wheels: 60, integrity: 20 },
  nose_gear: { wheels: 60, integrity: 20 },
  belly: { wheels: 30, engines: 25, integrity: 35 },
  terrain: { wheels: 60, engines: 15, integrity: 30 },
  wing: { wings: 60, integrity: 25 },
  tail: { integrity: 15 },
  overspeed: { wings: 30, integrity: 40 },
  stall: { wings: 10, integrity: 20 },
});

export const CONDITION_PARTS = Object.freeze([
  ["integrity", "General integrity"], ["wings", "Wings"], ["engines", "Engines"], ["wheels", "Wheels"],
]);

// Each part rated out of 100, 100 being undamaged; severity (0..1) scales each kind's loss.
export function aircraftCondition(damageKinds, severity = {}) {
  const condition = { integrity: 100, wings: 100, engines: 100, wheels: 100 };
  for (const kind of damageKinds) {
    for (const [part, loss] of Object.entries(CONDITION_LOSS[kind] ?? {})) condition[part] -= loss * (severity[kind] ?? 1);
  }
  for (const part of Object.keys(condition)) condition[part] = Math.max(0, Math.round(condition[part]));
  return condition;
}

// Which individual parts each damage kind hits; "side" is the low-wing (touchdown bank) side.
const PART_HITS = Object.freeze({
  tyres: ["sideWheel"], gear: ["leftWheel", "rightWheel"], nose_gear: ["noseWheel"],
  belly: ["noseWheel", "leftWheel", "rightWheel", "leftEngine", "rightEngine"],
  terrain: ["noseWheel", "leftWheel", "rightWheel", "leftEngine", "rightEngine"],
  wing: ["sideWing", "sideEngine"], overspeed: ["leftWing", "rightWing"], stall: ["leftWing", "rightWing"],
});

// Per-component ratings for the top-down drawing; side is 1 for right, -1 for left.
export function componentCondition(damageKinds, severity = {}, side = 1) {
  const parts = {};
  for (const name of ["noseWheel", "leftWheel", "rightWheel", "leftEngine", "rightEngine", "leftWing", "rightWing"]) parts[name] = 100;
  const prefix = side < 0 ? "left" : "right";
  for (const kind of damageKinds) {
    const loss = CONDITION_LOSS[kind] ?? {};
    for (const hit of PART_HITS[kind] ?? []) {
      const name = hit.replace(/^side(.)/, (match, letter) => prefix + letter);
      const group = name.endsWith("Wheel") ? "wheels" : name.endsWith("Engine") ? "engines" : "wings";
      parts[name] -= (loss[group] ?? 0) * (severity[kind] ?? 1);
    }
  }
  for (const name of Object.keys(parts)) parts[name] = Math.max(0, Math.round(parts[name]));
  return parts;
}

// White when undamaged, shading to deep red as the rating falls.
export function conditionColor(value) {
  const fade = Math.round(255 * Math.min(Math.max(value, 0), 100) / 100);
  return `rgb(255, ${fade}, ${fade})`;
}

// Tiny top-down aircraft with each component coloured by its condition.
export function drawAircraftCondition(ctx, w, h, condition, parts = componentCondition([])) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#13232c";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  const s = Math.min(w / 100, h / 100);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#0b161c";
  const shape = (points, value) => {
    trace(ctx, points);
    ctx.closePath();
    ctx.fillStyle = conditionColor(value);
    ctx.fill();
    ctx.stroke();
  };
  const box = (x, y, bw, bh, value) => {
    ctx.fillStyle = conditionColor(value);
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeRect(x, y, bw, bh);
  };
  shape([[-14, 30], [14, 30], [4, 40], [-4, 40]], condition.integrity);
  shape([[-24, 6], [-5, -6], [-5, 6], [-24, 14]], parts.leftWing);
  shape([[24, 6], [5, -6], [5, 6], [24, 14]], parts.rightWing);
  box(-20, 2, 6, 14, parts.leftEngine);
  box(14, 2, 6, 14, parts.rightEngine);
  shape([[0, -44], [6, -34], [5, -20], [4, 34], [-4, 34], [-5, -20], [-6, -34]], condition.integrity);
  box(-1.5, -35, 3, 6, parts.noseWheel);
  box(-10.5, 5, 3, 6, parts.leftWheel);
  box(7.5, 5, 3, 6, parts.rightWheel);
  ctx.restore();
}
