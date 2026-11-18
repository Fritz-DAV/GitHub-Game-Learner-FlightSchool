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
    assert.ok(Math.abs(span - [11, 36.5, 36.5][i]) < 1e-8);
    const length = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    assert.ok(Math.abs(length - [8.3, 39.5, 37.6][i]) < 0.1);
    const wheels = (mesh) => mesh.filter(([, color]) => color === "#20272c").flatMap(([p]) => p);
    assert.ok(Math.abs(Math.min(...wheels(down).map((p) => p[2])) + (i === 0 ? 1.5 : 3.3)) < 0.03);
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

test("browser UI renders every aircraft and route in both views without off-screen geometry", async () => {
  let polygons = 0;
  let path = [];
  let rectangles = [];
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
    fillText() {},
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
    getBoundingClientRect() { return { width: 1100, height: 760 }; }
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
    globalThis.document = { querySelector: get, querySelectorAll: () => [] };
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
        assert.equal(levers.length, aircraft === AIRCRAFT[0] ? 1 : 2);
        movedLevers.forEach((lever, i) => assert.ok(lever.args[1] < levers[i].args[1]));
        for (const key of ["d", "s", "+"]) windowEvents.keyup({ key });
        windowEvents.keydown({ key: "p", preventDefault() {} });
        windowEvents.keyup({ key: "p" });
        rectangles = [];
        frame(performance.now() + 200);
        assert.deepEqual(rectangles.find((r) => r.color === "#111a21").args, moved);
      }
    }
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
