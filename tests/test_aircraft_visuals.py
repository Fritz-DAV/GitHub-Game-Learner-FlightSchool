import unittest

from aircraft_visuals import aircraft_surfaces
from flight_model import AIRCRAFT


class AircraftVisualTests(unittest.TestCase):
    def test_distinct_airframes_have_representative_dimensions_and_visible_wheels(self):
        meshes = []
        for aircraft, length, span in zip(AIRCRAFT, (8.3, 39.5, 37.6, 61.7), (11, 36.5, 36.5, 25.6)):
            mesh = aircraft_surfaces(aircraft, 1)
            meshes.append(mesh)
            points = [p for surface, _ in mesh for p in surface]
            self.assertAlmostEqual(max(p[0] for p in points) - min(p[0] for p in points), span)
            self.assertAlmostEqual(max(p[1] for p in points) - min(p[1] for p in points),
                                   length, delta=0.1)
            wheels = [p for surface, color in mesh if color == "#20272c" for p in surface]
            self.assertAlmostEqual(min(p[2] for p in wheels) + aircraft.datum, 0, delta=0.03)
        self.assertNotEqual(meshes[1], meshes[2])

    def test_gear_animates_into_fuselage_and_cessna_wheels_stay_fixed(self):
        for aircraft in AIRCRAFT:
            down, transit, up = [aircraft_surfaces(aircraft, gear) for gear in (1, 0.5, 0)]
            if aircraft == AIRCRAFT[0]:
                self.assertEqual(down, up)
            else:
                lowest = lambda mesh: min(p[2] for points, color in mesh
                                          if color == "#20272c" for p in points)
                self.assertGreater(lowest(transit), lowest(down))
                self.assertFalse(any(color == "#20272c" for _, color in up))

    def test_damaged_landing_gear_shows_on_the_model(self):
        wheel = "#20272c"
        for aircraft in AIRCRAFT:
            healthy = aircraft_surfaces(aircraft, 1)
            wheels = lambda mesh: [p for pts, color in mesh if color == wheel for p in pts]
            flat = aircraft_surfaces(aircraft, 1, damage=("tyres",))
            self.assertGreater(min(p[2] for p in wheels(flat)), -aircraft.datum - 0.01)
            self.assertLess(max(p[2] for p in wheels(flat)), max(p[2] for p in wheels(healthy)))
            self.assertTrue(any(color == "#7a2f2f" for _, color in flat))
            for kind in ("gear", "nose_gear"):
                broken = aircraft_surfaces(aircraft, 1, damage=(kind,))
                self.assertNotEqual(broken, healthy)
                # Detached wheels lie flat on the ground instead of hanging on struts.
                lying = [p for p in wheels(broken) if p[2] < -aircraft.datum + 0.5]
                self.assertTrue(lying)
                self.assertFalse(any(p[2] > -aircraft.datum + 0.5 for p in wheels(broken)
                                     if abs(p[0]) > 2 and kind == "gear"))

