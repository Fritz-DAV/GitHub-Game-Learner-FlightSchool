import math
import unittest

from flight_model import AIRCRAFT, AIRPORTS, Flight


class FlightTests(unittest.TestCase):
    def test_every_aircraft_starts_on_each_departure_runway(self):
        for aircraft in AIRCRAFT:
            for airport in AIRPORTS:
                flight = Flight(aircraft, airport)
                self.assertTrue(airport.contains(flight.x, flight.y))
                self.assertEqual(flight.heading, airport.runway_heading)

    def test_idle_aircraft_stays_on_ground(self):
        flight = Flight(wind_speed=0)
        for _ in range(120):
            flight.update(1 / 60)
        self.assertEqual(flight.z, 0)
        self.assertEqual(flight.ground_speed, 0)

    def test_throttle_accelerates_all_aircraft(self):
        for aircraft in AIRCRAFT:
            flight = Flight(aircraft, wind_speed=0)
            flight.throttle = 1
            for _ in range(600):
                flight.update(1 / 60)
            self.assertGreater(flight.ground_speed, 10)

    def test_wind_changes_airspeed_not_ground_speed(self):
        flight = Flight(wind_speed=10, wind_from=270, gusts=False)
        flight.vx = 30
        self.assertAlmostEqual(flight.airspeed, 20)
        self.assertAlmostEqual(flight.ground_speed, 30)

    def test_bank_produces_a_turn(self):
        flight = Flight(wind_speed=0)
        flight.z, flight.vx, flight.bank = 1000, 55, 20
        flight.on_ground = False
        old_heading = flight.heading
        flight.update(0.1)
        self.assertGreater(flight.heading, old_heading)
        self.assertLess(flight.vy, 0)

    def test_all_aircraft_can_take_off(self):
        for aircraft in AIRCRAFT:
            flight = Flight(aircraft, wind_speed=0)
            flight.throttle = 1
            for _ in range(3600):
                flight.update(1 / 60, elevator=0.4 if flight.airspeed > (
                    28 if aircraft == AIRCRAFT[0] else 65) and flight.pitch < 8 else 0)
                if flight.z > 10:
                    break
            self.assertGreater(flight.z, 10, aircraft.name)
            self.assertFalse(flight.crashed)
            self.assertTrue(flight.has_flown)

    def landing(self, destination=True):
        flight = Flight(wind_speed=0)
        airport = flight.destination if destination else flight.departure
        flight.x, flight.y = airport.position
        flight.heading = airport.runway_heading
        flight.z, flight.vz, flight.vx = 0.01, -1, 30
        flight.on_ground = False
        return flight

    def test_safe_destination_landing_completes_route(self):
        flight = self.landing()
        flight.update(0.02)
        self.assertTrue(flight.completed)
        self.assertFalse(flight.crashed)

    def test_other_airport_does_not_complete_route(self):
        flight = self.landing(destination=False)
        flight.update(0.02)
        self.assertFalse(flight.completed)
        self.assertFalse(flight.crashed)

    def test_unsafe_landings_fail(self):
        for attribute, value in (("vz", -6), ("bank", 30), ("vx", 60),
                                 ("heading", 0), ("x", 1e6)):
            flight = self.landing()
            setattr(flight, attribute, value)
            flight.update(0.02)
            self.assertTrue(flight.crashed, attribute)
            self.assertFalse(flight.completed)

    def test_stall_reduces_lift(self):
        flight = Flight(wind_speed=0)
        flight.on_ground = False
        flight.z, flight.vx, flight.pitch = 1000, 30, 25
        flight.update(0.01)
        self.assertTrue(flight.stalled)
        self.assertLess(flight.vz, 0)

    def test_frame_substeps_are_consistent(self):
        one = Flight(wind_speed=0)
        many = Flight(wind_speed=0)
        one.throttle = many.throttle = 1
        one.update(0.1)
        for _ in range(12):
            many.update(1 / 120)
        self.assertAlmostEqual(one.x, many.x)
        self.assertAlmostEqual(one.vx, many.vx)

    def test_navigation_and_terminal_states(self):
        flight = Flight()
        distance, bearing = flight.navigation
        self.assertGreater(distance, 1000)
        self.assertTrue(0 <= bearing < 360)
        flight.crashed = True
        before = (flight.x, flight.y, flight.z)
        flight.update(0.2, elevator=1)
        self.assertEqual(before, (flight.x, flight.y, flight.z))


if __name__ == "__main__":
    unittest.main()
