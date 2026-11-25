import {
  AIRCRAFT, AIRPORTS, Flight, allRunways, airportPosition, clamp, clampLook, nextTimeScale,
} from "./flight-model.mjs";
import {
  CITY_OUTLINES, COASTS, LAND_SURFACES, ROADS, THAMES, clipPolygon, coarseTerrain, geographic,
  heathrowScenery, regionalScenery, terrain,
} from "./scenery.mjs";
import { cloudCover, cloudDrift, cloudSurfaces } from "./clouds.mjs";
import { aircraftLights, aircraftSurfaces } from "./aircraft-visuals.mjs";
import {
  LIGHT_COLORS, STARS, hazeSettings, nightColor, nightLights, resolveFog, resolveNight, skyStops,
} from "./environment.mjs";
import { aircraftCondition, componentCondition, CONDITION_PARTS, conditionColor, drawAircraftCondition, drawAltitudeChart, drawSummaryMap, formatDistance, formatDuration, trace } from "./summary.mjs";

const london = heathrowScenery();
const region = regionalScenery();

const $ = (selector) => document.querySelector(selector);
const scene = $("#scene");
const context = scene.getContext("2d");
const map = $("#map");
const mapContext = map.getContext("2d");
const setup = $("#setup");
const gamePanel = $("#game");
const form = $("#flight-form");
const keys = new Set();
const mouse = { x: 0, y: 0 };
const state = {
  flight: null, external: false, paused: false, mouseEnabled: false,
  lookYaw: 0, lookPitch: 0, timeScale: 1, trail: [], summaryShown: false,
  environment: { foggy: false, night: false },
};
const summaryPanel = $("#summary");
const LOOK_SENSITIVITY = 0.25; // degrees of look-around per dragged pixel
const CLICK_SLOP = 4; // pixels of movement before a press becomes a drag
let drag = null;
const controls = {
  pause: $("#pause-button"),
  view: $("#view-button"),
  mouse: $("#mouse-button"),
  restart: $("#restart-button"),
  menu: $("#menu-button"),
  gear: $("#gear-button"),
  speed: $("#speed-button"),
};
let width = 0;
let height = 0;
let focal = 0;
let camera = null;
let lastFrame = performance.now();

for (const aircraft of AIRCRAFT) {
  $("#aircraft").add(new Option(aircraft.name, aircraft.name));
}
for (const airport of AIRPORTS) {
  for (const select of ["#departure", "#destination"]) {
    $(select).add(new Option(`${airport.name} (${airport.code})`, airport.code));
  }
}
$("#destination").selectedIndex = 1;

function setFlightButtons(enabled) {
  for (const button of Object.values(controls)) button.disabled = !enabled;
}

// Shared by starting a flight and returning to the menu.
function resetSession() {
  setTimeScale(1);
  resetView();
  drag = null;
  clearInput();
  state.paused = false;
  hideSummary();
}

function clearInput() {
  keys.clear();
  mouse.x = 0;
  mouse.y = 0;
}

function resetView() {
  state.lookYaw = state.lookPitch = 0;
}

function setTimeScale(scale) {
  state.timeScale = scale;
  controls.speed.textContent = `Speed: ${scale}x`;
}

function startFlight() {
  const aircraft = AIRCRAFT.find((item) => item.name === $("#aircraft").value);
  const departure = AIRPORTS.find((item) => item.code === $("#departure").value);
  const destination = AIRPORTS.find((item) => item.code === $("#destination").value);
  if (departure === destination) {
    $("#form-message").textContent = "Choose two different airports.";
    return false;
  }
  const windSpeed = Number($("#weather").value);
  state.flight = new Flight(aircraft, departure, destination, windSpeed,
    windSpeed === 9 ? 225 : 270);
  state.environment = {
    foggy: resolveFog($("#visibility").value),
    night: resolveNight($("#time-of-day").value),
  };
  state.external = false;
  state.trail = [];
  resetSession();
  controls.pause.textContent = "Pause";
  $("#form-message").textContent = "";
  $("#flight-message").textContent = state.flight.message;
  setup.hidden = true;
  gamePanel.hidden = false;
  setFlightButtons(true);
  controls.view.textContent = "External view";
  resizeCanvases();
  lastFrame = performance.now();
  scene.focus({ preventScroll: true });
  return true;
}

function hideSummary() {
  state.summaryShown = false;
  summaryPanel.hidden = true;
}

function sizeCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [ctx, rect.width, rect.height];
}

