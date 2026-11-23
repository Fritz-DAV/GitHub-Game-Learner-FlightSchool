import test from "node:test";
import assert from "node:assert/strict";

import {
  AIRCRAFT, AIRPORTS, Flight, airportPosition, runwayContains, clampLook, nextTimeScale,
} from "../browser/flight-model.mjs";

test("each aircraft starts on each airport's runway", () => {
  for (const aircraft of AIRCRAFT) {
    for (const airport of AIRPORTS) {
      const flight = new Flight(aircraft, airport);
      assert.equal(runwayContains(airport, flight.x, flight.y), true);
      assert.equal(flight.heading, airport.runwayHeading);
    }
  }
});

test("idle aircraft stays on the runway", () => {
  const flight = new Flight(AIRCRAFT[0], AIRPORTS[0], AIRPORTS[1], 0);
  for (let i = 0; i < 120; i += 1) flight.update(1 / 60);
  assert.equal(flight.z, 0);
  assert.equal(flight.groundSpeed, 0);
});

test("throttle accelerates and heading follows the runway", () => {
  const flight = new Flight(AIRCRAFT[0], AIRPORTS[0], AIRPORTS[1], 0);
  flight.throttle = 1;
  for (let i = 0; i < 600; i += 1) flight.update(1 / 60);
  assert.ok(flight.groundSpeed > 10);
  assert.equal(flight.heading, AIRPORTS[0].runwayHeading);
});

test("all aircraft can take off", () => {
  for (const aircraft of AIRCRAFT) {
    const flight = new Flight(aircraft, AIRPORTS[0], AIRPORTS[1], 0);
    flight.throttle = 1;
    for (let i = 0; i < 3600 && flight.z <= 10; i += 1) {
      const rotationSpeed = aircraft === AIRCRAFT[0] ? 28 : 65;
      const elevator = flight.airspeed > rotationSpeed && flight.pitch < 8 ? 0.4 : 0;
      flight.update(1 / 60, elevator);
    }
    assert.ok(flight.z > 10, aircraft.name);
    assert.equal(flight.crashed, false);
  }
});

test("a gentle destination runway touchdown completes the flight", () => {
  const flight = new Flight(AIRCRAFT[0], AIRPORTS[0], AIRPORTS[1], 0);
  [flight.x, flight.y] = airportPosition(AIRPORTS[1]);
  flight.heading = AIRPORTS[1].runwayHeading + 180;
  flight.z = 0.01;
  flight.vz = -1;
  flight.vx = 30;
  flight.onGround = false;
  flight.update(0.02);
  assert.equal(flight.completed, true);
  assert.equal(flight.crashed, false);
});

test("angular inertia, control animation state and engine spool differ by aircraft", () => {
  const responses = AIRCRAFT.map((aircraft) => {
    const f = new Flight(aircraft, AIRPORTS[0], AIRPORTS[1], 0);
    f.onGround = false;
    f.z = 1000;
    f.vx = 70;
    f.throttle = 1;
    f.update(0.1, 1, 1, 1);
    assert.ok(f.pitch > 0 && f.pitch < 0.2);
    assert.ok(f.bank > 0 && f.bank < 0.5);
    assert.ok(f.enginePower > 0 && f.enginePower < 0.2);
    assert.deepEqual([f.elevator, f.aileron, f.rudder], [1, 1, 1]);
    const before = f.bank;
    const rate = f.rollRate;
    f.update(0.1);
    assert.ok(f.bank > before);
    assert.ok(f.rollRate > 0 && f.rollRate < rate);
    assert.equal(f.aileron, 0);
    return [f.pitch, f.enginePower];
  });
  assert.ok(responses[0][0] > responses[1][0] * 2);
  assert.ok(responses[0][1] > responses[1][1] * 3);
});

test("stationary controls do not rotate the plane and engines spool down", () => {
  const f = new Flight(AIRCRAFT[0], AIRPORTS[0], AIRPORTS[1], 0);
  f.update(0.25, 1, 1);
  assert.equal(f.pitch, 0);
  assert.equal(f.bank, 0);
  f.enginePower = 1;
  f.update(0.1);
  assert.ok(f.enginePower > 0.8 && f.enginePower < 1);
});

test("fixed gear and ground locks are enforced; jet gear takes five seconds each way", () => {
  for (const aircraft of AIRCRAFT) {
    const f = new Flight(aircraft, AIRPORTS[0], AIRPORTS[1], 0);
    f.toggleGear();
    assert.equal(f.gearDown, true);
    f.onGround = false;
    f.z = 1000;
    f.vx = f.retractableGear ? 100 : 50;
    f.toggleGear();
    if (!f.retractableGear) {
      f.update(0.25);
      assert.equal(f.gear, 1);
      continue;
    }
    for (let i = 0; i < 10; i += 1) f.update(0.25);
    assert.ok(Math.abs(f.gear - 0.5) < 1e-10);
    for (let i = 0; i < 10; i += 1) f.update(0.25);
    assert.ok(f.gear < 1e-10);
    f.toggleGear();
    for (let i = 0; i < 20; i += 1) f.update(0.25);
    assert.ok(Math.abs(f.gear - 1) < 1e-10);
    assert.equal(f.crashed, false);
  }
});

