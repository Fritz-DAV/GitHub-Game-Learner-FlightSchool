export const G = 9.80665;

const aircraft = (name, mass, wingArea, maxThrust, maxSpeed, landingSpeed, extra = {}) => Object.freeze({
  name, mass, wingArea, maxThrust, maxSpeed, landingSpeed,
  engines: 2, supersonic: false,
  datum: 3.3, // fuselage axis height above the ground on its wheels
  liftSlope: 4.8, zeroLift: 0.3, stallAngle: 16, clMax: 1.5, // angles in degrees
  dragBase: 0.03, dragInduced: 0.055, maxPitch: 30,
  tailStrikeAngle: 11.5, // pitch at which the rear fuselage scrapes
  bankLimit: 9, // bank at which a wingtip or engine pod touches down
  ...extra,
});

export const AIRCRAFT = Object.freeze([
  aircraft("Cessna 172 Skyhawk", 1110, 16.2, 2500, 84, 40,
    { engines: 1, datum: 1.5, tailStrikeAngle: 15, bankLimit: 15 }),
  aircraft("Boeing 737-800", 65000, 124.6, 242000, 250, 85),
  aircraft("Airbus A320", 64000, 122.6, 240000, 250, 85),
  // Four Olympus 593 engines (about 677 kN with reheat), 358 m2 ogival delta
  // wing. Low lift slope but a very high stall angle; Mach 2.04 at altitude.
  aircraft("Concorde", 120000, 358.25, 677000, 650, 92, {
    engines: 4, supersonic: true, datum: 3.9, liftSlope: 2.2, zeroLift: 0.1,
    stallAngle: 28, clMax: 1.1, dragBase: 0.010, dragInduced: 0.15,
    maxPitch: 18, tailStrikeAngle: 13, bankLimit: 7,
  }),
]);

// Damage kind -> [warning label, extra rolling drag in g, prevents flight].
const DAMAGE = Object.freeze({
  tyres: ["Tyres burst", 0.15, false],
  gear: ["Landing gear collapsed", 0.45, true],
  nose_gear: ["Nose gear collapsed", 0.4, true],
  belly: ["Gear not down: belly landing", 0.5, true],
  terrain: ["Off-runway landing: gear torn by rough ground", 0.45, true],
  wing: ["Wing strike", 0.25, true],
  tail: ["Tail strike", 0.03, false],
});

export const AIRPORTS = Object.freeze([
  Object.freeze({ name: "Heathrow Airport, London", code: "EGLL", latitude: 51.4775, longitude: -0.4614, runwayHeading: 90, runwayLength: 3902, runwayWidth: 50 }),
  Object.freeze({ name: "Charles De Gaulle Airport, Paris", code: "LFPG", latitude: 49.0097, longitude: 2.5479, runwayHeading: 90, runwayLength: 4200, runwayWidth: 60 }),
  Object.freeze({ name: "Stansted Airport, United Kingdom", code: "EGSS", latitude: 51.885, longitude: 0.235, runwayHeading: 40, runwayLength: 3049, runwayWidth: 46 }),
]);

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (radiansValue) => radiansValue * 180 / Math.PI;

export function airportPosition(airport) {
  return [
    radians(airport.longitude) * 6371000 * Math.cos(radians(50)),
    radians(airport.latitude - 50) * 6371000,
  ];
}

export function runwayCoordinates(airport, x, y) {
  const [east, north] = airportPosition(airport);
  const heading = radians(airport.runwayHeading);
  const dx = x - east;
  const dy = y - north;
  return [
    dx * Math.sin(heading) + dy * Math.cos(heading),
    dx * Math.cos(heading) - dy * Math.sin(heading),
  ];
}

export function runwayContains(airport, x, y) {
  const [along, across] = runwayCoordinates(airport, x, y);
  return Math.abs(along) <= airport.runwayLength / 2
    && Math.abs(across) <= airport.runwayWidth / 2;
}

export const LOOK_PITCH_LIMIT = 80;
export const TIME_SCALES = Object.freeze([1, 2, 4, 8]);

// Wrap a look-around yaw to [-180, 180) degrees and limit pitch to +-80.
export function clampLook(yaw, pitch) {
  return [((yaw + 180) % 360 + 360) % 360 - 180, clamp(pitch, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT)];
}

// Fast-forward cycle: 1x, 2x, 4x, 8x, then back to 1x.
export function nextTimeScale(scale) {
  return TIME_SCALES[(TIME_SCALES.indexOf(scale) + 1) % TIME_SCALES.length];
}

