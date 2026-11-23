import unittest

from flight_model import AIRCRAFT, AIRPORTS, Flight
from summary_view import draw_summary, format_distance, format_duration


class RecordingCanvas:
    def __init__(self):
        self.texts, self.coords = [], []

    def _record(self, *args, **options):
        self.coords.extend(args)
        if "text" in options:
            self.texts.append(options["text"])

    create_rectangle = create_line = create_polygon = create_oval = create_text = _record


def arrive(sink=1.0):
    destination = AIRPORTS[2]
    f = Flight(AIRCRAFT[0], AIRPORTS[0], destination, 0, 270, False)
    f.throttle = 1
    for _ in range(60 * 40):
        f.update(1 / 60, 1 if f.ground_speed > 28 and f.pitch < 8 else 0)
        if f.z >= 30:
            break
    east, north = destination.position
    heading = destination.runway_heading
    import math
    f.x, f.y = east - math.sin(math.radians(heading)) * 300, north - math.cos(math.radians(heading)) * 300
    f.z, f.pitch, f.bank, f.throttle = 0.5, 3, 0, 0
    f.vx, f.vy, f.vz = math.sin(math.radians(heading)) * 33, math.cos(math.radians(heading)) * 33, -sink
    f.heading = heading
    for _ in range(60 * 60):
        f.update(1 / 60, 0, 0, 0, True)
        if f.completed or f.crashed:
            break
    return f


class SummaryTests(unittest.TestCase):
    def test_landing_is_rated_out_of_100_with_time_distance_and_track(self):
        f = arrive()
        self.assertTrue(f.completed, f.message)
        summary = f.summary()
        for key in ("takeoff", "flight", "landing", "overall"):
            self.assertIn(summary["scores"][key], range(101))
        self.assertGreater(summary["scores"]["takeoff"], 80)
        self.assertGreater(summary["time"], summary["airborne_time"], 0)
        self.assertGreater(summary["distance"], 500)
        self.assertGreater(len(summary["track"]), 10)
        self.assertLess(arrive(4).summary()["scores"]["landing"], summary["scores"]["landing"])

    def test_summary_panel_draws_scores_map_and_altitude(self):
        f = arrive()
        canvas = RecordingCanvas()
        draw_summary(canvas, 1100, 760, f, f.summary())
        text = " ".join(canvas.texts)
        for expected in ("Flight complete", "Take-off", "Landing", "EGLL", "EGSS", "planned route", "Altitude"):
            self.assertIn(expected, text)
        self.assertTrue(all(isinstance(v, (int, float)) and v == v for v in canvas.coords))
        self.assertEqual(format_duration(125), "2 min 05 s")
        self.assertEqual(format_distance(25400), "25.4 km")
