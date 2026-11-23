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
    engines: int = 2
    supersonic: bool = False
    datum: float = 3.3  # fuselage axis height above the ground on its wheels
    lift_slope: float = 4.8  # lift coefficient per radian of angle of attack
    zero_lift: float = 0.3
    stall_angle: float = 16  # degrees
    cl_max: float = 1.5
    drag_base: float = 0.03
    drag_induced: float = 0.055
    max_pitch: float = 30  # degrees; attitude limit
    tail_strike_angle: float = 11.5  # pitch at which the rear fuselage scrapes
    bank_limit: float = 9  # bank at which a wingtip or engine pod touches down


AIRCRAFT = (
    Aircraft("Cessna 172 Skyhawk", 1110, 16.2, 2500, 84, 40, engines=1, datum=1.5,
             tail_strike_angle=15, bank_limit=15),
    Aircraft("Boeing 737-800", 65000, 124.6, 242000, 250, 85),
    Aircraft("Airbus A320", 64000, 122.6, 240000, 250, 85),
    # Four Olympus 593 engines (about 677 kN with reheat), 358 m2 ogival delta
    # wing. Low lift slope but a very high stall angle; Mach 2.04 at altitude.
    Aircraft("Concorde", 120000, 358.25, 677000, 650, 92, engines=4,
             supersonic=True, datum=3.9, lift_slope=2.2, zero_lift=0.1,
             stall_angle=28, cl_max=1.1, drag_base=0.010, drag_induced=0.15,
             max_pitch=18, tail_strike_angle=13, bank_limit=7),
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


# Damage kind -> (warning label, extra rolling drag in g, prevents flight).
DAMAGE = {
    "tyres": ("Tyres burst", 0.15, False),
    "gear": ("Landing gear collapsed", 0.45, True),
    "nose_gear": ("Nose gear collapsed", 0.4, True),
    "belly": ("Gear not down: belly landing", 0.5, True),
    "terrain": ("Off-runway landing: gear torn by rough ground", 0.45, True),
    "wing": ("Wing strike", 0.25, True),
    "tail": ("Tail strike", 0.03, False),
}


def clamp(value, low, high):
    return max(low, min(high, value))


LOOK_PITCH_LIMIT = 80
TIME_SCALES = (1, 2, 4, 8)


def clamp_look(yaw, pitch):
    """Wrap a look-around yaw to [-180, 180) degrees and limit pitch to +-80."""
    return (yaw + 180) % 360 - 180, clamp(pitch, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT)


def next_time_scale(scale):
    """Fast-forward cycle: 1x, 2x, 4x, 8x, then back to 1x."""
    return TIME_SCALES[(TIME_SCALES.index(scale) + 1) % len(TIME_SCALES)]


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
        self.damage_kinds = []
        self.drag_damage = 0.0
        self.unflyable = False
        self.veer = 1
        self.assess_at_rest = False
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

    @property
    def damage(self):
        """Warning text for each kind of damage the aircraft has suffered."""
        wing = "Wing/engine pod strike" if self.aircraft.engines > 1 else "Wing strike"
        return [wing if kind == "wing" else DAMAGE[kind][0] for kind in self.damage_kinds]

    def _add_damage(self, kind):
        if kind not in self.damage_kinds:
            self.damage_kinds.append(kind)
            _, drag, grounded = DAMAGE[kind]
            self.drag_damage += drag
            self.unflyable = self.unflyable or grounded

    def _damage_message(self, prefix):
        return f"{prefix}: " + "; ".join(self.damage) + "."

    @property
    def mach(self):
        # ISA: speed of sound falls to 295 m/s at the tropopause.
        return self.airspeed / (340.3 - 4.5 * min(max(self.z, 0), 11000) / 1000)

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
        self.pitch = clamp(self.pitch + self.pitch_rate * dt, -25, self.aircraft.max_pitch)
        self.bank = clamp(self.bank + self.roll_rate * dt, -65, 65)
        if self.pitch in (-25, self.aircraft.max_pitch):
            self.pitch_rate = 0
        if self.bank in (-65, 65):
            self.roll_rate = 0
        if self.on_ground:
            self.bank = self.roll_rate = 0
        turn = 0 if self.on_ground else math.degrees(
            G * math.tan(math.radians(self.bank)) / max(speed, 25))
        steer = min(self.ground_speed / 5, 1) if self.on_ground else 0.3
        pull = 0
        if self.on_ground and self.damage_kinds:
            # Damaged gear steers poorly and drags the aircraft to one side.
            steer *= 0.2 if self.unflyable else 0.5 if "tyres" in self.damage_kinds else 1
            pull = self.veer * 4 * min(self.ground_speed / 10, 1) * min(self.drag_damage * 3, 1)
        self.yaw_rate += (rudder * (7 if jet else 12) * steer + pull - self.yaw_rate) * blend
        self.heading = (self.heading + (turn + self.yaw_rate) * dt) % 360
        heading, pitch, bank = map(math.radians, (self.heading, self.pitch, self.bank))
        fx, fy = math.sin(heading), math.cos(heading)
        wx, wy = self.wind
        ax, ay, az = self.vx - wx, self.vy - wy, self.vz
        horizontal = math.hypot(ax, ay)
        gamma = math.atan2(az, max(horizontal, 0.1))
        angle_of_attack = pitch - gamma
        craft = self.aircraft
        self.stalled = abs(angle_of_attack) > math.radians(craft.stall_angle) and speed > 15
        cl = clamp(craft.zero_lift + craft.lift_slope * angle_of_attack, -1.2, craft.cl_max)
        if self.stalled:
            cl *= max(0.2, 1 - (abs(math.degrees(angle_of_attack)) - craft.stall_angle) / 30)
        density = 1.225 * math.exp(-max(self.z, 0) / 8500)
        pressure = 0.5 * density * speed * speed
        lift = pressure * self.aircraft.wing_area * cl
        gear_drag = 0.018 * self.gear if jet else 0.012
        wave_drag = 0
        if craft.supersonic:
            # Transonic drag rise peaking near Mach 1.1, easing off supersonically.
            mach = self.mach
            wave_drag = (0.012 * clamp((mach - 0.85) / 0.25, 0, 1) if mach < 1.1
                         else 0.006 + 0.006 * math.exp(-(mach - 1.1) * 1.5))
        drag = pressure * craft.wing_area * (
            craft.drag_base + gear_drag + wave_drag + craft.drag_induced * cl * cl)
        # Lift is perpendicular to air-relative motion; banking tilts it sideways.
        ux, uy = (ax / horizontal, ay / horizontal) if horizontal > 1 else (fx, fy)
        lx = -math.sin(gamma) * ux * math.cos(bank) + uy * math.sin(bank)
        ly = -math.sin(gamma) * uy * math.cos(bank) - ux * math.sin(bank)
        lz = math.cos(gamma) * math.cos(bank)
        thrust = self.engine_power * self.aircraft.max_thrust
        if craft.supersonic:
            # Dry thrust to 80% throttle, then afterburner (reheat) to full power.
            power = self.engine_power
            thrust = craft.max_thrust * (0.875 * power if power <= 0.8
                                         else 0.7 + 1.5 * (power - 0.8))
            # Thrust lapses with air density, but supersonic ram effect recovers
            # much of it, so Mach 2 cruise remains possible.
            thrust *= (density / 1.225) ** 0.6 * (1 + 0.45 * max(self.mach - 0.5, 0))
        mass = self.aircraft.mass
        accelerations = [
            (thrust * math.cos(pitch) * fx + lift * lx - drag * ax / max(speed, 0.1)) / mass,
            (thrust * math.cos(pitch) * fy + lift * ly - drag * ay / max(speed, 0.1)) / mass,
            (thrust * math.sin(pitch) + lift * lz - drag * az / max(speed, 0.1)) / mass - G,
        ]
        if self.on_ground:
            # Tyre grip prevents sideways skating in a crosswind.
            forward = self.vx * fx + self.vy * fy
            braking = 0.3 * bool(brake) * (0.5 if "tyres" in self.damage_kinds else 1)
            rolling = min(abs(forward) / dt, (0.025 + braking + self.drag_damage) * G)
            along = accelerations[0] * fx + accelerations[1] * fy
            forward = max(0, forward + (along - rolling) * dt)
            self.vx, self.vy = forward * fx, forward * fy
            self.vz = 0 if self.unflyable else max(0, self.vz + accelerations[2] * dt)
            if (self.pitch > self.aircraft.tail_strike_angle and self.ground_speed > 10
                    and "tail" not in self.damage_kinds):
                self._add_damage("tail")
                self.message = self._damage_message("WARNING — tail strike on rotation")
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
        elif (self.assess_at_rest and self.on_ground and self.ground_speed < 0.5
                and not self.completed):
            self.assess_at_rest = False
            if self.destination.contains(self.x, self.y):
                self.completed = True
                self.message = self._damage_message("Arrived, but the aircraft is damaged")
            elif self.unflyable:
                self.message = self._damage_message(
                    "Aircraft disabled, it cannot take off again. Press R to try again")
            else:
                self.message = self._damage_message("Stopped with damage, take-off is still possible")

    def _touchdown(self):
        craft = self.aircraft
        runway = next((airport for airport in AIRPORTS if airport.contains(self.x, self.y)), None)
        alignment = 180 if runway is None else abs(
            (self.heading - runway.runway_heading + 90) % 180 - 90)
        sink, speed = -self.vz, self.airspeed
        self.veer = 1 if self.bank >= 0 else -1
        destroyed = None
        if sink > 8:
            destroyed = "Impact far too hard, the airframe broke up"
        elif abs(self.bank) > 45:
            destroyed = "A wing dug in and the aircraft cartwheeled"
        elif alignment > 60 and runway is not None:
            destroyed = "The aircraft slid sideways and rolled over"
        elif runway is None and speed > craft.landing_speed * 1.5:
            destroyed = "High-speed impact off the runway"
        if self.gear < 0.99:
            self._add_damage("belly")
        else:
            if sink > 5:
                self._add_damage("gear")
            if sink > 3 or speed > craft.landing_speed * 1.1 or 15 < alignment <= 30:
                self._add_damage("tyres")
            if 30 < alignment <= 60 and runway is not None:
                self._add_damage("gear")
            if self.pitch < -5:
                self._add_damage("nose_gear")
        if runway is None:
            self._add_damage("terrain")
        if abs(self.bank) > craft.bank_limit:
            self._add_damage("wing")
        if self.pitch > craft.tail_strike_angle:
            self._add_damage("tail")
        if destroyed:
            self.crashed = True
            self.message = f"CRASH, {destroyed}. Press R to try again."
            if self.damage_kinds:
                self.message = self._damage_message(f"CRASH, {destroyed}. Damage") + " Press R to try again."
        elif self.damage_kinds:
            self.assess_at_rest = True
            self.message = self._damage_message("WARNING, damage on landing")
        elif runway == self.destination:
            self.completed = True
            self.message = "Successful arrival! Press R for another flight or Esc to choose a route."
        else:
            self.message = "Landed safely, but not at the destination. Take off to continue."
