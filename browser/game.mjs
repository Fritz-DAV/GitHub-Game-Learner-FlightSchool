import {
  AIRCRAFT, AIRPORTS, Flight, airportPosition, clamp,
} from "./flight-model.mjs";
import { LAND_SURFACES, clipPolygon, heathrowScenery, regionalScenery, terrain } from "./scenery.mjs";
import { aircraftSurfaces } from "./aircraft-visuals.mjs";

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
const state = { flight: null, external: false, paused: false, mouseEnabled: false };
const controls = {
  pause: $("#pause-button"),
  view: $("#view-button"),
  mouse: $("#mouse-button"),
  restart: $("#restart-button"),
  menu: $("#menu-button"),
  gear: $("#gear-button"),
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
  $("#departure").add(new Option(`${airport.name} (${airport.code})`, airport.code));
  $("#destination").add(new Option(`${airport.name} (${airport.code})`, airport.code));
}
$("#destination").selectedIndex = 1;

function setFlightButtons(enabled) {
  for (const button of Object.values(controls)) button.disabled = !enabled;
}

function clearInput() {
  keys.clear();
  mouse.x = 0;
  mouse.y = 0;
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
  state.external = false;
  state.paused = false;
  controls.pause.textContent = "Pause";
  clearInput();
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

function showMenu() {
  state.flight = null;
  state.paused = false;
  clearInput();
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
controls.restart.addEventListener("click", () => startFlight());
controls.menu.addEventListener("click", showMenu);
controls.gear.addEventListener("click", () => {
  if (state.flight && !state.paused) state.flight.toggleGear();
});

function setView(external) {
  state.external = external;
  controls.view.textContent = external ? "Cockpit view" : "External view";
}

function toggleMouseSteering() {
  state.mouseEnabled = !state.mouseEnabled;
  mouse.x = mouse.y = 0;
  controls.mouse.textContent = `Mouse steering: ${state.mouseEnabled ? "on" : "off"}`;
}

window.addEventListener("keydown", (event) => {
  if (!state.flight || setup.hidden === false) return;
  const key = event.key.toLowerCase();
  const handled = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "+", "-", "=", "_", "pageup", "pagedown", "w", "a", "s", "d", "q", "e", "v", "1", "2", "m", "p", "r", "g", "l", "escape"];
  if (handled.includes(key)) event.preventDefault();
  const wasDown = keys.has(key);
  keys.add(key);
  if (wasDown) return;
  if (key === "v") setView(!state.external);
  else if (key === "1") setView(false);
  else if (key === "2") setView(true);
  else if (key === "m") {
    toggleMouseSteering();
  } else if (key === "p") setPaused(!state.paused);
  else if (key === "g" && !state.paused) state.flight.toggleGear();
  else if (key === "l" && !state.paused) state.flight.lightsOn = !state.flight.lightsOn;
  else if (key === "r") startFlight();
  else if (key === "escape") showMenu();
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => {
  if (state.flight && !gamePanel.hidden) {
    clearInput();
    setPaused(true);
  }
});

scene.addEventListener("pointermove", (event) => {
  if (state.flight && state.mouseEnabled) {
    const rect = scene.getBoundingClientRect();
    mouse.x = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width * 0.35), -1, 1);
    mouse.y = clamp((rect.height / 2 - (event.clientY - rect.top)) / (rect.height * 0.35), -1, 1);
  }
});
scene.addEventListener("wheel", (event) => {
  if (state.flight && !state.paused) {
    event.preventDefault();
    state.flight.throttle = clamp(state.flight.throttle - Math.sign(event.deltaY) * 0.05, 0, 1);
  }
}, { passive: false });

