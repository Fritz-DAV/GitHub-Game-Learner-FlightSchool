"""Optional window checks; skip cleanly without Tkinter or a display."""

import unittest

try:
    import tkinter as tk
    from flight_school import FlightSchool
except ImportError:
    tk = None

from flight_model import AIRCRAFT, AIRPORTS


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
