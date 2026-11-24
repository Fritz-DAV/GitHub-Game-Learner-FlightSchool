import test from "node:test";
import assert from "node:assert/strict";
import {
  FOG_CHANCE, hazeSettings, nightColor, nightLights, resolveFog, resolveNight, skyStops,
} from "../browser/environment.mjs";

test("fog only appears when chosen, or occasionally for random flights", () => {
  assert.equal(resolveFog("clear", () => 0), false);
  assert.equal(resolveFog("foggy", () => 0.99), true);
  assert.equal(resolveFog("random", () => FOG_CHANCE - 0.01), true);
  assert.equal(resolveFog("random", () => FOG_CHANCE + 0.01), false);
  assert.equal(hazeSettings({ foggy: false, night: false }), null);
  assert.ok(hazeSettings({ foggy: true, night: true }).alpha > 0.5);
});

test("time of day follows the menu choice, with night chosen only sometimes at random", () => {
  assert.equal(resolveNight("day", () => 0), false);
  assert.equal(resolveNight("night", () => 0.99), true);
  assert.equal(resolveNight("random", () => 0.01), true);
  assert.equal(resolveNight("random", () => 0.9), false);
});

test("night darkens the sky and ground while built-up areas keep a warm glow", () => {
  const brightness = (color) => nightColor(color).match(/\d+/g).map(Number).reduce((a, b) => a + b);
  assert.ok(brightness("#528c9c") < 150);
  const [top] = skyStops({ foggy: false, night: true });
  assert.ok(parseInt(top[1].slice(1, 3), 16) < 20);
  const [r, , b] = nightColor("#8b9172").match(/\d+/g).map(Number);
  assert.ok(r > b);
});

test("night lights cover cities, motorways and runways", () => {
  const lights = nightLights();
  const count = (colour) => lights.filter((light) => light[3] === colour).length;
  assert.ok(count(0) > 1000, "city lights");
  assert.ok(count(3) > 300, "motorway lamps");
  assert.ok(count(5) > 20 && count(6) > 20, "runway threshold and end lights");
  assert.ok(lights.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});
