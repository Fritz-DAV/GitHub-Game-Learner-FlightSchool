import test from "node:test";
import assert from "node:assert/strict";
import { aircraftCondition, componentCondition, conditionColor, drawAircraftCondition, drawAltitudeChart, drawSummaryMap, formatDistance, formatDuration } from "../browser/summary.mjs";
import { flyToArrival } from "./arrival_helper.mjs";

test("summary map and altitude chart draw inside their canvases", () => {
  const f = flyToArrival();
  const summary = f.summary();
  let path = [];
  const texts = [];
  const ctx = {
    clearRect() {}, fillRect() {}, closePath() {}, stroke() {}, arc() {}, setLineDash() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    fillText(text) { texts.push(text); },
    fill() {
      for (const [x, y] of path) assert.ok(x >= -1e-6 && x <= 400 + 1e-6 && y >= -1e-6 && y <= 200 + 1e-6, `${x},${y}`);
    },
  };
  drawSummaryMap(ctx, 400, 200, summary, f);
  assert.ok(texts.includes("EGLL") && texts.includes("EGSS"));
  drawAltitudeChart(ctx, 400, 200, summary);
  assert.ok(texts.some((text) => text.endsWith(" ft")));
  assert.equal(formatDuration(125), "2 min 05 s");
  assert.equal(formatDistance(1500), "1500 m");
  assert.equal(formatDistance(25400), "25.4 km");
});

test("aircraft condition rates parts from damage and never drops below zero", () => {
  assert.deepEqual(aircraftCondition([]), { integrity: 100, wings: 100, engines: 100, wheels: 100 });
  assert.equal(aircraftCondition(["tyres"]).wheels, 60);
  assert.equal(aircraftCondition(["wing"]).wings, 40);
  const wrecked = aircraftCondition(["gear", "nose_gear", "belly", "terrain", "wing", "tail"]);
  assert.ok(Object.values(wrecked).every((value) => value >= 0));
  assert.equal(wrecked.wheels, 0);
  assert.deepEqual(aircraftCondition(["unknown"]), aircraftCondition([]));
});

test("condition colour runs from white to red", () => {
  assert.equal(conditionColor(100), "rgb(255, 255, 255)");
  assert.equal(conditionColor(0), "rgb(255, 0, 0)");
  assert.equal(conditionColor(-20), "rgb(255, 0, 0)");
  const mid = Number(conditionColor(50).match(/\d+/g)[1]);
  assert.ok(mid > 100 && mid < 150);
});

test("aircraft condition drawing colours sections by damage", () => {
  const fills = new Set();
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillStyle" ? target.fillStyle : () => {}),
    set: (target, name, value) => { if (name === "fillStyle") fills.add(value); target[name] = value; return true; },
  });
  const parts = componentCondition(["nose_gear", "wing"], {}, -1);
  drawAircraftCondition(ctx, 100, 100, { integrity: 100, wings: 40, engines: 100, wheels: 0 }, parts);
  assert.ok(fills.has(conditionColor(100)) && fills.has(conditionColor(parts.leftWing)) && fills.has(conditionColor(parts.noseWheel)));
});

test("damage severity scales the loss and picks the affected components", () => {
  assert.equal(aircraftCondition(["wing"], { wing: 0.5 }).wings, 70);
  const parts = componentCondition(["wing", "tyres"], { wing: 1, tyres: 0.5 }, -1);
  assert.equal(parts.leftWing, 40);
  assert.equal(parts.rightWing, 100);
  assert.equal(parts.leftEngine, 100);
  assert.equal(parts.leftWheel, 80);
  assert.equal(parts.rightWheel, 100);
  assert.equal(componentCondition(["overspeed"], {}, 1).rightWing, 70);
});

test("overspeed and stall stress are recorded as graded airframe damage", () => {
  const f = flyToArrival();
  f.overspeedTime = 5;
  f.stallTime = 10;
  f.assessStress();
  assert.equal(f.damageSeverity.overspeed, 0.5);
  assert.ok(f.damageSeverity.stall > 0.4 && f.damageSeverity.stall < 0.5);
  assert.ok(f.damage.some((text) => text.startsWith("Overspeed")));
  assert.ok(f.damageLog.every((entry) => entry.label && entry.time >= 0));
  assert.equal(f.unflyable, false);
});

test("a harder touchdown records a greater gear severity", () => {
  const sev = (sink) => {
    const f = flyToArrival();
    f.damageKinds = []; f.damageSeverity = {}; f.damageLog = []; f.crashed = false; f.completed = false;
    f.onGround = false; f.z = 0.5; f.vz = -sink; f.gear = 1; f.pitch = 3; f.bank = 0;
    f.touchdown();
    return f.damageSeverity.gear ?? 0;
  };
  assert.ok(sev(7) > sev(5.5));
  assert.ok(sev(5.5) > 0);
});
