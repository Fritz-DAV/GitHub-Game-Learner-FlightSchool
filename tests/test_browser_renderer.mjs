import test from "node:test";
import assert from "node:assert/strict";
import { AIRCRAFT, AIRPORTS } from "../browser/flight-model.mjs";
import { aircraftSurfaces } from "../browser/aircraft-visuals.mjs";

test("distinct aircraft have representative spans, ground-level wheels and retracting jet gear", () => {
  const meshes = AIRCRAFT.map((aircraft, i) => {
    const down = aircraftSurfaces(aircraft, 1);
    const up = aircraftSurfaces(aircraft, 0);
    const points = down.flatMap(([p]) => p);
    const span = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    assert.ok(Math.abs(span - [11, 36.5, 36.5, 25.6][i]) < 1e-8);
    const length = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    assert.ok(Math.abs(length - [8.3, 39.5, 37.6, 61.7][i]) < 0.1);
    const wheels = (mesh) => mesh.filter(([, color]) => color === "#20272c").flatMap(([p]) => p);
    assert.ok(Math.abs(Math.min(...wheels(down).map((p) => p[2])) + aircraft.datum) < 0.03);
    if (i === 0) assert.deepEqual(down, up);
    else {
      assert.equal(wheels(up).length, 0);
      const transit = aircraftSurfaces(aircraft, 0.5);
      assert.ok(Math.min(...wheels(transit).map((p) => p[2])) > Math.min(...wheels(down).map((p) => p[2])));
    }
    return down;
  });
  assert.notDeepEqual(meshes[1], meshes[2]);
});

test("damaged landing gear and tyres change the aircraft model", () => {
  for (const aircraft of AIRCRAFT) {
    const healthy = aircraftSurfaces(aircraft, 1);
    const wheels = (mesh) => mesh.filter(([, color]) => color === "#20272c").flatMap(([p]) => p);
    const flat = aircraftSurfaces(aircraft, 1, 0, 0, ["tyres"]);
    assert.ok(Math.max(...wheels(flat).map((p) => p[2])) < Math.max(...wheels(healthy).map((p) => p[2])));
    assert.ok(flat.some(([, color]) => color === "#7a2f2f"));
    for (const kind of ["gear", "nose_gear"]) {
      const broken = aircraftSurfaces(aircraft, 1, 0, 0, [kind]);
      assert.notDeepEqual(broken, healthy);
      assert.ok(wheels(broken).some((p) => p[2] < -aircraft.datum + 0.5));
    }
  }
});

