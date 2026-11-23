import { CITY_OUTLINES, COASTS, clipPolygon, geographic } from "./scenery.mjs";

const FEET = 3.28084;

export function formatDuration(seconds) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, "0")} s`;
}

export function formatDistance(metres) {
  return metres < 2000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

function trace(ctx, points) {
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
