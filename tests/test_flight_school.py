"""Optional window checks; skip cleanly without Tkinter or a display."""

import unittest
import math
from unittest.mock import Mock

try:
    import tkinter as tk
    from flight_school import FlightSchool
except ImportError:
    tk = None

from flight_model import AIRCRAFT, AIRPORTS, Flight
from scenery import heathrow_scenery, regional_scenery


@unittest.skipIf(tk is None, "Tkinter is not installed")
class RendererTests(unittest.TestCase):
    def test_joystick_throttles_and_needles_follow_the_flight_state(self):
        app = FlightSchool.__new__(FlightSchool)
        app.canvas = Mock()
        app.width, app.height = 1100, 760
        for aircraft in AIRCRAFT:
            app.flight = f = Flight(aircraft, wind_speed=0)
            app.canvas.reset_mock()
            app._cockpit()
            rectangles = app.canvas.create_rectangle.call_args_list
            grip = next(call.args for call in rectangles if call.kwargs.get("fill") == "#111a21")
            levers = [call.args for call in rectangles if call.kwargs.get("fill") == "#dde0d6"]
            needle = next(call.args for call in app.canvas.create_line.call_args_list
                          if call.kwargs.get("fill") == "#f3ce77")
            f.elevator, f.aileron, f.throttle, f.vx, f.gear = 0.5, -0.75, 0.8, 50, 0.5
            app.canvas.reset_mock()
            app._cockpit()
            rectangles = app.canvas.create_rectangle.call_args_list
            moved = next(call.args for call in rectangles if call.kwargs.get("fill") == "#111a21")
            moved_levers = [call.args for call in rectangles if call.kwargs.get("fill") == "#dde0d6"]
            self.assertAlmostEqual(moved[0] - grip[0], -0.75 * 23)
            self.assertAlmostEqual(moved[1] - grip[1], 0.5 * 18)
            self.assertEqual(len(levers), 1 if aircraft == AIRCRAFT[0] else 2)
            for before, after in zip(levers, moved_levers):
                self.assertAlmostEqual(after[1] - before[1], -0.8 * (760 * 0.21 - 64))
            moved_needle = next(call.args for call in app.canvas.create_line.call_args_list
                                if call.kwargs.get("fill") == "#f3ce77")
            self.assertNotEqual(needle, moved_needle)
            self.assertTrue(any(call.kwargs.get("fill") == "#edb64d"
                                for call in app.canvas.create_oval.call_args_list))

    def test_cockpit_buttons_and_paused_gear_lock(self):
        app = FlightSchool.__new__(FlightSchool)
        app.canvas = Mock()
        app.canvas.winfo_width.return_value = 1100
        app.canvas.winfo_height.return_value = 760
        app.flight = Flight(AIRCRAFT[1])
        app.flight.on_ground = False
        app.external = app.paused = app.mouse_enabled = False
        app._cockpit_click(Mock(x=1100 * 0.69, y=760 * 0.79 + 27))
        self.assertFalse(app.flight.gear_down)
        app._cockpit_click(Mock(x=1100 * 0.8, y=760 * 0.79 + 27))
        self.assertFalse(app.flight.lights_on)
        app._cockpit_click(Mock(x=1100 * 0.91, y=760 * 0.79 + 27))
        self.assertTrue(app.mouse_enabled)
        app.paused = True
        app._cockpit_click(Mock(x=1100 * 0.69, y=760 * 0.79 + 27))
        self.assertFalse(app.flight.gear_down)

    def test_scenery_stays_in_viewport_at_ground_climb_and_banked_attitudes(self):
        app = FlightSchool.__new__(FlightSchool)
        app.canvas = Mock()
        app.canvas.winfo_width.return_value = 1100
        app.canvas.winfo_height.return_value = 760
        app.paused = app.mouse_enabled = False
        app.london_ground, app.london_solids = heathrow_scenery()
        app.regional_ground, app.regional_solids = regional_scenery()
        for external in (False, True):
            app.external = external
            for altitude, pitch, bank in ((0, 0, 0), (1000, 25, 65), (1000, -25, -65)):
                app.flight = Flight()
                app.flight.z, app.flight.pitch, app.flight.bank = altitude, pitch, bank
                app.canvas.reset_mock()
                app.draw()
                polygons = app.canvas.create_polygon.call_args_list
                self.assertGreater(len(polygons), 20)
                for call in polygons:
                    coordinates = call.args
                    self.assertTrue(all(math.isfinite(v) for v in coordinates))
                    self.assertTrue(all(-1e-6 <= v <= 1100 + 1e-6 for v in coordinates[::2]))
                    self.assertTrue(all(-1e-6 <= v <= 760 + 1e-6 for v in coordinates[1::2]))

    def test_runway_edges_are_clipped_before_projection(self):
        app = FlightSchool.__new__(FlightSchool)
        app.canvas = Mock()
        app.width, app.height, app.focal = 1100, 760, 825
        app.flight, app.external = Flight(), False
        app._camera()
        for across in (-24, 24):
            app._ground_line(app._runway_point(AIRPORTS[0], -1951, across),
                             app._runway_point(AIRPORTS[0], 1951, across), "white")
        self.assertEqual(app.canvas.create_line.call_count, 2)
        for call in app.canvas.create_line.call_args_list:
            self.assertTrue(all(-1e-6 <= x <= 1100 + 1e-6 for x in call.args[::2]))
            self.assertTrue(all(-1e-6 <= y <= 760 + 1e-6 for y in call.args[1::2]))


