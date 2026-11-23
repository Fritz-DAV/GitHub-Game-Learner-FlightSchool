import test from "node:test";
import assert from "node:assert/strict";
import { AIRPORTS, airportPosition, runwayContains } from "../browser/flight-model.mjs";
import {
  CITY_OUTLINES, HILLS, airportClear, coarseTerrain, clipPolygon, geographic, heathrowScenery, inCity, isLand, regionalScenery, terrain,
} from "../browser/scenery.mjs";

test("coastlines put all airports on land and leave the Channel free of fields", () => {
  for (const airport of AIRPORTS) assert.equal(isLand(...airportPosition(airport)), true, airport.code);
  const sea = geographic(1.5, 51.2);
  assert.equal(isLand(...sea), false);
  assert.equal(inCity(...sea), false);
  assert.equal(inCity(...geographic(-0.12, 51.51)), true);
  for (const [points] of terrain(...sea).ground) {
    assert.ok(points.every(([x, y]) => isLand(x, y)));
  }
});

test("city blocks, motorway carriageways and geographically placed relief are generated", () => {
  const { ground, solids } = regionalScenery();
  const roads = ground.filter(([, color]) => color === "#666b69");
  assert.ok(roads.length > 20);
  assert.ok(ground.some(([, color]) => color === "#b0b295"));
  for (const [[a, b]] of roads) {
    const width = Math.hypot(...a.map((value, i) => value - b[i]));
    assert.ok(Math.abs(width - (width > 20 ? 32 : 14)) < 1e-8);
  }
  assert.ok(solids.filter(([, color]) => color === "#916d58").length > 500);
  for (const [lon, lat, height] of HILLS) {
    const [x, y] = geographic(lon, lat);
    assert.ok(isLand(x, y));
    assert.ok(solids.some(([points]) => points.some((p) => Math.abs(p[0] - x) < 3000
      && Math.abs(p[1] - y) < 1 && p[2] === height)));
  }
});

test("trees stay fixed across cell changes and avoid airport grounds", () => {
  const [x, y] = airportPosition(AIRPORTS[0]);
  const { solids } = terrain(x, y);
  assert.ok(solids.length > 0);
  const roofs = solids.filter(([points, color]) => color === "#71533b"
    && new Set(points.map((p) => p[2])).size === 1).map(([points]) => points);
  for (const points of roofs) {
    assert.ok(airportClear(points.reduce((sum, p) => sum + p[0], 0) / 4,
      points.reduce((sum, p) => sum + p[1], 0) / 4));
  }
  const shifted = new Set(terrain(x + 800, y).solids.map(([points]) => JSON.stringify(points)));
  assert.ok(roofs.filter((points) => shifted.has(JSON.stringify(points))).length > roofs.length / 2);
  for (const airport of AIRPORTS) assert.equal(airportClear(...airportPosition(airport)), false);
});

test("Heathrow has terminals clear of runway, a joined Thames and a 135m Eye", () => {
  const { ground, solids } = heathrowScenery();
  const river = ground.filter(([, color]) => color === "#468b9e");
  river.slice(1).forEach(([b], i) => {
    assert.deepEqual(river[i][0][2], b[1]);
    assert.deepEqual(river[i][0][3], b[0]);
  });
  const roofs = solids.filter(([points, color]) => color === "#b8c5c6" && points.every((p) => p[2] === 24));
  assert.equal(roofs.length, 3);
  for (const [points] of roofs) {
    for (const [x, y] of points) assert.equal(runwayContains(AIRPORTS[0], x, y), false);
  }
  const wheel = solids.filter(([, color]) => color === "#e4e6df").flatMap(([points]) => points);
  assert.equal(Math.max(...wheel.map((p) => p[2])), 135);
});

test("horizon and near clipping retain only the correct half-space", () => {
  const screen = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const clipped = clipPolygon(screen, (p) => p[1] - p[0] - 20);
  assert.equal(clipped.length, 3);
  assert.ok(clipped.every(([x, y]) => y >= x + 20));
  assert.deepEqual(clipPolygon(screen, () => -1), []);
  const near = clipPolygon([[0, 0, -2], [1, 0, 2], [0, 1, 2]], (p) => p[2] - 1);
  assert.ok(near.every((p) => p[2] >= 1));
});

test("cities use star-shaped outlines that are not ellipses, with London and Paris hand-shaped", () => {
  assert.equal(CITY_OUTLINES.length, 15);
  for (const city of CITY_OUTLINES) {
    const [cx, cy] = city.centre;
    const angles = city.points.map(([x, y]) => Math.atan2(y - cy, x - cx));
    const turns = angles.map((a, i) => {
      const d = angles[(i + 1) % angles.length] - a;
      return Math.sign(Math.atan2(Math.sin(d), Math.cos(d)));
    });
    assert.ok(turns.every((t) => t === turns[0]), `${city.name} should wind around its centre`);
    const radii = city.points.map(([x, y]) => Math.hypot(x - cx, y - cy));
    assert.ok(Math.max(...radii) / Math.min(...radii) > 1.2, `${city.name} should not be round`);
    assert.equal(inCity(cx, cy) || city.name === "Dover" || city.name === "Calais" || city.name === "Southend", true);
  }
  const london = CITY_OUTLINES[0];
  assert.ok(london.points.length > 20);
  // Beyond the outline but inside the old circular radius.
  assert.equal(inCity(london.centre[0] - london.radius * 0.9, london.centre[1] + london.radius * 0.9), false);
});

test("coarse terrain reaches well beyond the detailed tiles and stays on land", () => {
  const [x, y] = airportPosition(AIRPORTS[0]);
  const ground = coarseTerrain(x, y, 22);
  assert.ok(ground.length > 200);
  assert.ok(ground.some(([points]) => Math.hypot(points[0][0] - x, points[0][1] - y) > 40000));
  for (const [points] of ground) assert.ok(points.every(([a, b]) => isLand(a, b)));
});

test("start-up scenery builds quickly so the setup form is not blocked", () => {
  const start = performance.now();
  regionalScenery();
  heathrowScenery();
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1500, `scenery took ${Math.round(elapsed)} ms`);
});