export class Flight {
  constructor(aircraft = AIRCRAFT[0], departure = AIRPORTS[0], destination = AIRPORTS[1],
    windSpeed = 4, windFrom = 270, gusts = true) {
    this.aircraft = aircraft;
    this.departure = departure;
    this.destination = destination;
    const heading = radians(departure.runwayHeading);
    const [east, north] = airportPosition(departure);
    this.x = east - Math.sin(heading) * departure.runwayLength * 0.4;
    this.y = north - Math.cos(heading) * departure.runwayLength * 0.4;
    this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.heading = departure.runwayHeading;
    this.pitch = this.bank = this.throttle = 0;
    this.enginePower = 0;
    this.elevator = this.aileron = this.rudder = 0;
    this.pitchRate = this.rollRate = this.yawRate = 0;
    this.gearDown = true;
    this.gear = 1;
    this.lightsOn = true;
    this.windSpeed = windSpeed;
    this.windFrom = windFrom;
    this.gusts = gusts;
    this.time = 0;
    this.onGround = true;
    this.hasFlown = false;
    this.crashed = this.completed = this.stalled = false;
    this.damageKinds = [];
    this.dragDamage = 0;
    this.unflyable = false;
    this.veer = 1;
    this.assessAtRest = false;
    this.message = "Ready: add throttle, build speed, then gently raise the nose.";
  }

  get wind() {
    const direction = radians(this.windFrom);
    const gust = this.gusts ? 1.5 * Math.sin(this.time * 0.31) : 0;
    const speed = this.windSpeed ? Math.max(0, this.windSpeed + gust) : 0;
    return [-speed * Math.sin(direction), -speed * Math.cos(direction)];
  }

  get airspeed() {
    const [wx, wy] = this.wind;
    return Math.hypot(this.vx - wx, this.vy - wy, this.vz);
  }

  get groundSpeed() {
    return Math.hypot(this.vx, this.vy);
  }

  get navigation() {
    const [east, north] = airportPosition(this.destination);
    const dx = east - this.x;
    const dy = north - this.y;
    return [Math.hypot(dx, dy), (degrees(Math.atan2(dx, dy)) + 360) % 360];
  }

  get damage() {
    const wing = this.aircraft.engines > 1 ? "Wing/engine pod strike" : "Wing strike";
    return this.damageKinds.map((kind) => (kind === "wing" ? wing : DAMAGE[kind][0]));
  }

  addDamage(kind) {
    if (this.damageKinds.includes(kind)) return;
    this.damageKinds.push(kind);
    const [, drag, grounded] = DAMAGE[kind];
    this.dragDamage += drag;
    this.unflyable = this.unflyable || grounded;
  }

  damageMessage(prefix) {
    return `${prefix}: ${this.damage.join("; ")}.`;
  }

  // ISA: speed of sound falls to 295 m/s at the tropopause.
  get mach() {
    return this.airspeed / (340.3 - 4.5 * Math.min(Math.max(this.z, 0), 11000) / 1000);
  }

  get retractableGear() {
    return this.aircraft !== AIRCRAFT[0];
  }

  toggleGear() {
    if (this.crashed || this.completed) return;
    if (!this.retractableGear) this.message = "The Cessna has fixed landing gear.";
    else if (this.onGround) this.message = "Landing gear is locked down while on the ground.";
    else {
      this.gearDown = !this.gearDown;
      this.message = this.gearDown ? "Landing gear lowering." : "Landing gear retracting.";
    }
  }

