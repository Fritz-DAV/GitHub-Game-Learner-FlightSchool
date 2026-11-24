# GitHub-Game-Learner-FlightSchool

A playable Python starter for learning to build a flying game with GitHub Copilot.
Fly a **Cessna 172 Skyhawk**, **Boeing 737-800**, **Airbus A320**, or supersonic **Concorde** between
**Heathrow (EGLL)**, **Charles De Gaulle (LFPG)**, and **Stansted (EGSS)**, and **Edinburgh (EGPH)**.
Each airport has a runway, with edge, centreline and threshold markings.
Heathrow has both of its parallel runways and Paris CDG its four, and Heathrow, Edinburgh and
CDG have simplified terminal buildings, aprons and control towers. Landing on any of an airport's runways counts.
Choose different departure and destination airports before each flight.
Both editions and both camera views include patchwork fields, hedgerows and
trees that stay fixed as you fly. Approximate British and French coastlines
separate land from the English Channel. Towns and city districts include London,
Cambridge, Harlow, Chelmsford, Canterbury, Dover, Calais, Amiens, Paris and Edinburgh.
Follow simplified M25, M11, M1, M4, M20, M2 and A-road corridors between airports.
The Chilterns and North/South Downs provide southern relief; larger mountain
meshes are placed farther west/north in Eryri, Dartmoor and the Lake District,
not around flat London/Essex. Heathrow also has simplified terminal
buildings, aprons, taxiways and a control tower. Follow the approximate River
Thames east toward central London (about 25 km) to find bridges, the London Eye
and a Westminster-style tower.

The browser edition also has 3D shaded cumulus and a broken high cloud layer that
drift with the wind, plus optional fog (the Visibility menu: Clear, Random ≈20% foggy, or Foggy);
clear flights keep a crisp horizon. The Time of day menu (Day, Night, Random)
adds a night mode with a dark sky, stars, lit towns and cities, sodium-lit
motorways, runway/approach lights and aircraft navigation lights and strobes. Cities and towns follow hand-simplified built-up outlines
(London along the Thames, compact Paris, road- and coast-aligned towns) rather than
circles. The top-right map shows coastlines, the Thames, motorways, city areas, cloud
cover, your track and heading, and the distance to the destination runway.

Aircraft have metre-scale fuselages, cockpit/cabin glazing, wings, tails and
visible wheels. The Cessna has a high wing, struts, propeller and fixed gear;
the 737, A320 and Concorde have round tapered fuselages, rows of small cabin
windows, cockpit windscreens, swept wings (the Concorde an ogival delta with
a drooped nose), correctly sized engine nacelles, winglets and retractable gear. The wider cockpit view includes moving instrument
needles, a joystick following pitch/bank inputs, throttle levers, buttons and
status lamps. Twin jet levers move together with commanded throttle; the power
readout follows actual engine spool, which deliberately lags the levers.

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
| `browser/`: a standalone HTML canvas version with a JavaScript port of the flight model | Play in a browser without installing packages or changing the desktop game | Start a local web server and use keyboard, mouse or touch controls |
| Runway drawing, cockpit frame/instruments and an external plane drawing | Provide both requested viewpoints and visual landing cues | See ahead from inside the plane or watch it from behind; both views control the same aircraft |
| Keyboard controls, optional mouse steering and mouse-wheel throttle | Support both requested input devices | Fly with the keyboard alone or combine it with the mouse |
| Flight readings, destination bearing and route map | Help a beginner understand position and flight condition | Read airspeed, height, heading, power and climb/descent rate while navigating |
| Pause, background running, fast-forward, restart and menu return | Make practice easier to interrupt and repeat | Click another window without freezing the flight, retry a flight or choose another route without closing the game |
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

## Run the browser version

The browser edition is a separate version; it does not replace the Tkinter game.
From the project folder, start Python's built-in local web server:

```sh
python3 -m http.server 8000 --directory browser
```

Then open <http://localhost:8000> in a modern browser. Keep the server running
while you play; press `Ctrl+C` in the terminal to stop it. Serving the files
over HTTP is needed for the browser's JavaScript modules. No packages,
account, or internet connection are required.

The browser game supports the same aircraft, airports, wind choices, flight
model, cockpit and external views, route map, keyboard controls and mouse
steering as the desktop version. On touch screens, use the on-screen flight
buttons. The game keeps running if the browser window loses focus, but pauses if the tab is hidden.

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
| `G` | Extend / retract jet landing gear (five seconds; locked down on the ground) |
| `L` | Toggle instrument illumination |
| `M` | Toggle mouse steering: above centre raises the nose, left/right banks |
| `V` | Switch cockpit / external chase view |
| `1` / `2` | Choose cockpit / external view directly |
| Drag with the mouse | Look around (360° sideways, up/down to 80°) in cockpit or external view; the view stays put when you let go |
| `C` | Centre the view (also reset when you switch view or restart) |
| `F` | Fast-forward: 2x, then 4x, then 8x, then back to normal speed |
| `P` | Pause / resume |
| `R` | Restart the selected flight |
| Esc | Return to aircraft and airport selection |

