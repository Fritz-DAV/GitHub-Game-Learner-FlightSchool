import test from "node:test";
import assert from "node:assert/strict";
import { drawAltitudeChart, drawSummaryMap, formatDistance, formatDuration } from "../browser/summary.mjs";
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