  update(dt, elevator = 0, aileron = 0, rudder = 0, brake = false) {
    if (this.crashed || this.completed || dt <= 0) return;
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9 && !this.crashed && !this.completed) {
      const step = Math.min(remaining, 1 / 120);
      this.step(step, clamp(elevator, -1, 1), clamp(aileron, -1, 1),
        clamp(rudder, -1, 1), brake);
      remaining -= step;
    }
  }

  step(dt, elevator, aileron, rudder, brake) {
    this.time += dt;
    this.elevator = elevator;
    this.aileron = aileron;
    this.rudder = rudder;
    const jet = this.retractableGear;
    const response = jet ? 1.1 : 0.4;
    this.enginePower += (clamp(this.throttle, 0, 1) - this.enginePower)
      * (1 - Math.exp(-dt / (jet ? 3.5 : 0.65)));
    this.gear = clamp(this.gear + (this.gearDown ? 1 : -1) * dt / 5, 0, 1);
    const speed = this.airspeed;
    const authority = clamp((speed / (jet ? 65 : 28)) ** 2, 0, 1);
    const blend = 1 - Math.exp(-dt / response);
    this.pitchRate += (elevator * (jet ? 6 : 12) * authority - this.pitchRate) * blend;
    this.rollRate += (aileron * (jet ? 18 : 35) * authority - this.rollRate) * blend;
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -25, this.aircraft.maxPitch);
    this.bank = clamp(this.bank + this.rollRate * dt, -65, 65);
    if (this.pitch === -25 || this.pitch === this.aircraft.maxPitch) this.pitchRate = 0;
    if (this.bank === -65 || this.bank === 65) this.rollRate = 0;
    if (this.onGround) this.bank = this.rollRate = 0;
    const turn = this.onGround ? 0
      : degrees(G * Math.tan(radians(this.bank)) / Math.max(speed, 25));
    let steer = this.onGround ? Math.min(this.groundSpeed / 5, 1) : 0.3;
    let pull = 0;
    if (this.onGround && this.damageKinds.length) {
      // Damaged gear steers poorly and drags the aircraft to one side.
      steer *= this.unflyable ? 0.2 : this.damageKinds.includes("tyres") ? 0.5 : 1;
      pull = this.veer * 4 * Math.min(this.groundSpeed / 10, 1) * Math.min(this.dragDamage * 3, 1);
    }
    this.yawRate += (rudder * (jet ? 7 : 12) * steer + pull - this.yawRate) * blend;
    this.heading = (this.heading + (turn + this.yawRate) * dt + 360) % 360;
    const heading = radians(this.heading);
    const pitch = radians(this.pitch);
    const bank = radians(this.bank);
    const fx = Math.sin(heading);
    const fy = Math.cos(heading);
    const [wx, wy] = this.wind;
    const ax = this.vx - wx;
    const ay = this.vy - wy;
    const az = this.vz;
    const horizontal = Math.hypot(ax, ay);
    const gamma = Math.atan2(az, Math.max(horizontal, 0.1));
    const angleOfAttack = pitch - gamma;
    const craft = this.aircraft;
    this.stalled = Math.abs(angleOfAttack) > radians(craft.stallAngle) && speed > 15;
    let cl = clamp(craft.zeroLift + craft.liftSlope * angleOfAttack, -1.2, craft.clMax);
    if (this.stalled) {
      cl *= Math.max(0.2, 1 - (Math.abs(degrees(angleOfAttack)) - craft.stallAngle) / 30);
    }
    const density = 1.225 * Math.exp(-Math.max(this.z, 0) / 8500);
    const pressure = 0.5 * density * speed * speed;
    const lift = pressure * this.aircraft.wingArea * cl;
    const gearDrag = jet ? 0.018 * this.gear : 0.012;
    let waveDrag = 0;
    if (craft.supersonic) {
      // Transonic drag rise peaking near Mach 1.1, easing off supersonically.
      const mach = this.mach;
      waveDrag = mach < 1.1 ? 0.012 * clamp((mach - 0.85) / 0.25, 0, 1)
        : 0.006 + 0.006 * Math.exp(-(mach - 1.1) * 1.5);
    }
    const drag = pressure * craft.wingArea
      * (craft.dragBase + gearDrag + waveDrag + craft.dragInduced * cl * cl);
    const [ux, uy] = horizontal > 1 ? [ax / horizontal, ay / horizontal] : [fx, fy];
    const lx = -Math.sin(gamma) * ux * Math.cos(bank) + uy * Math.sin(bank);
    const ly = -Math.sin(gamma) * uy * Math.cos(bank) - ux * Math.sin(bank);
    const lz = Math.cos(gamma) * Math.cos(bank);
    let thrust = this.enginePower * this.aircraft.maxThrust;
    if (craft.supersonic) {
      // Dry thrust to 80% throttle, then afterburner (reheat) to full power.
      const power = this.enginePower;
      thrust = craft.maxThrust * (power <= 0.8 ? 0.875 * power : 0.7 + 1.5 * (power - 0.8));
      // Thrust lapses with air density, but supersonic ram effect recovers
      // much of it, so Mach 2 cruise remains possible.
      thrust *= (density / 1.225) ** 0.6 * (1 + 0.45 * Math.max(this.mach - 0.5, 0));
    }
    const mass = this.aircraft.mass;
    const accelerations = [
      (thrust * Math.cos(pitch) * fx + lift * lx - drag * ax / Math.max(speed, 0.1)) / mass,
      (thrust * Math.cos(pitch) * fy + lift * ly - drag * ay / Math.max(speed, 0.1)) / mass,
      (thrust * Math.sin(pitch) + lift * lz - drag * az / Math.max(speed, 0.1)) / mass - G,
    ];
    if (this.onGround) {
      const forward = this.vx * fx + this.vy * fy;
      const braking = 0.3 * Number(brake) * (this.damageKinds.includes("tyres") ? 0.5 : 1);
      const rolling = Math.min(Math.abs(forward) / dt, (0.025 + braking + this.dragDamage) * G);
      const along = accelerations[0] * fx + accelerations[1] * fy;
      const nextForward = Math.max(0, forward + (along - rolling) * dt);
      this.vx = nextForward * fx;
      this.vy = nextForward * fy;
      this.vz = this.unflyable ? 0 : Math.max(0, this.vz + accelerations[2] * dt);
      if (this.pitch > this.aircraft.tailStrikeAngle && this.groundSpeed > 10
        && !this.damageKinds.includes("tail")) {
        this.addDamage("tail");
        this.message = this.damageMessage("WARNING — tail strike on rotation");
      }
    } else {
      this.vx += accelerations[0] * dt;
      this.vy += accelerations[1] * dt;
      this.vz += accelerations[2] * dt;
    }
    const wasAirborne = !this.onGround;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    if (this.z > 0.1 && this.onGround) {
      this.onGround = false;
      this.hasFlown = true;
      this.message = "Airborne! Follow the destination bearing; keep an eye on airspeed.";
    }
    if (this.z <= 0) {
      if (wasAirborne) this.touchdown();
      this.z = this.vz = 0;
      this.onGround = true;
    }
    if (this.airspeed > this.aircraft.maxSpeed) {
      this.crashed = true;
      this.message = "Overspeed: the aircraft was damaged. Press R to try again.";
    } else if (this.assessAtRest && this.onGround && this.groundSpeed < 0.5 && !this.completed) {
      this.assessAtRest = false;
      if (runwayContains(this.destination, this.x, this.y)) {
        this.completed = true;
        this.message = this.damageMessage("Arrived, but the aircraft is damaged");
      } else if (this.unflyable) {
        this.message = this.damageMessage("Aircraft disabled, it cannot take off again. Press R to try again");
      } else {
        this.message = this.damageMessage("Stopped with damage, take-off is still possible");
      }
    }
  }

  touchdown() {
    const craft = this.aircraft;
    const runway = AIRPORTS.find((airport) => runwayContains(airport, this.x, this.y));
    const alignment = runway
      ? Math.abs((((this.heading - runway.runwayHeading + 90) % 180 + 180) % 180) - 90) : 180;
    const sink = -this.vz;
    const speed = this.airspeed;
    this.veer = this.bank >= 0 ? 1 : -1;
    let destroyed = null;
    if (sink > 8) destroyed = "Impact far too hard, the airframe broke up";
    else if (Math.abs(this.bank) > 45) destroyed = "A wing dug in and the aircraft cartwheeled";
    else if (alignment > 60 && runway) destroyed = "The aircraft slid sideways and rolled over";
    else if (!runway && speed > craft.landingSpeed * 1.5) destroyed = "High-speed impact off the runway";
    if (this.gear < 0.99) this.addDamage("belly");
    else {
      if (sink > 5) this.addDamage("gear");
      if (sink > 3 || speed > craft.landingSpeed * 1.1 || (alignment > 15 && alignment <= 30)) {
        this.addDamage("tyres");
      }
      if (alignment > 30 && alignment <= 60 && runway) this.addDamage("gear");
      if (this.pitch < -5) this.addDamage("nose_gear");
    }
    if (!runway) this.addDamage("terrain");
    if (Math.abs(this.bank) > craft.bankLimit) this.addDamage("wing");
    if (this.pitch > craft.tailStrikeAngle) this.addDamage("tail");
    if (destroyed) {
      this.crashed = true;
      this.message = this.damageKinds.length
        ? `${this.damageMessage(`CRASH, ${destroyed}. Damage`)} Press R to try again.`
        : `CRASH, ${destroyed}. Press R to try again.`;
    } else if (this.damageKinds.length) {
      this.assessAtRest = true;
      this.message = this.damageMessage("WARNING, damage on landing");
    } else if (runway === this.destination) {
      this.completed = true;
      this.message = "Successful arrival! Press R for another flight or Esc to choose a route.";
    } else {
      this.message = "Landed safely, but not at the destination. Take off to continue.";
    }
  }
}
