import { AIRCRAFT, AIRPORTS, Flight, airportPosition } from "../browser/flight-model.mjs";

// Take off from the departure runway, then drop the aircraft onto the destination runway.
export function flyToArrival(departure = AIRPORTS[0], destination = AIRPORTS[2], sink = 1) {
  const f = new Flight(AIRCRAFT[0], departure, destination, 0, 270, false);
  f.throttle = 1;
  for (let i = 0; i < 60 * 40 && f.z < 30; i += 1) f.update(1 / 60, f.groundSpeed > 28 && f.pitch < 8 ? 1 : 0, 0, 0, false);
  const [x, y] = airportPosition(destination);
  const heading = destination.runwayHeading * Math.PI / 180;
  f.x = x - Math.sin(heading) * 300;
  f.y = y - Math.cos(heading) * 300;
  f.z = 0.5;
  f.heading = destination.runwayHeading;
  f.pitch = 3;
  f.bank = f.rollRate = f.pitchRate = 0;
  f.throttle = 0;
  f.vx = Math.sin(heading) * 33;
  f.vy = Math.cos(heading) * 33;
  f.vz = -sink;
  for (let i = 0; i < 60 * 60 && !f.completed && !f.crashed; i += 1) f.update(1 / 60, 0, 0, 0, true);
  return f;
}
