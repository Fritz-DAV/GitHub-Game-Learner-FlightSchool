import math
import unittest

from flight_model import AIRPORTS
from scenery import (
    HILLS, airport_clear, clip_polygon, geographic, heathrow_scenery, in_city,
    is_land, regional_scenery, terrain,
)


class SceneryTests(unittest.TestCase):
    def test_geography_keeps_airports_on_land_and_the_channel_clear(self):
        for airport in AIRPORTS:
            self.assertTrue(is_land(*airport.position), airport.code)
        sea = geographic(1.5, 51.2)
        self.assertFalse(is_land(*sea))
        ground, solids = terrain(*sea)
        for points, _ in ground:
            self.assertTrue(all(is_land(x, y) for x, y, _ in points))
        self.assertFalse(any(abs(p[0] - sea[0]) < 300 and abs(p[1] - sea[1]) < 300
                             for points, _ in solids for p in points))
        self.assertTrue(in_city(*geographic(-0.12, 51.51)))
        self.assertFalse(in_city(*sea))

    def test_cities_motorways_and_relief_have_visible_geometry(self):
        ground, solids = regional_scenery()
        carriageways = [p for p, color in ground if color == "#666b69"]
        medians = [p for p, color in ground if color == "#b0b295"]
        self.assertGreater(len(carriageways), 20)
        self.assertTrue(medians)
        for points in carriageways:
            self.assertAlmostEqual(math.dist(points[0], points[1]), 32
                                   if math.dist(points[0], points[1]) > 20 else 14)
        self.assertGreater(len([1 for _, color in solids if color == "#916d58"]), 500)
        for lon, lat, height, _, _ in HILLS:
            x, y = geographic(lon, lat)
            self.assertTrue(is_land(x, y))
            self.assertTrue(any(abs(p[0] - x) < 3000 and abs(p[1] - y) < 1 and p[2] == height
                                for points, _ in solids for p in points))

    def test_trees_are_stable_and_clear_of_airports_and_river(self):
        x, y = AIRPORTS[0].position
        _, trees = terrain(x, y)
        self.assertTrue(trees)
        self.assertEqual(terrain(x, y), terrain(x, y))
        shared = set()
        for points, color in trees:
            if color == "#71533b" and len({p[2] for p in points}) == 1:
                tx = sum(p[0] for p in points) / 4
                ty = sum(p[1] for p in points) / 4
                self.assertTrue(airport_clear(tx, ty))
                shared.add(tuple(points))
        shifted = {tuple(points) for points, color in terrain(x + 800, y)[1]
                   if color == "#71533b" and len({p[2] for p in points}) == 1}
        self.assertGreater(len(shared & shifted), len(shared) / 2)
        for airport in AIRPORTS:
            self.assertFalse(airport_clear(*airport.position))

    def test_london_has_joined_river_and_elevated_landmarks(self):
        ground, solids = heathrow_scenery()
        river = [points for points, color in ground if color == "#468b9e"]
        for a, b in zip(river, river[1:]):
            self.assertEqual(a[2], b[1])
            self.assertEqual(a[3], b[0])
        hx, hy = AIRPORTS[0].position
        terminal_roofs = [points for points, color in solids
                          if color == "#b8c5c6" and all(p[2] == 24 for p in points)]
        self.assertEqual(len(terminal_roofs), 3)
        self.assertTrue(all(not AIRPORTS[0].contains(p[0], p[1])
                            for roof in terminal_roofs for p in roof))
        wheel = [p for points, color in solids if color == "#e4e6df" for p in points]
        self.assertAlmostEqual(max(p[2] for p in wheel), 135)
        self.assertTrue(all(hx + 25000 < p[0] < hx + 26000 for p in wheel))

    def test_clipping_handles_horizon_and_near_plane_crossings(self):
        screen = [(0, 0), (100, 0), (100, 100), (0, 100)]
        clipped = clip_polygon(screen, lambda p: p[1] - p[0] - 20)
        self.assertEqual(len(clipped), 3)
        self.assertTrue(all(p[1] >= p[0] + 20 for p in clipped))
        self.assertEqual(clip_polygon(screen, lambda p: -1), [])
        points = [(0, 0, -2), (1, 0, 2), (0, 1, 2)]
        self.assertTrue(all(p[2] >= 1 for p in clip_polygon(points, lambda p: p[2] - 1)))
