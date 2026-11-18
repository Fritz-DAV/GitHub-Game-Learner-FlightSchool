# GitHub-Game-Learner-FlightSchool

A playable Python starter for learning to build a flying game with GitHub Copilot.
Fly a **Cessna 172 Skyhawk**, **Boeing 737-800**, or **Airbus A320** between
**Heathrow (EGLL)**, **Charles De Gaulle (LFPG)**, and **Stansted (EGSS)**.
Each airport has a runway, with edge, centreline and threshold markings.
Choose different departure and destination airports before each flight.

## What changed, why, and what it means

The original repository contained only a project description. This update adds
a working learning game:

| Change | Why it was added | What it means for you |
| --- | --- | --- |
| `flight_model.py`: three aircraft presets and three airport/runway presets | Keep aircraft and airport details in one easy-to-read place | You can choose every requested plane and fly any of the six routes between different airports; changing a preset changes that plane or runway |
| Lift, drag, thrust, gravity, density, stalls, wind and gust calculations | Make flight respond to airflow rather than moving the plane like a car | Power, nose angle, banking and weather affect how the plane moves; each aircraft's mass, wing area and thrust affect its performance |
| Short calculation steps, ground contact and wheel brakes | Keep movement stable and support takeoff and landing | Planes start on a runway, can accelerate, fly, touch down and brake |
| Landing checks, stall/overspeed warnings and restart | Give the flight a goal and useful feedback | Gentle, aligned destination landings succeed; hard/off-runway landings and excessive speed end the attempt, and you can retry |
| `flight_school.py`: a Tkinter window and aircraft/route/weather selection | Make the Python model playable without third-party game packages | Run one command, pick a flight and choose calm, light or breezy weather |
| Runway drawing, cockpit frame/instruments and an external plane drawing | Provide both requested viewpoints and visual landing cues | See ahead from inside the plane or watch it from behind; both views control the same aircraft |
| Keyboard controls, optional mouse steering and mouse-wheel throttle | Support both requested input devices | Fly with the keyboard alone or combine it with the mouse |
| Flight readings, destination bearing and route map | Help a beginner understand position and flight condition | Read airspeed, height, heading, power and climb/descent rate while navigating |
| Pause, automatic pause on lost focus, restart and menu return | Make practice easier to interrupt and repeat | Switch away safely, retry a flight or choose another route without closing the game |
| `tests/test_flight_model.py` and `tests/test_flight_school.py` | Check flight rules and the window separately | Run repeatable checks; window checks skip when a desktop or Tkinter is unavailable |
| `.gitignore` entries for Python caches and a local virtual environment | Keep generated files out of commits | Your changes stay focused on source code rather than temporary Python files |
| This expanded README | Explain setup, controls, limitations and small Copilot-guided lessons | You have a starting guide and can understand what to change next and why |

“Working learning game” does not mean a professional simulator: the physics,
airport scenery and aircraft drawings are deliberately simplified. The
limitations below explain which parts are approximations.

## Run the game

Use **Python 3.10 or newer** on a computer with a desktop display:

```sh
python flight_school.py
```

Run this command from the project folder. On some systems use `python3` instead.
There are no pip packages to install. The window uses **Tkinter**, which comes
with most desktop Python installations. To check it, run `python -m tkinter`.
If it is missing on Ubuntu/Debian, install it with `sudo apt install python3-tk`
and use that system Python (`python3`). On Windows/macOS, use a Python installer
from python.org with Tcl/Tk support enabled. A terminal-only server cannot show
the game without a display.

## Controls

Click **Start flight** after choosing a plane, route and wind.

| Key / mouse | Action |
| --- | --- |
| `+` / `-` or Page Up / Page Down | Increase / decrease throttle (engine power) |
| Mouse wheel | Adjust throttle |
| Down arrow / `S` | Raise the nose |
| Up arrow / `W` | Lower the nose |
| Left / Right arrows or `A` / `D` | Bank left / right; opposite input levels the wings |
| `Q` / `E` | Steer on the runway; small heading adjustment in flight |
| Space | Hold wheel brakes on the ground |
| `M` | Toggle mouse steering: above centre raises the nose, left/right banks |
| `V` | Switch cockpit / external chase view |
| `1` / `2` | Choose cockpit / external view directly |
| `P` | Pause / resume |
| `R` | Restart the selected flight |
| Esc | Return to aircraft and airport selection |

Mouse steering is off initially. When enabled, return the mouse to the centre
to stop changing pitch/bank; use opposite input to level the plane.
The game pauses when its window loses focus.

