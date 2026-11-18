"""Flight-school data and a small, window-independent flight model.

Coordinates are metres east, north and above a shared, flat ground plane.
Angles exposed to the player are degrees; speeds inside the model are m/s.
"""

from dataclasses import dataclass
import math


G = 9.80665


@dataclass(frozen=True)
class Aircraft:
    name: str
    mass: float
    wing_area: float
    max_thrust: float
    max_speed: float
    landing_speed: float


AIRCRAFT = (
    Aircraft("Cessna 172 Skyhawk", 1110, 16.2, 2500, 84, 40),
    Aircraft("Boeing 737-800", 65000, 124.6, 242000, 250, 85),
    Aircraft("Airbus A320", 64000, 122.6, 240000, 250, 85),
)


@dataclass(frozen=True)
class Airport:
    name: str
    code: str
    latitude: float
    longitude: float
    runway_heading: float
    runway_length: float
    runway_width: float

    @property
    def position(self):
        # A local map is sufficient for these short European routes.
        return (
            math.radians(self.longitude) * 6371000 * math.cos(math.radians(50)),
            math.radians(self.latitude - 50) * 6371000,
        )

    def runway_coordinates(self, x, y):
        east, north = self.position
        heading = math.radians(self.runway_heading)
        dx, dy = x - east, y - north
        return (
            dx * math.sin(heading) + dy * math.cos(heading),
            dx * math.cos(heading) - dy * math.sin(heading),
        )

    def contains(self, x, y):
        along, across = self.runway_coordinates(x, y)
        return abs(along) <= self.runway_length / 2 and abs(across) <= self.runway_width / 2


# One representative runway per airport; dimensions and locations are rounded.
AIRPORTS = (
    Airport("Heathrow Airport, London", "EGLL", 51.4775, -0.4614, 90, 3902, 50),
    Airport("Charles De Gaulle Airport, Paris", "LFPG", 49.0097, 2.5479, 90, 4200, 60),
    Airport("Stansted Airport, United Kingdom", "EGSS", 51.8850, 0.2350, 40, 3049, 46),
)


def clamp(value, low, high):
    return max(low, min(high, value))