function showSummary(flight) {
  const summary = flight.summary();
  state.summaryShown = true;
  summaryPanel.hidden = false;
  $("#summary-route").textContent = `${flight.aircraft.name} · ${flight.departure.name} → ${flight.destination.name}`;
  for (const key of ["takeoff", "flight", "landing", "overall"]) $(`#score-${key}`).textContent = summary.scores[key];
  $("#stat-time").textContent = formatDuration(summary.time);
  $("#stat-airborne").textContent = formatDuration(summary.airborneTime);
  $("#stat-distance").textContent = formatDistance(summary.distance);
  $("#stat-planned").textContent = formatDistance(summary.plannedDistance);
  drawSummaryMap(...sizeCanvas($("#summary-map")), summary, flight);
  drawAltitudeChart(...sizeCanvas($("#summary-altitude")), summary);
  const condition = aircraftCondition(flight.damageKinds, summary.damageSeverity);
  drawAircraftCondition(...sizeCanvas($("#summary-condition")), condition,
    componentCondition(flight.damageKinds, summary.damageSeverity, summary.side));
  $("#damage-log").innerHTML = summary.damageLog.map((entry) =>
    `<li>${formatDuration(entry.time)} · ${entry.label}${entry.detail ? ` (${entry.detail})` : ""} · ${Math.round(entry.severity * 100)}%</li>`).join("")
    || "<li>No damage recorded.</li>";
  $("#condition-list").innerHTML = CONDITION_PARTS
    .map(([part, label]) => `<li><span>${label}</span><strong style="color:${conditionColor(condition[part])}">${condition[part]} / 100</strong></li>`).join("");
}

$("#summary-again").addEventListener("click", () => startFlight());
$("#summary-menu").addEventListener("click", () => showMenu());
$("#summary-close").addEventListener("click", () => { summaryPanel.hidden = true; });

function showMenu() {
  resetSession();
  state.flight = null;
  gamePanel.hidden = true;
  setup.hidden = false;
  setFlightButtons(false);
  $("#form-message").textContent = "";
}

function setPaused(paused) {
  state.paused = paused;
  controls.pause.textContent = paused ? "Resume" : "Pause";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startFlight();
});
controls.pause.addEventListener("click", () => setPaused(!state.paused));
controls.view.addEventListener("click", () => setView(!state.external));
controls.mouse.addEventListener("click", () => toggleMouseSteering());
controls.speed.addEventListener("click", () => setTimeScale(nextTimeScale(state.timeScale)));
controls.restart.addEventListener("click", () => startFlight());
controls.menu.addEventListener("click", showMenu);
controls.gear.addEventListener("click", () => {
  if (state.flight && !state.paused) state.flight.toggleGear();
});

function setView(external) {
  state.external = external;
  resetView();
  controls.view.textContent = external ? "Cockpit view" : "External view";
}

function toggleMouseSteering() {
  state.mouseEnabled = !state.mouseEnabled;
  mouse.x = mouse.y = 0;
  controls.mouse.textContent = `Mouse steering: ${state.mouseEnabled ? "on" : "off"}`;
}

const HANDLED_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "+", "-", "=", "_", "pageup", "pagedown", "w", "a", "s", "d", "q", "e", "v", "1", "2", "m", "p", "r", "g", "l", "f", "c", "escape"]);
window.addEventListener("keydown", (event) => {
  if (!state.flight || setup.hidden === false) return;
  const key = event.key.toLowerCase();
  if (HANDLED_KEYS.has(key)) event.preventDefault();
  const wasDown = keys.has(key);
  keys.add(key);
  if (wasDown) return;
  if (key === "v") setView(!state.external);
  else if (key === "1") setView(false);
  else if (key === "2") setView(true);
  else if (key === "m") toggleMouseSteering();
  else if (key === "p") setPaused(!state.paused);
  else if (key === "f") setTimeScale(nextTimeScale(state.timeScale));
  else if (key === "c") resetView();
  else if (key === "g" && !state.paused) state.flight.toggleGear();
  else if (key === "l" && !state.paused) state.flight.lightsOn = !state.flight.lightsOn;
  else if (key === "r") startFlight();
  else if (key === "escape") showMenu();
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
// The game keeps running when the window loses focus; only held keys are
// released so nothing stays stuck. A hidden tab pauses because browsers stop
// animation frames there.
window.addEventListener("blur", () => {
  if (state.flight && !gamePanel.hidden) {
    clearInput();
    drag = null;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.flight && !gamePanel.hidden) {
    clearInput();
    drag = null;
    setPaused(true);
  }
});

scene.addEventListener("pointerdown", (event) => {
  if (!state.flight) return;
  drag = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
  if (scene.setPointerCapture) scene.setPointerCapture(event.pointerId);
});
scene.addEventListener("pointermove", (event) => {
  if (state.flight && state.mouseEnabled) {
    const rect = scene.getBoundingClientRect();
    mouse.x = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width * 0.35), -1, 1);
    mouse.y = clamp((rect.height / 2 - (event.clientY - rect.top)) / (rect.height * 0.35), -1, 1);
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= CLICK_SLOP) return;
  // Dragging grabs the world, as in a street-view panorama.
  [state.lookYaw, state.lookPitch] = clampLook(
    state.lookYaw - (event.clientX - drag.lastX) * LOOK_SENSITIVITY,
    state.lookPitch + (event.clientY - drag.lastY) * LOOK_SENSITIVITY);
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  drag.moved = true;
});
scene.addEventListener("pointerup", (event) => {
  const finished = drag;
  drag = null;
  if (finished && !finished.moved) cockpitClick(event);
});
scene.addEventListener("pointercancel", () => { drag = null; });
scene.addEventListener("wheel", (event) => {
  if (state.flight && !state.paused) {
    event.preventDefault();
    state.flight.throttle = clamp(state.flight.throttle - Math.sign(event.deltaY) * 0.05, 0, 1);
  }
}, { passive: false });

