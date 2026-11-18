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

    def test_brakes_slow_the_ground_roll(self):
        flight = Flight(wind_speed=0)
        flight.vx = 20
        flight.update(0.25, brake=True)
        self.assertLess(flight.ground_speed, 19.5)
        self.assertEqual(flight.z, 0)

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

    def test_control_inertia_and_engine_spool_are_aircraft_dependent(self):
        responses = []
        for aircraft in AIRCRAFT:
            flight = Flight(aircraft, wind_speed=0)
            flight.on_ground = False
            flight.z, flight.vx, flight.throttle = 1000, 70, 1
            flight.update(0.1, elevator=1, aileron=1, rudder=1)
            self.assertTrue(0 < flight.pitch < 0.2)
            self.assertTrue(0 < flight.bank < 0.5)
            self.assertTrue(0 < flight.engine_power < 0.2)
            self.assertEqual((flight.elevator, flight.aileron, flight.rudder), (1, 1, 1))
            before, rate = flight.bank, flight.roll_rate
            flight.update(0.1)
            self.assertGreater(flight.bank, before)
            self.assertTrue(0 < flight.roll_rate < rate)
            self.assertEqual(flight.aileron, 0)
            responses.append((flight.pitch, flight.engine_power))
        self.assertGreater(responses[0][0], responses[1][0] * 2)
        self.assertGreater(responses[0][1], responses[1][1] * 3)

    def test_stationary_aircraft_cannot_rotate_and_engine_spools_down(self):
        flight = Flight(wind_speed=0)
        flight.update(0.25, elevator=1, aileron=1)
        self.assertEqual((flight.pitch, flight.bank), (0, 0))
        flight.engine_power = 1
        flight.update(0.1)
        self.assertTrue(0.8 < flight.engine_power < 1)

    def test_gear_is_fixed_or_ground_locked_and_jets_cycle_in_five_seconds(self):
        for aircraft in AIRCRAFT:
            flight = Flight(aircraft, wind_speed=0)
            flight.toggle_gear()
            self.assertTrue(flight.gear_down)
            flight.on_ground = False
            flight.z, flight.vx = 1000, 100 if flight.retractable_gear else 50
            flight.toggle_gear()
            if not flight.retractable_gear:
                flight.update(0.25)
                self.assertEqual(flight.gear, 1)
                continue
            for _ in range(10):
                flight.update(0.25)
            self.assertAlmostEqual(flight.gear, 0.5)
            for _ in range(10):
                flight.update(0.25)
            self.assertAlmostEqual(flight.gear, 0)
            flight.toggle_gear()
            for _ in range(20):
                flight.update(0.25)
            self.assertAlmostEqual(flight.gear, 1)
            self.assertFalse(flight.crashed)

    def test_extended_gear_adds_drag_and_gear_up_landings_fail(self):
        for aircraft in AIRCRAFT[1:]:
            extended, retracted = [Flight(aircraft, wind_speed=0) for _ in range(2)]
            for flight in (extended, retracted):
                flight.on_ground = False
                flight.z, flight.vx = 1000, 100
            retracted.gear, retracted.gear_down = 0, False
            extended.update(0.1)
            retracted.update(0.1)
            self.assertGreater(retracted.vx, extended.vx)
            for gear in (0, 0.5, 0.98, 1):
                flight = Flight(aircraft, wind_speed=0)
                flight.x, flight.y = flight.destination.position
                flight.heading = flight.destination.runway_heading
                flight.z, flight.vz, flight.vx = 0.01, -1, 65
                flight.on_ground = False
                flight.gear = gear
                flight.gear_down = gear == 1
                flight.update(0.02)
                self.assertEqual(flight.completed, gear == 1)
                self.assertEqual(flight.crashed, gear != 1)


if __name__ == "__main__":
    unittest.main()