@unittest.skipIf(tk is None, "Tkinter is not installed")
class WindowTests(unittest.TestCase):
    def setUp(self):
        try:
            self.root = tk.Tk()
        except tk.TclError:
            self.skipTest("A desktop display is not available")
        self.errors = []
        self.root.report_callback_exception = lambda *error: self.errors.append(error)
        self.app = FlightSchool(self.root)
        self.root.update()

    def tearDown(self):
        for callback in self.root.tk.call("after", "info"):
            self.root.after_cancel(callback)
        self.root.destroy()
        self.assertEqual(self.errors, [])

    def press(self, key):
        self.app.canvas.event_generate(f"<KeyPress-{key}>")
        self.app.canvas.event_generate(f"<KeyRelease-{key}>")

    def test_all_aircraft_and_routes_render_in_both_views(self):
        for aircraft in AIRCRAFT:
            for departure in AIRPORTS:
                for destination in AIRPORTS:
                    if departure == destination:
                        continue
                    self.app.plane_choice.set(aircraft.name)
                    self.app.departure_choice.set(departure.name)
                    self.app.destination_choice.set(destination.name)
                    self.app.start()
                    self.root.update()
                    self.assertEqual(self.app.flight.aircraft, aircraft)
                    self.assertEqual(self.app.flight.departure, departure)
                    self.assertEqual(self.app.flight.destination, destination)
                    for external in (False, True):
                        self.app.external = external
                        self.app.draw()
                        self.assertGreater(len(self.app.canvas.find_all()), 40)
        for pitch, bank in ((25, 65), (-25, -65)):
            self.app.external = False
            self.app.flight.z = 1000
            self.app.flight.pitch, self.app.flight.bank = pitch, bank
            self.app.draw()

    def test_identical_airports_are_rejected(self):
        self.app.destination_choice.set(self.app.departure_choice.get())
        self.app.start()
        self.assertIsNone(self.app.flight)
        self.assertTrue(self.app.menu_message.cget("text"))
        self.assertTrue(self.app.menu.winfo_ismapped())

    def test_keyboard_mouse_pause_and_restart(self):
        self.app.start()
        self.root.update()
        self.app.canvas.focus_force()
        self.root.update()
        self.press("v")
        self.assertTrue(self.app.external)
        self.press("1")
        self.assertFalse(self.app.external)
        self.press("2")
        self.assertTrue(self.app.external)
        self.press("m")
        self.app.canvas.event_generate("<Motion>", x=900, y=100)
        self.assertTrue(self.app.mouse_enabled)
        self.assertGreater(self.app.mouse[0], 0)
        self.assertGreater(self.app.mouse[1], 0)
        self.app.canvas.event_generate("<Button-4>")
        self.assertAlmostEqual(self.app.flight.throttle, 0.05)
        self.press("p")
        self.assertTrue(self.app.paused)
        self.app.canvas.event_generate("<Button-4>")
        self.assertAlmostEqual(self.app.flight.throttle, 0.05)
        self.press("r")
        self.assertFalse(self.app.paused)
        self.assertEqual(self.app.flight.throttle, 0)
        self.press("Escape")
        self.root.update()
        self.assertTrue(self.app.menu.winfo_ismapped())
        self.assertEqual(self.app.keys, set())

    def test_near_plane_clipping_avoids_dividing_by_zero(self):
        points = [(-1, -1, -2), (1, -1, 2), (0, 1, 2)]
        clipped = self.app._clip(points)
        self.assertEqual(len(clipped), 4)
        self.assertTrue(all(point[2] >= 1 for point in clipped))
        self.assertEqual(self.app._clip([(0, 0, -1)] * 3), [])


if __name__ == "__main__":
    unittest.main()