test("browser UI renders every aircraft and route in both views without off-screen geometry", async () => {
  let polygons = 0;
  let path = [];
  let rectangles = [];
  const texts = [];
  const context = {
    setTransform() {},
    clearRect() {},
    fillRect(...args) { rectangles.push({ args, color: this.fillStyle }); },
    beginPath() { path = []; },
    closePath() {},
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    fill() {
      polygons += 1;
      for (const [x, y] of path) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(x >= -1e-6 && x <= 1100 + 1e-6, `x=${x}`);
        assert.ok(y >= -1e-6 && y <= 760 + 1e-6, `y=${y}`);
      }
    },
    stroke() {},
    fillText(text) { texts.push(text); },
    arc() {},
    setLineDash() {},
    createLinearGradient() { return { addColorStop() {} }; },
  };
  class Element {
    constructor() {
      this.value = "";
      this.options = [];
      this.events = {};
      this.hidden = false;
      this.classList = { toggle() {} };
    }
    add(option) {
      this.options.push(option);
      if (this.options.length === 1) this.value = option.value;
    }
    set selectedIndex(index) { this.value = this.options[index].value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    getContext() { return context; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1100, height: 760 }; }
    focus() {}
  }
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const windowEvents = {};
  let frame;
  const originals = new Map(["document", "window", "Option", "requestAnimationFrame"]
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    const documentEvents = {};
    globalThis.document = {
      querySelector: get,
      querySelectorAll: () => [],
      hidden: false,
      addEventListener(name, callback) { documentEvents[name] = callback; },
    };
    globalThis.window = {
      devicePixelRatio: 1,
      addEventListener(name, callback) { windowEvents[name] = callback; },
    };
    globalThis.Option = class {
      constructor(text, value) { this.text = text; this.value = value; }
    };
    globalThis.requestAnimationFrame = (callback) => { frame = callback; };
    await import("../browser/game.mjs");
    get("#weather").value = "0";
    for (const aircraft of AIRCRAFT) {
      for (const departure of AIRPORTS) {
        for (const destination of AIRPORTS) {
          if (departure === destination) continue;
          get("#aircraft").value = aircraft.name;
          get("#departure").value = departure.code;
          get("#destination").value = destination.code;
          get("#flight-form").events.submit({ preventDefault() {} });
          for (const key of ["1", "2"]) {
            windowEvents.keydown({ key, preventDefault() {} });
            windowEvents.keyup({ key });
            polygons = 0;
            frame(performance.now());
            assert.ok(polygons > 20);
            assert.ok(texts.some((text) => text.startsWith(`${destination.code} runway: `)));
          }
        }
        windowEvents.keydown({ key: "1", preventDefault() {} });
        windowEvents.keyup({ key: "1" });
        rectangles = [];
        frame(performance.now());
        const grip = rectangles.find((r) => r.color === "#111a21").args;
        const levers = rectangles.filter((r) => r.color === "#dde0d6");
        for (const key of ["d", "s", "+"]) windowEvents.keydown({ key, preventDefault() {} });
        rectangles = [];
        frame(performance.now() + 100);
        const moved = rectangles.find((r) => r.color === "#111a21").args;
        const movedLevers = rectangles.filter((r) => r.color === "#dde0d6");
        assert.ok(moved[0] > grip[0] && moved[1] > grip[1]);
        assert.equal(levers.length, aircraft.engines);
        movedLevers.forEach((lever, i) => assert.ok(lever.args[1] < levers[i].args[1]));
        for (const key of ["d", "s", "+"]) windowEvents.keyup({ key });
        windowEvents.keydown({ key: "p", preventDefault() {} });
        windowEvents.keyup({ key: "p" });
        rectangles = [];
        frame(performance.now() + 200);
        assert.deepEqual(rectangles.find((r) => r.color === "#111a21").args, moved);
      }
    }

    // Click-drag look-around, fast-forward and background running.
    const startFlight = (aircraft) => {
      get("#aircraft").value = aircraft.name;
      get("#departure").value = AIRPORTS[0].code;
      get("#destination").value = AIRPORTS[1].code;
      get("#flight-form").events.submit({ preventDefault() {} });
    };
    const key = (name) => {
      windowEvents.keydown({ key: name, preventDefault() {} });
      windowEvents.keyup({ key: name });
    };
    const pointer = (name, x, y) => get("#scene").events[name]({ clientX: x, clientY: y, pointerId: 1 });
    const speedText = () => get("#airspeed").textContent;
    startFlight(AIRCRAFT[1]);
    for (const view of ["1", "2"]) {
      key(view);
      for (const [dx, dy] of [[0, 0], [300, 0], [-700, 0], [0, 900], [0, -900], [2000, 1000]]) {
        pointer("pointerdown", 500, 300);
        pointer("pointermove", 500 + dx, 300 + dy);
        pointer("pointerup", 500 + dx, 300 + dy);
        polygons = 0;
        frame(performance.now());
        assert.ok(polygons > 5, `view ${view} drag ${dx},${dy}`);
      }
      key("c");
      polygons = 0;
      frame(performance.now());
      assert.ok(polygons > 20);
    }
    // A drag never presses a cockpit button; a short click on one still does.
    startFlight(AIRCRAFT[1]);
    key("1");
    const [gearX, gearY] = [1100 * 0.69, 760 * 0.79 + 27];
    pointer("pointerdown", gearX, gearY);
    pointer("pointermove", gearX + 60, gearY);
    pointer("pointerup", gearX + 60, gearY);
    frame(performance.now());
    assert.equal(get("#flight-message").textContent.includes("locked"), false);
    pointer("pointerdown", gearX, gearY);
    pointer("pointerup", gearX, gearY);
    frame(performance.now());
    assert.equal(get("#flight-message").textContent.includes("locked"), true);

    const speeds = [];
    for (const presses of [0, 3]) {
      startFlight(AIRCRAFT[0]);
      for (let i = 0; i < presses; i += 1) key("f");
      windowEvents.keydown({ key: "+", preventDefault() {} });
      const start = performance.now();
      for (let i = 1; i <= 40; i += 1) frame(start + i * 50);
      windowEvents.keyup({ key: "+" });
      speeds.push(parseInt(speedText(), 10));
    }
    assert.ok(speeds[1] > speeds[0], `8x ${speeds[1]} vs 1x ${speeds[0]}`);
    const labels = [];
    startFlight(AIRCRAFT[0]);
    for (let i = 0; i < 4; i += 1) {
      key("f");
      labels.push(get("#speed-button").textContent);
    }
    assert.deepEqual(labels, ["Speed: 2x", "Speed: 4x", "Speed: 8x", "Speed: 1x"]);

    startFlight(AIRCRAFT[0]);
    windowEvents.blur();
    assert.equal(get("#pause-button").textContent, "Pause");
    globalThis.document.hidden = true;
    documentEvents.visibilitychange();
    assert.equal(get("#pause-button").textContent, "Resume");
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