function cockpitClick(event) {
  if (!state.flight || state.external || state.paused) return;
  const rect = scene.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (y < 0.79 + 0.21 * 0.08 || y > 0.79 + 0.21 * 0.27) return;
  if (Math.abs(x - 0.69) < 0.045) state.flight.toggleGear();
  else if (Math.abs(x - 0.8) < 0.045) state.flight.lightsOn = !state.flight.lightsOn;
  else if (Math.abs(x - 0.91) < 0.045) toggleMouseSteering();
}

const touchKeys = {
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown",
  "throttle-up": "+",
  "throttle-down": "-",
  brake: " ",
};
document.querySelectorAll("[data-control]").forEach((button) => {
  const key = touchKeys[button.dataset.control];
  const release = (event) => {
    event.preventDefault();
    keys.delete(key);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    keys.add(key);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

function resizeCanvases() {
  if (gamePanel.hidden) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = scene.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  scene.width = Math.round(width * dpr);
  scene.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mapRect = map.getBoundingClientRect();
  map.width = Math.round(mapRect.width * dpr);
  map.height = Math.round(mapRect.height * dpr);
  mapContext.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvases);

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}
function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}
function cameraPoint(point) {
  const relative = subtract(point, camera.eye);
  return [dot(relative, camera.right), dot(relative, camera.up), dot(relative, camera.forward)];
}
function project(point) {
  return [width / 2 + focal * point[0] / point[2], height / 2 - focal * point[1] / point[2]];
}
// Frustum planes read the live width, height and focal length, so they are built once.
const VIEW_PLANES = [
  (p) => p[2] - 1,
  (p) => p[2] * width / 2 + p[0] * focal,
  (p) => p[2] * width / 2 - p[0] * focal,
  (p) => p[2] * height / 2 + p[1] * focal,
  (p) => p[2] * height / 2 - p[1] * focal,
];
function clipped(points) {
  let result = points;
  for (const plane of VIEW_PLANES) result = clipPolygon(result, plane);
  return result;
}
const shade = (color) => (state.environment.night ? nightColor(color) : color);
function polygon(points, color, maxDepth = 50000) {
  const cameraPoints = points.map(cameraPoint);
  if (cameraPoints.every((p) => p[2] < 1) || cameraPoints.every((p) => p[2] > maxDepth)) return;
  const projectedPoints = clipped(cameraPoints);
  if (projectedPoints.length < 3) return;
  trace(context, projectedPoints.map(project));
  context.closePath();
  context.fillStyle = shade(color);
  context.fill();
}
function groundLine(first, second, color, lineWidth = 1) {
  let a = cameraPoint(first);
  let b = cameraPoint(second);
  for (const plane of VIEW_PLANES) {
    const da = plane(a);
    const db = plane(b);
    if (da < 0 && db < 0) return;
    if ((da >= 0) !== (db >= 0)) {
      const ratio = da / (da - db);
      const intersection = a.map((value, axis) => value + ratio * (b[axis] - value));
      if (da < 0) a = intersection;
      else b = intersection;
    }
  }
  const [x1, y1] = project(a);
  const [x2, y2] = project(b);
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = shade(color);
  context.lineWidth = lineWidth;
  context.stroke();
}
function runwayPoint(airport, along, across, z = 0.05) {
  const [x, y] = airportPosition(airport);
  const heading = airport.runwayHeading * Math.PI / 180;
  return [
    x + along * Math.sin(heading) + across * Math.cos(heading),
    y + along * Math.cos(heading) - across * Math.sin(heading),
    z,
  ];
}
function runway(airport) {
  for (const surface of allRunways(airport)) runwaySurface(surface);
  const label = cameraPoint([...airportPosition(airport), 35]);
  if (label[2] > 1) {
    const [x, y] = project(label);
    context.fillStyle = "#fff";
    context.font = "bold 13px system-ui";
    context.textAlign = "center";
    context.fillText(airport.code, x, y);
  }
}
function runwaySurface(airport) {
  const length = airport.runwayLength / 2;
  const widthAt = airport.runwayWidth / 2;
  polygon([
    runwayPoint(airport, -length, -widthAt - 10), runwayPoint(airport, length, -widthAt - 10),
    runwayPoint(airport, length, widthAt + 10), runwayPoint(airport, -length, widthAt + 10),
  ], "#506a46");
  polygon([
    runwayPoint(airport, -length, -widthAt), runwayPoint(airport, length, -widthAt),
    runwayPoint(airport, length, widthAt), runwayPoint(airport, -length, widthAt),
  ], "#444b50");
  for (const across of [-widthAt + 1, widthAt - 1]) {
    groundLine(runwayPoint(airport, -length, across), runwayPoint(airport, length, across), "#eeeecc", 1.5);
  }
  for (let along = Math.trunc(-length + 60); along < length - 60; along += 120) {
    polygon([
      runwayPoint(airport, along, -0.8), runwayPoint(airport, along + 45, -0.8),
      runwayPoint(airport, along + 45, 0.8), runwayPoint(airport, along, 0.8),
    ], "#fff");
  }
  for (const end of [-1, 1]) {
    for (const across of [-0.7, -0.4, 0.4, 0.7]) {
      const start = end * (length - 35);
      const stop = end * (length - 70);
      const center = across * widthAt;
      polygon([
        runwayPoint(airport, start, center - 1), runwayPoint(airport, stop, center - 1),
        runwayPoint(airport, stop, center + 1), runwayPoint(airport, start, center + 1),
      ], "#fff");
    }
  }
}
function planeTransform(flight) {
  const heading = flight.heading * Math.PI / 180;
  const pitch = flight.pitch * Math.PI / 180;
  const bank = flight.bank * Math.PI / 180;
  const world = ([across0, along0, up0]) => {
    let across = across0;
    let along = along0;
    let up = up0;
    [across, up] = [
      across * Math.cos(bank) + up * Math.sin(bank),
      up * Math.cos(bank) - across * Math.sin(bank),
    ];
    [along, up] = [
      along * Math.cos(pitch) - up * Math.sin(pitch),
      along * Math.sin(pitch) + up * Math.cos(pitch),
    ];
    return [
      flight.x + across * Math.cos(heading) + along * Math.sin(heading),
      flight.y - across * Math.sin(heading) + along * Math.cos(heading),
      flight.z + flight.aircraft.datum + up,
    ];
  };
  return world;
}

function drawPlane(flight) {
  const world = planeTransform(flight);
  return aircraftSurfaces(flight.aircraft, flight.gear, flight.time, flight.enginePower, flight.damageKinds)
    .map(([points, color]) => [points.map(world), color]);
}

function glow(point, color, radius, alpha = 1) {
  const p = cameraPoint(point);
  if (p[2] < 1) return;
  const [x, y] = project(p);
  const size = Math.max(1.2, focal * radius / p[2]);
  context.globalAlpha = alpha * 0.35;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, size * 2.2, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = alpha;
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawStars() {
  for (const { dir, bright } of STARS) {
    const p = [dot(dir, camera.right), dot(dir, camera.up), dot(dir, camera.forward)];
    if (p[2] < 0.05) continue;
    const [x, y] = project(p);
    context.fillStyle = `rgba(255,255,255,${bright * (state.environment.foggy ? 0.3 : 1)})`;
    context.fillRect(x, y, bright > 0.8 ? 2 : 1, bright > 0.8 ? 2 : 1);
  }
}

// City, motorway and runway lights, drawn under solids so buildings and clouds hide them.
function drawNightLights() {
  const lights = nightLights();
  const limit = state.environment.foggy ? 9000 : 90000;
  const [ex, ey, ez] = camera.eye;
  const [fx, fy, fz] = camera.forward;
  let colour = -1;
  for (const [x, y, z, index, size] of lights) {
    const dx = x - ex;
    const dy = y - ey;
    const depth = dx * fx + dy * fy + (z - ez) * fz;
    if (depth < 5 || depth > limit) continue;
    const sx = width / 2 + focal * (dx * camera.right[0] + dy * camera.right[1] + (z - ez) * camera.right[2]) / depth;
    if (sx < -10 || sx > width + 10) continue;
    const sy = height / 2 - focal * (dx * camera.up[0] + dy * camera.up[1] + (z - ez) * camera.up[2]) / depth;
    if (sy < -10 || sy > height + 10) continue;
    if (index !== colour) {
      colour = index;
      context.fillStyle = LIGHT_COLORS[index];
    }
    const radius = Math.min(6, Math.max(0.8, focal * size * 0.5 / depth));
    context.globalAlpha = Math.max(0.35, 1 - depth / limit);
    context.fillRect(sx - radius / 2, sy - radius / 2, radius, radius);
  }
  context.globalAlpha = 1;
}

function drawAircraftLights(flight) {
  const world = planeTransform(flight);
  for (const [point, color, radius] of aircraftLights(flight.aircraft, flight.time)) {
    glow(world(point), color, radius);
  }
  glow(world([0, flight.aircraft.supersonic ? 22 : 8, -0.8]), "#ffffff", 0.9, 0.9);
}

function setCamera(flight) {
  let heading = flight.heading * Math.PI / 180;
  let yaw = state.lookYaw * Math.PI / 180;
  let lookPitch = state.lookPitch * Math.PI / 180;
  let pitch;
  let bank;
  let eye;
  if (state.external) {
    const [distance, heightAbove] = flight.aircraft === AIRCRAFT[0] ? [32, 11]
      : flight.aircraft.supersonic ? [120, 36] : [85, 28];
    // Orbit the aircraft; the default elevation keeps the original -12 degree view.
    const base = Math.atan2(heightAbove, distance);
    const elevation = clamp(base + lookPitch, -80 * Math.PI / 180, 80 * Math.PI / 180);
    const azimuth = heading + yaw;
    const radius = Math.hypot(distance, heightAbove);
    eye = [
      flight.x - Math.sin(azimuth) * Math.cos(elevation) * radius,
      flight.y - Math.cos(azimuth) * Math.cos(elevation) * radius,
      flight.z + Math.sin(elevation) * radius,
    ];
    heading = azimuth;
    pitch = base - 12 * Math.PI / 180 - elevation;
    bank = 0;
    yaw = lookPitch = 0;
  } else {
    eye = [flight.x, flight.y, flight.z + (flight.aircraft === AIRCRAFT[0] ? 2 : flight.aircraft.supersonic ? 6 : 5)];
    pitch = flight.pitch * Math.PI / 180;
    bank = flight.bank * Math.PI / 180;
  }
  const right = [Math.cos(heading), -Math.sin(heading), 0];
  const up = [
    -Math.sin(heading) * Math.sin(pitch),
    -Math.cos(heading) * Math.sin(pitch),
    Math.cos(pitch),
  ];
  const forward = [
    Math.sin(heading) * Math.cos(pitch),
    Math.cos(heading) * Math.cos(pitch),
    Math.sin(pitch),
  ];
  const rightB = right.map((value, i) => value * Math.cos(bank) - up[i] * Math.sin(bank));
  const upB = up.map((value, i) => value * Math.cos(bank) + right[i] * Math.sin(bank));
  // Turn the head: yaw about the camera's up axis, then pitch about its right axis.
  const yawed = forward.map((value, i) => value * Math.cos(yaw) + rightB[i] * Math.sin(yaw));
  const rightYawed = rightB.map((value, i) => value * Math.cos(yaw) - forward[i] * Math.sin(yaw));
  camera = {
    eye,
    right: rightYawed,
    up: upB.map((value, i) => value * Math.cos(lookPitch) - yawed[i] * Math.sin(lookPitch)),
    forward: yawed.map((value, i) => value * Math.cos(lookPitch) + upB[i] * Math.sin(lookPitch)),
    pitch,
    bank,
  };
}

// Fog blends the distance into the sky along the (possibly banked) horizon line.
function drawHaze() {
  const haze = hazeSettings(state.environment);
  if (!haze) return;
  const right = camera.right[2];
  const up = camera.up[2];
  const norm = Math.hypot(right, up);
  context.fillStyle = `rgba(${haze.rgb},${haze.veil})`;
  context.fillRect(0, 0, width, height);
  if (norm < 1e-3) return;
  const normal = [-right / norm, up / norm];
  const below = -camera.forward[2] * focal / norm;
  const horizon = [width / 2 - normal[0] * below, height / 2 - normal[1] * below];
  const upBand = height * haze.up;
  const downBand = height * haze.down;
  const gradient = context.createLinearGradient(
    horizon[0] - normal[0] * upBand, horizon[1] - normal[1] * upBand,
    horizon[0] + normal[0] * downBand, horizon[1] + normal[1] * downBand);
  gradient.addColorStop(0, `rgba(${haze.rgb},0)`);
  gradient.addColorStop(upBand / (upBand + downBand), `rgba(${haze.rgb},${haze.alpha})`);
  gradient.addColorStop(1, `rgba(${haze.rgb},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawScene(flight) {
  context.clearRect(0, 0, width, height);
  const sky = context.createLinearGradient(0, 0, 0, height);
  for (const [stop, color] of skyStops(state.environment)) sky.addColorStop(stop, color);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  setCamera(flight);
  if (state.environment.night) drawStars();
  focal = width * (state.external ? 0.75 : 0.58);
  // Match the horizon to the camera's world-space ground intersection.
  const groundScreen = clipPolygon([[0, 0], [width, 0], [width, height], [0, height]], (p) => -(
    camera.right[2] * (p[0] - width / 2) / focal
    + camera.up[2] * (height / 2 - p[1]) / focal + camera.forward[2]));
  trace(context, groundScreen);
  context.closePath();
  context.fillStyle = shade("#528c9c");
  context.fill();
  const { ground, solids: trees } = terrain(flight.x, flight.y);
  const solids = [...trees];
  // Land is drawn at any distance so the coast stays continuous out to the horizon.
  for (const [points, color] of LAND_SURFACES) polygon(points, color, Infinity);
  const altitudeCells = clamp(Math.round(10 + flight.z / 1500), 10, 22);
  for (const [points, color] of coarseTerrain(flight.x, flight.y, altitudeCells)) polygon(points, color, 120000);
  for (const [points, color] of ground) polygon(points, color);
  for (const [points, color] of region.ground) polygon(points, color, 90000);
  for (const [points, color] of london.ground) polygon(points, color);
  [...AIRPORTS]
    .map((airport) => {
      const [ax, ay] = airportPosition(airport);
      return [airport, Math.hypot(ax - flight.x, ay - flight.y)];
    })
    .filter(([, distance]) => distance < 50000)
    .sort((a, b) => b[1] - a[1])
    .forEach(([airport]) => runway(airport));
  if (state.environment.night) drawNightLights();
  if (state.external) solids.push(...drawPlane(flight));
  solids.push(...london.solids);
  solids.push(...region.solids.filter(([points, , far]) => points.some(
    (p) => Math.hypot(p[0] - flight.x, p[1] - flight.y) < (far ? 110000 : 40000))));
  solids.push(...cloudSurfaces(camera.eye, cloudDrift(flight)));
  const depth = ([points]) => points.reduce((sum, p) => sum + cameraPoint(p)[2], 0) / points.length;
  const ordered = solids.map((surface) => [surface, depth(surface)]).sort((a, b) => b[1] - a[1]);
  for (const [[points, color, far]] of ordered) polygon(points, color, far ? 120000 : 60000);
  if (state.environment.night && state.external) drawAircraftLights(flight);
  drawHaze();
  if (!state.external) drawCockpit(flight);
  context.strokeStyle = "#fff3aa";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(width / 2 - 20, height / 2);
  context.lineTo(width / 2 - 5, height / 2);
  context.moveTo(width / 2 + 5, height / 2);
  context.lineTo(width / 2 + 20, height / 2);
  context.moveTo(width / 2, height / 2 - 5);
  context.lineTo(width / 2, height / 2 + 5);
  context.stroke();
}

function drawCockpit(flight) {
  const top = height * 0.79;
  const ph = height - top;
  const ink = flight.lightsOn ? "#a9ebca" : "#86958d";
  const line = (x1, y1, x2, y2, color, size = 1) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.stroke();
  };
  const circle = (x, y, radius, color) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  };
  const text = (value, x, y, color = ink) => {
    context.textAlign = "center";
    context.font = `${Math.max(6, Math.min(10, width * 0.01))}px monospace`;
    context.fillStyle = color;
    context.fillText(value, x, y);
  };
  line(0, top, width * 0.045, 0, "#26313b", 9);
  line(width, top, width * 0.955, 0, "#26313b", 9);
  context.fillStyle = "#202c36";
  context.fillRect(0, top, width, ph);
  line(0, top, width, top, "#52616b", 4);
  const radius = Math.min(width * 0.035, ph * 0.22);
  const gauges = [
    [0.075, "AIR", flight.airspeed / flight.aircraft.maxSpeed, `${Math.round(flight.airspeed * 1.94384)} kt`],
    [0.19, "ALT", (flight.z * 3.28084 % 10000) / 10000, `${Math.round(flight.z * 3.28084)} ft`],
    [0.305, "HDG", flight.heading / 360, `${Math.round(flight.heading)}°`],
    [0.42, "V/S", clamp(0.5 + flight.vz / 30, 0, 1), `${Math.round(flight.vz * 196.85)}`],
  ];
  for (const [x, label, value, reading] of gauges) {
    const cx = width * x;
    const cy = top + ph * 0.36;
    circle(cx, cy, radius + 2, "#6b7c87");
    circle(cx, cy, radius, "#101b23");
    for (let i = 0; i <= 10; i += 1) {
      const angle = (-225 + i * 27) * Math.PI / 180;
      line(cx + Math.cos(angle) * radius * 0.78, cy + Math.sin(angle) * radius * 0.78,
        cx + Math.cos(angle) * radius * 0.92, cy + Math.sin(angle) * radius * 0.92, ink);
    }
    const angle = (-225 + clamp(value, 0, 1) * 270) * Math.PI / 180;
    line(cx, cy, cx + Math.cos(angle) * radius * 0.72,
      cy + Math.sin(angle) * radius * 0.72, "#f3ce77", 2);
    text(label, cx, top + ph * 0.73);
    text(reading, cx, top + ph * 0.9);
  }
  const sx = width * 0.52;
  const sy = height - ph * 0.15;
  const gx = sx + flight.aileron * width * 0.021;
  const gy = sy - ph * 0.3 + flight.elevator * ph * 0.11;
  circle(sx, sy, Math.min(15, width * 0.015), "#101820");
  line(sx, sy, gx, gy, "#7e8d96", 6);
  context.fillStyle = "#111a21";
  context.fillRect(gx - width * 0.007, gy - ph * 0.1, width * 0.014, ph * 0.14);
  circle(gx, gy - ph * 0.07, 2, "#d95746");
  for (let i = 0; i < flight.aircraft.engines; i += 1) {
    const tx = width * (0.59 + i * 0.018);
    context.fillStyle = "#0c141b";
    context.fillRect(tx - 3, top + ph * 0.13, 6, ph * 0.66);
    const ty = top + ph * (0.78 - flight.throttle * 0.6);
    line(tx, height - ph * 0.16, tx, ty, "#8d9ba4", 3);
    context.fillStyle = "#dde0d6";
    context.fillRect(tx - width * 0.008, ty - 4, width * 0.016, 8);
  }
  text(`PWR ${Math.round(flight.enginePower * 100)}%`, width * 0.61, top + ph * 0.94);
  for (const [x, label] of [[0.69, "GEAR [G]"], [0.8, "LIGHTS [L]"], [0.91, "MOUSE [M]"]]) {
    context.fillStyle = "#394b58";
    context.fillRect(width * (x - 0.045), top + ph * 0.08, width * 0.09, ph * 0.19);
    text(label, width * x, top + ph * 0.21);
  }
  const gearColor = flight.gear >= 0.99 ? "#73ec94" : flight.gear > 0.01 ? "#edb64d" : "#36434c";
  for (const x of [0.67, 0.69, 0.71]) circle(width * x, top + ph * 0.38, 3, gearColor);
  text(flight.gear >= 0.99 ? "DOWN" : flight.gear > 0.01 ? "TRANSIT" : "UP", width * 0.69, top + ph * 0.54);
  circle(width * 0.8, top + ph * 0.38, 3, flight.enginePower > 0.1 ? "#73ec94" : "#36434c");
  circle(width * 0.91, top + ph * 0.38, 3, flight.stalled ? "#f17252" : "#36434c");
  text("POWER", width * 0.8, top + ph * 0.54);
  text("STALL", width * 0.91, top + ph * 0.54);
  text(`PITCH ${flight.pitch.toFixed(0)}  BANK ${flight.bank.toFixed(0)}`, width * 0.82, top + ph * 0.8);
}

function drawMap(flight) {
  const rect = map.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const destination = airportPosition(flight.destination);
  const route = [airportPosition(flight.departure), destination, [flight.x, flight.y]];
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 60000) * 1.4;
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 60000 * h / w) * 1.4;
  const scale = Math.min(w / spanX, h / spanY);
  const point = ([x, y]) => [w / 2 + (x - centre[0]) * scale, h / 2 - (y - centre[1]) * scale];
  const fillClipped = (points, color) => {
    let shape = points;
    for (const edge of [(p) => p[0], (p) => w - p[0], (p) => p[1], (p) => h - p[1]]) shape = clipPolygon(shape, edge);
    if (shape.length < 3) return;
    trace(mapContext, shape);
    mapContext.closePath();
    mapContext.fillStyle = color;
    mapContext.fill();
  };
  mapContext.clearRect(0, 0, w, h);
  mapContext.fillStyle = "#2c5f7a";
  mapContext.fillRect(0, 0, w, h);
  const coasts = COASTS.map((coast) => coast.map((p) => point(geographic(...p))));
  mapContext.lineJoin = "round";
  mapContext.lineWidth = 5;
  mapContext.strokeStyle = "#3b7a93";
  for (const coast of coasts) {
    trace(mapContext, coast);
    mapContext.closePath();
    mapContext.stroke();
  }
  for (const coast of coasts) fillClipped(coast, "#78915f");
  for (const city of CITY_OUTLINES) fillClipped(city.points.map(point), "#aaa99a");
  mapContext.lineWidth = 1.5;
  mapContext.strokeStyle = "#4f93ad";
  const [hx, hy] = airportPosition(AIRPORTS[0]);
  trace(mapContext, THAMES.map(([x, y]) => point([hx + x, hy + y])));
  mapContext.stroke();
  mapContext.lineWidth = 1;
  mapContext.strokeStyle = "#d6b45a";
  for (const [name, roadPoints] of ROADS) {
    if (!name.startsWith("M")) continue;
    trace(mapContext, roadPoints.map((p) => point(geographic(...p))));
    mapContext.stroke();
  }
  const drift = cloudDrift(flight);
  const cell = Math.max(w / 22, 5);
  for (let x = cell / 2; x < w; x += cell) {
    for (let y = cell / 2; y < h; y += cell) {
      const cover = cloudCover(centre[0] + (x - w / 2) / scale, centre[1] - (y - h / 2) / scale, drift);
      if (cover < 0.47) continue;
      mapContext.fillStyle = `rgba(255,255,255,${Math.min(0.55, (cover - 0.45) * 3).toFixed(2)})`;
      mapContext.beginPath();
      mapContext.arc(x, y, cell * 0.75, 0, Math.PI * 2);
      mapContext.fill();
    }
  }
  if (state.trail.length > 1) {
    mapContext.strokeStyle = "#ffd9a0";
    trace(mapContext, state.trail.map(point));
    mapContext.stroke();
  }
  mapContext.setLineDash([4, 4]);
  mapContext.strokeStyle = "#f2d16b";
  trace(mapContext, [point(route[0]), point(destination)]);
  mapContext.stroke();
  mapContext.setLineDash([]);
  mapContext.font = "9px system-ui";
  mapContext.textAlign = "center";
  for (const airport of AIRPORTS) {
    const [x, y] = point(airportPosition(airport));
    const target = airport === flight.destination;
    mapContext.fillStyle = target ? "#f2d16b" : "#fff";
    mapContext.beginPath();
    mapContext.arc(x, y, target ? 4 : 3, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.fillStyle = "#fff";
    mapContext.fillText(airport.code, x, y - 7);
  }
  const heading = flight.heading * Math.PI / 180;
  const forward = [Math.sin(heading), -Math.cos(heading)];
  const side = [Math.cos(heading), Math.sin(heading)];
  const [x, y] = point([flight.x, flight.y]);
  const at = (f, s) => [x + forward[0] * f + side[0] * s, y + forward[1] * f + side[1] * s];
  trace(mapContext, [at(9, 0), at(-5, 6), at(-2, 0), at(-5, -6)]);
  mapContext.closePath();
  mapContext.fillStyle = "#ff8b38";
  mapContext.fill();
  mapContext.lineWidth = 1;
  mapContext.strokeStyle = "#fff";
  mapContext.stroke();
  const remaining = flight.navigation[0];
  const label = remaining < 2000 ? `${Math.round(remaining)} m` : `${(remaining / 1000).toFixed(1)} km`;
  mapContext.fillStyle = "rgba(8,18,24,0.8)";
  mapContext.fillRect(0, h - 16, w, 16);
  mapContext.fillStyle = "#f4e3b0";
  mapContext.fillText(`${flight.destination.code} runway: ${label}`, w / 2, h - 5);
}

function formatTelemetry(flight) {
  const [distance, bearing] = flight.navigation;
  $("#airspeed").textContent = `${Math.round(flight.airspeed * 1.94384)} kt`;
  $("#altitude").textContent = `${Math.round(flight.z * 3.28084)} ft`;
  $("#heading").textContent = `${String(Math.round(flight.heading) % 360).padStart(3, "0")}°`;
  $("#throttle").textContent = `${Math.round(flight.throttle * 100)}%`;
  $("#vertical-speed").textContent = `${Math.round(flight.vz * 196.85)} ft/min`;
  $("#distance").textContent = `${(distance / 1000).toFixed(1)} km · ${String(Math.round(bearing)).padStart(3, "0")}°`;
  $("#flight-message").textContent = flight.message;
  const warning = state.paused ? "PAUSED — press P or Resume to continue"
    : flight.completed ? "FLIGHT COMPLETE"
      : flight.crashed ? "FLIGHT ENDED — press R to retry"
        : flight.stalled ? "STALL — lower the nose"
          : flight.airspeed > flight.aircraft.maxSpeed * 0.9 ? "OVERSPEED — reduce throttle" : "";
  const speedTag = state.timeScale > 1 ? ` · ▶▶ ${state.timeScale}x` : "";
  $("#status-chip").textContent = (warning || `${flight.aircraft.name} · ${flight.departure.code} → ${flight.destination.code} · ${state.external ? "External" : "Cockpit"}`) + speedTag;
  $("#status-chip").classList.toggle("warning", Boolean(warning));
  // Damage labels are fixed strings from the flight model, so they are safe as HTML.
  $("#damage-alerts").innerHTML = flight.damage
    .map((text) => `<div class="damage-alert">⚠ ${text.toUpperCase()}</div>`).join("");
}

function axis(positive, negative) {
  return Number(positive.some((key) => keys.has(key))) - Number(negative.some((key) => keys.has(key)));
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (state.flight && !gamePanel.hidden) {
    const flight = state.flight;
    if (!state.paused) {
      const throttle = axis(["+", "=", "pageup"], ["-", "_", "pagedown"]);
      flight.throttle = clamp(flight.throttle + throttle * dt * 0.3, 0, 1);
      let elevator = axis(["arrowdown", "s"], ["arrowup", "w"]);
      let aileron = axis(["arrowright", "d"], ["arrowleft", "a"]);
      if (state.mouseEnabled) {
        aileron += mouse.x;
        elevator += mouse.y;
      }
      const rudder = axis(["e"], ["q"]);
      // Several normal-sized steps per frame speed the simulation up without
      // dropping time to the model's per-update limit.
      for (let i = 0; i < state.timeScale; i += 1) {
        flight.update(dt, elevator, aileron, rudder, keys.has(" "));
        if (flight.crashed || flight.completed) {
          setTimeScale(1);
          break;
        }
      }
    }
    const last = state.trail[state.trail.length - 1];
    if (!last || Math.hypot(flight.x - last[0], flight.y - last[1]) > 150) {
      state.trail.push([flight.x, flight.y]);
      if (state.trail.length > 500) state.trail.shift();
    }
    if (flight.completed && !state.summaryShown) showSummary(flight);
    drawScene(flight);
    drawMap(flight);
    formatTelemetry(flight);
  }
  requestAnimationFrame(frame);
}

setFlightButtons(false);
resizeCanvases();
requestAnimationFrame(frame);