test("gear adds drag and landing without fully extended gear fails for both jets", () => {
  for (const aircraft of AIRCRAFT.slice(1)) {
    const flights = [0, 1].map((gear) => {
      const f = new Flight(aircraft, AIRPORTS[0], AIRPORTS[1], 0);
      f.onGround = false;
      f.z = 1000;
      f.vx = 100;
      f.gear = gear;
      f.gearDown = Boolean(gear);
      f.update(0.1);
      return f;
    });
    assert.ok(flights[0].vx > flights[1].vx);
    for (const gear of [0, 0.5, 0.98, 1]) {
      const f = new Flight(aircraft, AIRPORTS[0], AIRPORTS[1], 0);
      [f.x, f.y] = airportPosition(f.destination);
      f.heading = f.destination.runwayHeading;
      f.z = 0.01;
      f.vz = -1;
      f.vx = 65;
      f.onGround = false;
      f.gear = gear;
      f.gearDown = gear === 1;
      f.update(0.02);
      assert.equal(f.completed, gear === 1);
      assert.equal(f.crashed, false);
      assert.deepEqual(f.damageKinds, gear === 1 ? [] : ["belly"]);
    }
  }
});

function landing() {
  const f = new Flight(AIRCRAFT[0], AIRPORTS[0], AIRPORTS[1], 0);
  [f.x, f.y] = airportPosition(f.destination);
  f.heading = f.destination.runwayHeading;
  [f.z, f.vz, f.vx] = [0.01, -1, 30];
  f.onGround = false;
  return f;
}

test("hard landings cause specific damage instead of ending the flight", () => {
  const cases = [["vz", -4, ["tyres"]], ["vz", -6, ["gear", "tyres"]], ["bank", 30, ["wing"]],
    ["vx", 60, ["tyres"]], ["pitch", 20, ["tail"]], ["pitch", -8, ["nose_gear"]],
    ["heading", 110, ["tyres"]], ["x", 1e6, ["terrain"]]];
  for (const [attribute, value, kinds] of cases) {
    const f = landing();
    f[attribute] = value;
    f.update(0.02);
    assert.equal(f.crashed, false, attribute);
    assert.equal(f.completed, false);
    assert.deepEqual([...f.damageKinds].sort(), [...kinds].sort(), `${attribute} ${value}`);
    assert.match(f.message, /WARNING/);
    for (const text of f.damage) assert.ok(f.message.includes(text));
  }
});

test("catastrophic landings crash and report damage", () => {
  for (const [attribute, value] of [["vz", -9], ["bank", 50], ["heading", 0]]) {
    const f = landing();
    f[attribute] = value;
    f.update(0.02);
    assert.equal(f.crashed, true, attribute);
    assert.match(f.message, /CRASH/);
  }
  const f = landing();
  f.vz = -9;
  f.update(0.02);
  assert.ok(f.message.includes("Landing gear collapsed"));
});

test("damaged aircraft slow down, cannot fly again and arrive only once stopped", () => {
  const clean = landing();
  const broken = landing();
  broken.vz = -6;
  for (const f of [clean, broken]) {
    f.update(0.02);
    for (let i = 0; i < 240; i += 1) f.update(0.25 / 30);
  }
  assert.ok(broken.groundSpeed < clean.groundSpeed);
  broken.throttle = 1;
  for (let i = 0; i < 1800; i += 1) broken.update(1 / 30, 1);
  assert.equal(broken.z, 0);
  assert.equal(broken.unflyable, true);
  const tyres = landing();
  tyres.vz = -4;
  tyres.update(0.02);
  assert.equal(tyres.completed, false);
  for (let i = 0; i < 1800; i += 1) tyres.update(1 / 30, 0, 0, 0, true);
  assert.equal(tyres.completed, true);
  assert.match(tyres.message, /Tyres burst/);
});

test("tail strike on over-rotation is reported", () => {
  const f = new Flight(AIRCRAFT[1], AIRPORTS[0], AIRPORTS[1], 0);
  f.vx = f.vy = 20;
  f.pitch = 20;
  f.update(0.02);
  assert.deepEqual(f.damageKinds, ["tail"]);
  assert.match(f.message, /tail strike/);
});

test("Concorde takes off fast and reaches supersonic speed without damage", () => {
  const f = new Flight(AIRCRAFT[3], AIRPORTS[0], AIRPORTS[1], 0, 270, false);
  f.throttle = 1;
  let liftoff = null;
  for (let i = 0; i < 30 * 400; i += 1) {
    const target = f.z < 1500 ? 12 : Math.max(2, Math.min(10, (15000 - f.z) / 200));
    const elevator = f.airspeed > 95 ? 0.5 * clampUnit((target - f.pitch) / 4) : 0;
    if (f.z > 300 && f.gearDown) f.toggleGear();
    f.update(1 / 30, elevator);
    if (liftoff === null && !f.onGround) liftoff = f.airspeed;
  }
  assert.equal(f.crashed, false);
  assert.deepEqual(f.damageKinds, []);
  assert.ok(liftoff > 90 && liftoff < 130);
  assert.ok(f.mach > 1.1);
});

const clampUnit = (v) => Math.max(-1, Math.min(1, v));

test("look angles wrap yaw and limit pitch; fast-forward cycles 1x to 8x", () => {
  assert.deepEqual(clampLook(190, 0), [-170, 0]);
  assert.deepEqual(clampLook(-190, 0), [170, 0]);
  assert.deepEqual(clampLook(0, 120), [0, 80]);
  assert.deepEqual(clampLook(0, -120), [0, -80]);
  let scale = 1;
  const seen = [];
  for (let i = 0; i < 5; i += 1) seen.push(scale = nextTimeScale(scale));
  assert.deepEqual(seen, [2, 4, 8, 1, 2]);
});