## Your first flight

1. Pick the **Cessna**, **calm** weather and Heathrow → Stansted for the shorter
   route. Start in cockpit view to see the runway ahead.
2. Hold `+` to reach full throttle. Use `Q`/`E` gently to stay on the runway.
3. At about **55–60 knots**, briefly hold Down / `S` to raise the nose to roughly
   **5–8°**. For the jets, wait until about **130–140 knots**. These are game
   starting points, not real aircraft operating instructions.
4. Release pitch input to hold that attitude. Climb, then lower the nose toward
   level flight and reduce power as needed. If **STALL** appears, lower the nose
   to regain speed. Reduce power if you approach the overspeed warning.
5. Follow the destination bearing shown at the top. Bank gently to turn, then
   use opposite bank input to level the wings. The map shows all three airports.
6. On approach, line up with the runway centreline: roughly **090°/270°** at
   Heathrow and Paris, **040°/220°** at Stansted. The bearing points to the airport,
   not an automatic landing path; plan your turn to align before descending.
7. Reduce power and lower the nose gently. Aim for roughly **60–75 knots** in the
   Cessna or **140–160 knots** in a jet. Keep descent below **590 ft/min** at
   touchdown, bank within **12°**, nose between **−5° and +15°**, and heading within
   **15°** of the runway in either direction. A gentle touchdown on the destination
   runway completes the flight. Hard, fast or off-runway landings end the attempt.

Routes use roughly real distances, so flights are not instant. Restart and try
again whenever you like. There is no autopilot; balancing power, pitch and bank
is part of the exercise.

## What makes the plane fly?

`flight_model.py` keeps the flight rules separate from the window:

- **Thrust** pushes the plane forward; throttle controls its strength.
- **Gravity** pulls down; **lift** from the wings opposes it.
- Lift depends on air density, wing area, airspeed squared and the angle between
  the nose and the airflow. Excessive angle causes a **stall**, reducing lift.
- **Drag** slows the plane. Banking tilts lift sideways to make a turn.
- Wind and gentle gusts change the air moving past the wings. Airspeed and speed
  over the ground are different; a crosswind can carry you off your intended track.
- Small calculation steps keep flight and runway contact stable between frames.

This is a **simplified educational model**, not a realistic training simulator.
Aircraft have representative mass, wing area and thrust, but not certified
handling. There is one rounded, representative runway per airport, a flat ground
plane, a shared ground elevation and an approximate local map. Cockpits and
external aircraft are simple drawings, not replicas. Engine details, flaps,
landing gear operation, terrain, real weather, air traffic and full aircraft
rotation physics are not modelled. Never use this game for real flying advice.

## Learn with Copilot, one small step at a time

The project is intentionally small:

- `flight_model.py`: airport/aircraft data and flight calculations.
- `flight_school.py`: selection screen, controls, 3D-to-screen drawing and views.
- `tests/test_flight_model.py`: repeatable checks without opening a window.

Use the **github-tutor** agent if it is available in your Copilot agent picker.
If it is not installed, ask your normal Copilot chat to act as a patient tutor.
For example:

> Explain `Flight.update` in plain language. Help me make one small change,
> tell me why it helps, and ask me to predict what happens before running it.

Suggested lessons:

1. Change a runway colour in `_runway` and run the game. This teaches the
   drawing code without changing flight behaviour.
2. Read an aircraft preset. Predict how increasing mass changes takeoff,
   then change one value and compare.
3. Trace `Flight.wind` and `Flight.airspeed`. Compare calm and windy flights.
4. Inspect `_camera` to see why the cockpit and external views look different.
5. Ask Copilot to help write a test before adding your next feature.

Ask for explanations of the approach and observable results, rather than a large
unexplained code dump. Make a small commit after each working lesson.

## Check the flight rules

From the project folder:

```sh
python -m unittest discover -s tests -v
```

These standard-library tests cover aircraft/runway selection, takeoff,
throttle/brakes, wind, banked turns, stalls, navigation and landing outcomes.
Physics tests do not require Tkinter or a display. Optional window tests cover
route selection, drawing and input; they skip if Tkinter or a display is missing.
On Linux with Xvfb installed, run all checks on a virtual display with
`xvfb-run -a python3 -m unittest discover -s tests -v`.

For a manual window check, try each aircraft and route, change both views, use
mouse and keyboard, pause, restart, and try both a gentle runway landing and an
off-runway touchdown.