scene.addEventListener("click", (event) => {
  if (!state.flight || state.external || state.paused) return;
  const rect = scene.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (y < 0.79 + 0.21 * 0.08 || y > 0.79 + 0.21 * 0.27) return;
  if (Math.abs(x - 0.69) < 0.045) state.flight.toggleGear();
  else if (Math.abs(x - 0.8) < 0.045) state.flight.lightsOn = !state.flight.lightsOn;
  else if (Math.abs(x - 0.91) < 0.045) toggleMouseSteering();
});

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
function viewPlanes() {
  return [
    (p) => p[2] - 1,
    (p) => p[2] * width / 2 + p[0] * focal,
    (p) => p[2] * width / 2 - p[0] * focal,
    (p) => p[2] * height / 2 + p[1] * focal,
    (p) => p[2] * height / 2 - p[1] * focal,
  ];
}
function clipped(points) {
  let result = points;
  for (const plane of viewPlanes()) result = clipPolygon(result, plane);
  return result;
}
function polygon(points, color) {
  const cameraPoints = points.map(cameraPoint);
  if (cameraPoints.every((p) => p[2] < 1) || cameraPoints.every((p) => p[2] > 50000)) return;
  const projectedPoints = clipped(cameraPoints);
  if (projectedPoints.length < 3) return;
  context.beginPath();
  projectedPoints.forEach((point, index) => {
    const [x, y] = project(point);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = color;
  context.fill();
}
function groundLine(first, second, color, lineWidth = 1) {
  let a = cameraPoint(first);
  let b = cameraPoint(second);
  for (const plane of viewPlanes()) {
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
  context.strokeStyle = color;
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
  const label = cameraPoint([...airportPosition(airport), 35]);
  if (label[2] > 1) {
    const [x, y] = project(label);
    context.fillStyle = "#fff";
    context.font = "bold 13px system-ui";
    context.textAlign = "center";
    context.fillText(airport.code, x, y);
  }
}
function drawPlane(flight) {
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
      flight.z + (flight.aircraft === AIRCRAFT[0] ? 1.5 : 3.3) + up,
    ];
  };
  return aircraftSurfaces(flight.aircraft, flight.gear, flight.time, flight.enginePower)
    .map(([points, color]) => [points.map(world), color]);
}

function setCamera(flight) {
  const heading = flight.heading * Math.PI / 180;
  let pitch;
  let bank;
  let eye;
  if (state.external) {
    const distance = flight.aircraft === AIRCRAFT[0] ? 32 : 85;
    const heightAbove = flight.aircraft === AIRCRAFT[0] ? 11 : 28;
    eye = [
      flight.x - Math.sin(heading) * distance,
      flight.y - Math.cos(heading) * distance,
      flight.z + heightAbove,
    ];
    pitch = -12 * Math.PI / 180;
    bank = 0;
  } else {
    eye = [flight.x, flight.y, flight.z + (flight.aircraft === AIRCRAFT[0] ? 2 : 5)];
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
  camera = {
    eye,
    right: right.map((value, i) => value * Math.cos(bank) - up[i] * Math.sin(bank)),
    up: up.map((value, i) => value * Math.cos(bank) + right[i] * Math.sin(bank)),
    forward,
    pitch,
    bank,
  };
}

function drawScene(flight) {
  context.clearRect(0, 0, width, height);
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#83bfdc");
  sky.addColorStop(1, "#e0e9dd");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  setCamera(flight);
  focal = width * (state.external ? 0.75 : 0.58);
  // Match the horizon to the camera's world-space ground intersection.
  const groundScreen = clipPolygon([[0, 0], [width, 0], [width, height], [0, height]], (p) => -(
    camera.right[2] * (p[0] - width / 2) / focal
    + camera.up[2] * (height / 2 - p[1]) / focal + camera.forward[2]));
  context.beginPath();
  groundScreen.forEach(([x, y], i) => {
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = "#528c9c";
  context.fill();
  const { ground, solids: trees } = terrain(flight.x, flight.y);
  const solids = [...trees];
  for (const [points, color] of [...LAND_SURFACES, ...ground, ...region.ground, ...london.ground]) polygon(points, color);
  [...AIRPORTS]
    .map((airport) => [airport, Math.hypot(...airportPosition(airport).map((value, index) => value - [flight.x, flight.y][index]))])
    .filter(([, distance]) => distance < 50000)
    .sort((a, b) => b[1] - a[1])
    .forEach(([airport]) => runway(airport));
  if (state.external) solids.push(...drawPlane(flight));
  solids.push(...london.solids);
  solids.push(...region.solids.filter(([points]) => points.some(
    (p) => Math.hypot(p[0] - flight.x, p[1] - flight.y) < 40000)));
  const depth = ([points]) => points.reduce((sum, p) => sum + cameraPoint(p)[2], 0) / points.length;
  const ordered = solids.map((surface) => [surface, depth(surface)]).sort((a, b) => b[1] - a[1]);
  for (const [[points, color]] of ordered) polygon(points, color);
  if (!state.external) {
    drawCockpit(flight);
  }
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
  for (let i = 0; i < (flight.aircraft === AIRCRAFT[0] ? 1 : 2); i += 1) {
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
  mapContext.clearRect(0, 0, w, h);
  mapContext.fillStyle = "#192d39";
  mapContext.fillRect(0, 0, w, h);
  const positions = AIRPORTS.map(airportPosition).concat([[flight.x, flight.y]]);
  const xs = positions.map((point) => point[0]);
  const ys = positions.map((point) => point[1]);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const scale = Math.min((w - 40) / Math.max(xmax - xmin, 1), (h - 40) / Math.max(ymax - ymin, 1));
  const point = ([x, y]) => [
    w / 2 + (x - (xmin + xmax) / 2) * scale,
    h / 2 - (y - (ymin + ymax) / 2) * scale,
  ];
  mapContext.setLineDash([4, 4]);
  mapContext.strokeStyle = "#e2bb53";
  mapContext.beginPath();
  mapContext.moveTo(...point(airportPosition(flight.departure)));
  mapContext.lineTo(...point(airportPosition(flight.destination)));
  mapContext.stroke();
  mapContext.setLineDash([]);
  for (const airport of AIRPORTS) {
    const [x, y] = point(airportPosition(airport));
    mapContext.fillStyle = "#fff";
    mapContext.beginPath();
    mapContext.arc(x, y, 3, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.fillStyle = "#fff";
    mapContext.font = "9px system-ui";
    mapContext.textAlign = "center";
    mapContext.fillText(airport.code, x, y - 7);
  }
  const [x, y] = point([flight.x, flight.y]);
  mapContext.fillStyle = "#ff8b38";
  mapContext.beginPath();
  mapContext.arc(x, y, 4, 0, Math.PI * 2);
  mapContext.fill();
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
  $("#status-chip").textContent = warning || `${flight.aircraft.name} · ${flight.departure.code} → ${flight.destination.code} · ${state.external ? "External" : "Cockpit"}`;
  $("#status-chip").classList.toggle("warning", Boolean(warning));
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
      flight.update(dt, elevator, aileron, axis(["e"], ["q"]), keys.has(" "));
    }
    drawScene(flight);
    drawMap(flight);
    formatTelemetry(flight);
  }
  requestAnimationFrame(frame);
}

setFlightButtons(false);
resizeCanvases();
requestAnimationFrame(frame);