class Flight:
    """Approximate point-mass flight: lift, drag, thrust, gravity and wind.

    Aircraft dimensions are representative, not certified performance data.
    Damped angular rates and engine spool provide aircraft-dependent inertia.
    Wind changes airspeed, not just the displayed ground track.
    """

    def __init__(self, aircraft=AIRCRAFT[0], departure=AIRPORTS[0],
                 destination=AIRPORTS[1], wind_speed=4, wind_from=270, gusts=True):
        self.aircraft = aircraft
        self.departure = departure
        self.destination = destination
        heading = math.radians(departure.runway_heading)
        east, north = departure.position
        self.x = east - math.sin(heading) * departure.runway_length * 0.4
        self.y = north - math.cos(heading) * departure.runway_length * 0.4
        self.z = 0.0
        self.vx = self.vy = self.vz = 0.0
        self.heading = departure.runway_heading
        self.pitch = self.bank = self.throttle = 0.0
        self.engine_power = 0.0
        self.elevator = self.aileron = self.rudder = 0.0
        self.pitch_rate = self.roll_rate = self.yaw_rate = 0.0
        self.gear_down = True
        self.gear = 1.0
        self.lights_on = True
        self.wind_speed = wind_speed
        self.wind_from = wind_from
        self.gusts = gusts
        self.time = 0.0
        self.on_ground = True
        self.has_flown = False
        self.crashed = self.completed = self.stalled = False
        self.message = "Ready: add throttle, build speed, then gently raise the nose."

    @property
    def wind(self):
        direction = math.radians(self.wind_from)
        gust = 1.5 * math.sin(self.time * 0.31) if self.gusts else 0
        speed = max(0, self.wind_speed + gust) if self.wind_speed else 0
        return -speed * math.sin(direction), -speed * math.cos(direction)

    @property
    def airspeed(self):
        wx, wy = self.wind
        return math.sqrt((self.vx - wx) ** 2 + (self.vy - wy) ** 2 + self.vz ** 2)

    @property
    def ground_speed(self):
        return math.hypot(self.vx, self.vy)

    @property
    def navigation(self):
        east, north = self.destination.position
        dx, dy = east - self.x, north - self.y
        return math.hypot(dx, dy), math.degrees(math.atan2(dx, dy)) % 360

    @property
    def retractable_gear(self):
        return self.aircraft != AIRCRAFT[0]

    def toggle_gear(self):
        if self.crashed or self.completed:
            return
        if not self.retractable_gear:
            self.message = "The Cessna has fixed landing gear."
        elif self.on_ground:
            self.message = "Landing gear is locked down while on the ground."
        else:
            self.gear_down = not self.gear_down
            self.message = "Landing gear lowering." if self.gear_down else "Landing gear retracting."

    def update(self, dt, elevator=0, aileron=0, rudder=0, brake=False):
        if self.crashed or self.completed or dt <= 0:
            return
        # Bound a delayed frame, then integrate small steps for stable landings.
        remaining = min(dt, 0.25)
        while remaining > 1e-9 and not (self.crashed or self.completed):
            step = min(remaining, 1 / 120)
            self._step(step, clamp(elevator, -1, 1),
                       clamp(aileron, -1, 1), clamp(rudder, -1, 1), brake)
            remaining -= step

    def _step(self, dt, elevator, aileron, rudder, brake):
        self.time += dt
        self.elevator, self.aileron, self.rudder = elevator, aileron, rudder
        jet = self.retractable_gear
        response = 1.1 if jet else 0.4
        self.engine_power += (clamp(self.throttle, 0, 1) - self.engine_power) * (
            1 - math.exp(-dt / (3.5 if jet else 0.65)))
        self.gear = clamp(self.gear + (1 if self.gear_down else -1) * dt / 5, 0, 1)
        speed = self.airspeed
        authority = clamp((speed / (65 if jet else 28)) ** 2, 0, 1)
        blend = 1 - math.exp(-dt / response)
        self.pitch_rate += (elevator * (6 if jet else 12) * authority - self.pitch_rate) * blend
        self.roll_rate += (aileron * (18 if jet else 35) * authority - self.roll_rate) * blend
        self.pitch = clamp(self.pitch + self.pitch_rate * dt, -25, 30)
        self.bank = clamp(self.bank + self.roll_rate * dt, -65, 65)
        if self.pitch in (-25, 30):
            self.pitch_rate = 0
        if self.bank in (-65, 65):
            self.roll_rate = 0
        if self.on_ground:
            self.bank = self.roll_rate = 0
        turn = 0 if self.on_ground else math.degrees(
            G * math.tan(math.radians(self.bank)) / max(speed, 25))
        steer = min(self.ground_speed / 5, 1) if self.on_ground else 0.3
        self.yaw_rate += (rudder * (7 if jet else 12) * steer - self.yaw_rate) * blend
        self.heading = (self.heading + (turn + self.yaw_rate) * dt) % 360
        heading, pitch, bank = map(math.radians, (self.heading, self.pitch, self.bank))
        fx, fy = math.sin(heading), math.cos(heading)
        wx, wy = self.wind
        ax, ay, az = self.vx - wx, self.vy - wy, self.vz
        horizontal = math.hypot(ax, ay)
        gamma = math.atan2(az, max(horizontal, 0.1))
        angle_of_attack = pitch - gamma
        self.stalled = abs(angle_of_attack) > math.radians(16) and speed > 15
        cl = clamp(0.3 + 4.8 * angle_of_attack, -1.2, 1.5)
        if self.stalled:
            cl *= max(0.2, 1 - (abs(math.degrees(angle_of_attack)) - 16) / 30)
        density = 1.225 * math.exp(-max(self.z, 0) / 8500)
        pressure = 0.5 * density * speed * speed
        lift = pressure * self.aircraft.wing_area * cl
        gear_drag = 0.018 * self.gear if jet else 0.012
        drag = pressure * self.aircraft.wing_area * (0.03 + gear_drag + 0.055 * cl * cl)
        # Lift is perpendicular to air-relative motion; banking tilts it sideways.
        ux, uy = (ax / horizontal, ay / horizontal) if horizontal > 1 else (fx, fy)
        lx = -math.sin(gamma) * ux * math.cos(bank) + uy * math.sin(bank)
        ly = -math.sin(gamma) * uy * math.cos(bank) - ux * math.sin(bank)
        lz = math.cos(gamma) * math.cos(bank)
        thrust = self.engine_power * self.aircraft.max_thrust
        mass = self.aircraft.mass
        accelerations = [
            (thrust * math.cos(pitch) * fx + lift * lx - drag * ax / max(speed, 0.1)) / mass,
            (thrust * math.cos(pitch) * fy + lift * ly - drag * ay / max(speed, 0.1)) / mass,
            (thrust * math.sin(pitch) + lift * lz - drag * az / max(speed, 0.1)) / mass - G,
        ]
        if self.on_ground:
            # Tyre grip prevents sideways skating in a crosswind.
            forward = self.vx * fx + self.vy * fy
            rolling = min(abs(forward) / dt, (0.025 + 0.3 * bool(brake)) * G)
            along = accelerations[0] * fx + accelerations[1] * fy
            forward = max(0, forward + (along - rolling) * dt)
            self.vx, self.vy = forward * fx, forward * fy
            self.vz = max(0, self.vz + accelerations[2] * dt)
        else:
            self.vx += accelerations[0] * dt
            self.vy += accelerations[1] * dt
            self.vz += accelerations[2] * dt
        was_airborne = not self.on_ground
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.z += self.vz * dt
        if self.z > 0.1 and self.on_ground:
            self.on_ground = False
            self.has_flown = True
            self.message = "Airborne! Follow the destination bearing; keep an eye on airspeed."
        if self.z <= 0:
            if was_airborne:
                self._touchdown()
            self.z = self.vz = 0
            self.on_ground = True
        if self.airspeed > self.aircraft.max_speed:
            self.crashed = True
            self.message = "Overspeed: the aircraft was damaged. Press R to try again."

    def _touchdown(self):
        if self.gear < 0.99:
            self.crashed = True
            self.message = "Landing gear was not fully down. Press R to try again."
            return
        runway = next((airport for airport in AIRPORTS if airport.contains(self.x, self.y)), None)
        alignment = 180 if runway is None else abs(
            (self.heading - runway.runway_heading + 90) % 180 - 90)
        if (runway is None or self.vz < -3 or abs(self.bank) > 12
                or not -5 <= self.pitch <= 15 or alignment > 15
                or self.airspeed > self.aircraft.landing_speed):
            self.crashed = True
            self.message = "Hard or off-runway landing. Press R to try again."
        elif runway == self.destination:
            self.completed = True
            self.message = "Successful arrival! Press R for another flight or Esc to choose a route."
        else:
            self.message = "Landed safely, but not at the destination. Take off to continue."
