export const G = 9.80665;

export const AIRCRAFT = Object.freeze([
  Object.freeze({ name: "Cessna 172 Skyhawk", mass: 1110, wingArea: 16.2, maxThrust: 2500, maxSpeed: 84, landingSpeed: 40 }),
  Object.freeze({ name: "Boeing 737-800", mass: 65000, wingArea: 124.6, maxThrust: 242000, maxSpeed: 250, landingSpeed: 85 }),
  Object.freeze({ name: "Airbus A320", mass: 64000, wingArea: 122.6, maxThrust: 240000, maxSpeed: 250, landingSpeed: 85 }),
]);

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
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -25, 30);
    this.bank = clamp(this.bank + this.rollRate * dt, -65, 65);
    if (this.pitch === -25 || this.pitch === 30) this.pitchRate = 0;
    if (this.bank === -65 || this.bank === 65) this.rollRate = 0;
    if (this.onGround) this.bank = this.rollRate = 0;
    const turn = this.onGround ? 0
      : degrees(G * Math.tan(radians(this.bank)) / Math.max(speed, 25));
    const steer = this.onGround ? Math.min(this.groundSpeed / 5, 1) : 0.3;
    this.yawRate += (rudder * (jet ? 7 : 12) * steer - this.yawRate) * blend;
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
    this.stalled = Math.abs(angleOfAttack) > radians(16) && speed > 15;
    let cl = clamp(0.3 + 4.8 * angleOfAttack, -1.2, 1.5);
    if (this.stalled) {
      cl *= Math.max(0.2, 1 - (Math.abs(degrees(angleOfAttack)) - 16) / 30);
    }
    const density = 1.225 * Math.exp(-Math.max(this.z, 0) / 8500);
    const pressure = 0.5 * density * speed * speed;
    const lift = pressure * this.aircraft.wingArea * cl;
    const gearDrag = jet ? 0.018 * this.gear : 0.012;
    const drag = pressure * this.aircraft.wingArea * (0.03 + gearDrag + 0.055 * cl * cl);
    const [ux, uy] = horizontal > 1 ? [ax / horizontal, ay / horizontal] : [fx, fy];
    const lx = -Math.sin(gamma) * ux * Math.cos(bank) + uy * Math.sin(bank);
    const ly = -Math.sin(gamma) * uy * Math.cos(bank) - ux * Math.sin(bank);
    const lz = Math.cos(gamma) * Math.cos(bank);
    const thrust = this.enginePower * this.aircraft.maxThrust;
    const mass = this.aircraft.mass;
    const accelerations = [
      (thrust * Math.cos(pitch) * fx + lift * lx - drag * ax / Math.max(speed, 0.1)) / mass,
      (thrust * Math.cos(pitch) * fy + lift * ly - drag * ay / Math.max(speed, 0.1)) / mass,
      (thrust * Math.sin(pitch) + lift * lz - drag * az / Math.max(speed, 0.1)) / mass - G,
    ];
    if (this.onGround) {
      const forward = this.vx * fx + this.vy * fy;
      const rolling = Math.min(Math.abs(forward) / dt, (0.025 + 0.3 * Number(brake)) * G);
      const along = accelerations[0] * fx + accelerations[1] * fy;
      const nextForward = Math.max(0, forward + (along - rolling) * dt);
      this.vx = nextForward * fx;
      this.vy = nextForward * fy;
      this.vz = Math.max(0, this.vz + accelerations[2] * dt);
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
    }
  }

  touchdown() {
    if (this.gear < 0.99) {
      this.crashed = true;
      this.message = "Landing gear was not fully down. Press R to try again.";
      return;
    }
    const runway = AIRPORTS.find((airport) => runwayContains(airport, this.x, this.y));
    const alignment = runway
      ? Math.abs((((this.heading - runway.runwayHeading + 90) % 180 + 180) % 180) - 90) : 180;
    if (!runway || this.vz < -3 || Math.abs(this.bank) > 12
      || this.pitch < -5 || this.pitch > 15 || alignment > 15
      || this.airspeed > this.aircraft.landingSpeed) {
      this.crashed = true;
      this.message = "Hard or off-runway landing. Press R to try again.";
    } else if (runway === this.destination) {
      this.completed = true;
      this.message = "Successful arrival! Press R for another flight or Esc to choose a route.";
    } else {
      this.message = "Landed safely, but not at the destination. Take off to continue.";
    }
  }
}