Mouse steering is off initially. When enabled, return the mouse to the centre
to stop changing pitch/bank; use opposite input to level the plane.
The simulation keeps running when you click outside its window; held keys are
released and mouse steering is centred, but throttle and attitude stay as they
were. Press `P` to pause. In the browser, a hidden or minimised tab pauses
because browsers stop animating it.
A quick click on a cockpit button presses it; dragging never does.
The cockpit's **GEAR**, **LIGHTS** and **MOUSE** buttons are also clickable.
Browser touch users can use the **Landing gear** button above the view.
Three green gear lights mean fully down, amber means moving, and dark means up.

### Flight summary and damage

After a completed landing, a summary screen rates the take-off, flight and landing out of 100 (plus an
overall score), and shows time taken, distance flown, your flight path against the planned route on a map,
and an altitude chart. In the desktop app press **Enter** to hide or show it; **R** flies again.
Hard landings are visible on the aircraft: burst tyres show flattened dark-red wheels, and broken-off
landing gear leaves sheared stubs with the wheels lying on the ground.

## Your first flight

1. Pick the **Cessna**, **calm** weather and Heathrow → Stansted for the shorter
   route. Start in cockpit view to see the runway ahead.
2. Hold `+` to reach full throttle. Use `Q`/`E` gently to stay on the runway.
3. At about **55–60 knots**, briefly hold Down / `S` to raise the nose to roughly
   **5–8°**. For the jets, wait until about **130–140 knots**. These are game
   starting points, not real aircraft operating instructions.
4. Ease off pitch input early: rotation builds and settles rather than stopping
   instantly. Once climbing safely, press `G` to retract a jet's wheels.
   Climb, then lower the nose toward
   level flight and reduce power as needed. If **STALL** appears, lower the nose
   to regain speed. Reduce power if you approach the overspeed warning.
5. Follow the destination bearing shown at the top. Bank gently to turn, then
   use opposite bank input to level the wings. The map shows all four airports.
6. On approach, line up with the runway centreline: roughly **090°/270°** at
   Heathrow and Paris, **040°/220°** at Stansted, **060°/240°** at Edinburgh. The bearing points to the airport,
   not an automatic landing path; plan your turn to align before descending.
7. Lower a jet's gear with `G` at least **five seconds** before touchdown and
   check for three green lights. Reduce power and lower the nose gently.
   Aim for roughly **60–75 knots** in the
   Cessna or **140–160 knots** in a jet. Keep descent below **590 ft/min** at
   touchdown, bank within **12°**, nose between **−5° and +15°**, and heading within
   **15°** of the runway in either direction. A gentle touchdown on the destination
   runway completes the flight. Hard, fast or off-runway landings end the attempt.
   Landing a jet with gear up or still moving also ends the attempt.

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
- Pitch, roll and rudder rates build and decay with damping instead of changing
  attitude instantly. Jets respond more slowly than the Cessna, and control
  authority falls at low airspeed. Anticipate corrections rather than holding
  an input until the last moment.
- Engine power spools toward the throttle setting (about a 0.65-second response
  time for the Cessna and 3.5 seconds for jets). Aircraft mass still governs
  linear acceleration; extended landing gear adds aerodynamic drag.

This is a **simplified educational model**, not a realistic training simulator.
Concorde has a low-lift delta wing, afterburner thrust and transonic drag, so it
takes off fast and can go supersonic at altitude. Rough landings no longer just
end the flight: burst tyres, collapsed gear, belly landings, wing/engine strikes
and tail strikes appear as warnings and change how the aircraft rolls. Only
catastrophic impacts end the flight.

Aircraft have representative mass, wing area and thrust, but not certified
handling. There is one rounded, representative runway per airport, a flat ground
plane for ground contact, a shared runway elevation and an approximate local map.
Coastlines, road corridors, city blocks and relief are hand-simplified, not
satellite imagery or surveyed scenery. Hills/mountains, trees, water, buildings
and landmarks are visual only: terrain/obstacle collisions and water landings
are not simulated. Cockpits and external aircraft are stylised, not exact
replicas. Engine internals, flaps, real weather, air traffic and full
six-degree-of-freedom rigid-body rotation are not modelled.
Never use this game for real flying advice.

## Learn with Copilot, one small step at a time

The project is intentionally small:

- `flight_model.py`: airport/aircraft data and flight calculations.
- `flight_school.py`: desktop selection screen, controls, 3D-to-screen drawing and views.
- `scenery.py` and `browser/scenery.mjs`: matching geography, roads, relief, cities and landmarks.
- `aircraft_visuals.py` and `browser/aircraft-visuals.mjs`: distinct aircraft and animated wheel geometry.
- `browser/`: browser selection screen, canvas drawing, controls and JavaScript flight model.
- `tests/test_flight_model.py`: repeatable checks without opening a window.

Run the browser edition with the command in [Run the browser version](#run-the-browser-version), or launch the desktop edition using the command in [Run the game](#run-the-game).

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
Additional checks cover angular response, engine spool, gear locks/timing/drag,
gear-up landings, aircraft dimensions and visual wheel retraction.
Physics tests do not require Tkinter or a display. Optional window tests cover
route selection, drawing and input; they skip if Tkinter or a display is missing.
On Linux with Xvfb installed, run all checks on a virtual display with
`xvfb-run -a python3 -m unittest discover -s tests -v`.

Check the browser flight model, scenery and headless rendering with
`node --test tests/test_browser_*.mjs`.

For a manual window check, try each aircraft and route, change both views, use
mouse and keyboard, pause, restart, and try both a gentle runway landing and an
off-runway touchdown.
