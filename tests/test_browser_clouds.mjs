import test from "node:test";
import assert from "node:assert/strict";
import { cloudCover, cloudDrift, cloudSurfaces } from "../browser/clouds.mjs";

const flight = (time) => ({ windFrom: 270, windSpeed: 4, time });

test("cloud field is deterministic, 3D, shaded and sits above the airfield", () => {
  const eye = [0, 0, 2500];
  const counts = [0, 300, 900, 2000].map((t) => cloudSurfaces(eye, cloudDrift(flight(t))).length);
  assert.ok(counts.filter((n) => n > 100).length >= 3);
  assert.ok(Math.max(...counts) < 6000, "cloud draw budget");
  const first = cloudSurfaces(eye, cloudDrift(flight(900)));
  assert.deepEqual(first, cloudSurfaces(eye, cloudDrift(flight(900))));
  const heights = first.flatMap(([points]) => points.map((p) => p[2]));
  assert.ok(Math.max(...heights) - Math.min(...heights) > 1000);
  assert.ok(Math.min(...heights) > 300);
  assert.ok(new Set(first.map(([, color]) => color)).size > 5);
});

test("clouds drift downwind over time", () => {
  const [dx, dy] = cloudDrift(flight(100));
  assert.ok(dx > 600 && Math.abs(dy) < 1e-6);
  const cover = (x, y, t) => cloudCover(x, y, cloudDrift(flight(t)));
  assert.equal(cover(1000, 2000, 0), cover(1000 + dx, 2000, 100));
  const values = Array.from({ length: 200 }, (_, i) => cover(i * 9000, i * 4000, 0));
  assert.ok(values.some((v) => v > 0.55) && values.some((v) => v < 0.45));
});

test("cumulus and high cloud are visible from typical climb and cruise positions", () => {
  const counts = [];
  for (const x of [-80000, 0, 40000, 120000]) {
    for (const y of [0, 30000, 90000]) {
      for (const z of [1000, 2000, 3000]) {
        for (const t of [0, 400, 1500]) {
          counts.push(cloudSurfaces([x, y, z], cloudDrift(flight(t))).length);
        }
      }
    }
  }
  const sorted = [...counts].sort((a, b) => a - b);
  assert.ok(sorted[Math.floor(sorted.length * 0.1)] >= 300, `10th percentile ${sorted[Math.floor(sorted.length * 0.1)]}, min ${sorted[0]}`);
  assert.ok(sorted.at(-1) < 12000, `max ${sorted.at(-1)}`);
});
