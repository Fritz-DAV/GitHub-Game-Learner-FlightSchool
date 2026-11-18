"""Run with python flight_school.py. Only Python and Tkinter are needed."""

import math
import time
import tkinter as tk
from tkinter import ttk

from flight_model import AIRCRAFT, AIRPORTS, Flight, clamp
from aircraft_visuals import aircraft_surfaces
from scenery import LAND_SURFACES, clip_polygon, heathrow_scenery, regional_scenery, terrain


class FlightSchool:
    def __init__(self, root):
        self.root = root
        root.title("Flight School — learn to fly")
        root.geometry("1100x760")
        root.minsize(900, 650)
        self.canvas = tk.Canvas(root, bg="#83bfdc", highlightthickness=0)
        self.menu = ttk.Frame(root, padding=30)
        self.keys = set()
        self.flight = None
        self.external = False
        self.paused = False
        self.mouse_enabled = False
        self.mouse = (0, 0)
        self.last_frame = time.perf_counter()
        self.london_ground, self.london_solids = heathrow_scenery()
        self.regional_ground, self.regional_solids = regional_scenery()
        self._build_menu()
        root.bind("<KeyPress>", self._key_down)
        root.bind("<KeyRelease>", lambda event: self.keys.discard(event.keysym.lower()))
        root.bind("<FocusOut>", lambda event: root.after_idle(self._focus_lost))
        self.canvas.bind("<Motion>", self._mouse_move)
        self.canvas.bind("<MouseWheel>", lambda event: self._wheel(event.delta / 120))
        self.canvas.bind("<Button-4>", lambda event: self._wheel(1))
        self.canvas.bind("<Button-5>", lambda event: self._wheel(-1))
        self.canvas.bind("<Button-1>", self._cockpit_click)
        self.show_menu()
        root.after(16, self._frame)

    def _build_menu(self):
        ttk.Label(self.menu, text="Flight School", font=("", 28, "bold")).pack(pady=12)
        ttk.Label(self.menu, text="Choose your plane and fly between two airports.",
                  font=("", 13)).pack(pady=8)
        self.plane_choice = tk.StringVar(value=AIRCRAFT[0].name)
        self.departure_choice = tk.StringVar(value=AIRPORTS[0].name)
        self.destination_choice = tk.StringVar(value=AIRPORTS[1].name)
        self.weather_choice = tk.StringVar(value="Light westerly — 4 m/s")
        for label, variable, choices in (
            ("Aircraft", self.plane_choice, [item.name for item in AIRCRAFT]),
            ("Departure", self.departure_choice, [item.name for item in AIRPORTS]),
            ("Destination", self.destination_choice, [item.name for item in AIRPORTS]),
            ("Wind", self.weather_choice,
             ["Calm", "Light westerly — 4 m/s", "Breezy southwesterly — 9 m/s"]),
        ):
            ttk.Label(self.menu, text=label).pack(anchor="w", pady=(8, 2))
            ttk.Combobox(self.menu, textvariable=variable, values=choices,
                         state="readonly", width=48).pack(fill="x")
        self.menu_message = ttk.Label(self.menu, text="", foreground="#a53020")
        self.menu_message.pack(pady=5)
        ttk.Button(self.menu, text="Start flight", command=self.start).pack(pady=8)
        ttk.Label(
            self.menu, justify="left",
            text="First flight: Cessna + calm wind is the easiest combination.\n\n"
                 "Throttle: + / − or mouse wheel     Pitch: ↑/↓ or W/S\n"
                 "Bank: ←/→ or A/D     Steering: Q/E     Brakes: Space\n"
                 "M: mouse steering     V: change view     P: pause\n"
                 "G: landing gear     L: instrument lights\n"
                 "R: restart     Esc: choose a different flight\n\n"
                 "Simplified learning simulator — not for real-world training.",
        ).pack(pady=12)

    def show_menu(self):
        self.keys.clear()
        self.canvas.pack_forget()
        self.menu.pack(expand=True)

    def start(self):
        if self.departure_choice.get() == self.destination_choice.get():
            self.menu_message.config(text="Choose two different airports.")
            return
        aircraft = next(item for item in AIRCRAFT if item.name == self.plane_choice.get())
        departure = next(item for item in AIRPORTS if item.name == self.departure_choice.get())
        destination = next(item for item in AIRPORTS if item.name == self.destination_choice.get())
        weather = self.weather_choice.get()
        speed = 0 if weather == "Calm" else 4 if weather.startswith("Light") else 9
        self.flight = Flight(aircraft, departure, destination, speed,
                             225 if speed == 9 else 270)
        self.keys.clear()
        self.mouse = (0, 0)
        self.paused = False
        self.menu.pack_forget()
        self.menu_message.config(text="")
        self.canvas.pack(fill="both", expand=True)
        self.canvas.focus_set()
        self.last_frame = time.perf_counter()

    def _key_down(self, event):
        if not self.canvas.winfo_ismapped():
            return
        key = event.keysym.lower()
        if key in self.keys:
            return
        self.keys.add(key)
        if key in ("v", "1", "2"):
            self.external = not self.external if key == "v" else key == "2"
        elif key == "p":
            self.paused = not self.paused
        elif key == "m":
            self.mouse_enabled = not self.mouse_enabled
            self.mouse = (0, 0)
        elif key == "g" and self.flight and not self.paused:
            self.flight.toggle_gear()
        elif key == "l" and self.flight and not self.paused:
            self.flight.lights_on = not self.flight.lights_on
        elif key == "r":
            self.start()
        elif key == "escape":
            self.show_menu()

    def _focus_lost(self):
        if self.canvas.winfo_ismapped() and self.root.focus_displayof() is None:
            self.keys.clear()
            self.mouse = (0, 0)
            self.paused = True

    def _cockpit_click(self, event):
        self.canvas.focus_set()
        if not self.flight or self.external or self.paused:
            return
        w, h = self.canvas.winfo_width(), self.canvas.winfo_height()
        if h * 0.79 + 12 <= event.y <= h * 0.79 + 42:
            for x, action in ((0.69, self.flight.toggle_gear),
                              (0.8, self._toggle_lights), (0.91, self._toggle_mouse)):
                if abs(event.x - w * x) < w * 0.045:
                    action()
                    break

    def _toggle_lights(self):
        self.flight.lights_on = not self.flight.lights_on

    def _toggle_mouse(self):
        self.mouse_enabled = not self.mouse_enabled
        self.mouse = (0, 0)

    def _mouse_move(self, event):
        w, h = self.canvas.winfo_width(), self.canvas.winfo_height()
        self.mouse = (
            clamp((event.x - w / 2) / (w * 0.35), -1, 1),
            clamp((h / 2 - event.y) / (h * 0.35), -1, 1),
        )

    def _wheel(self, amount):
        if self.flight and self.canvas.winfo_ismapped() and not self.paused:
            self.flight.throttle = clamp(self.flight.throttle + amount * 0.05, 0, 1)

    def _axis(self, positive, negative):
        return int(bool(self.keys.intersection(positive))) - int(
            bool(self.keys.intersection(negative)))

    def _frame(self):
        now = time.perf_counter()
        dt = min(now - self.last_frame, 0.1)
        self.last_frame = now
        if self.flight and self.canvas.winfo_ismapped():
            if not self.paused:
                throttle = self._axis({"plus", "equal", "prior"}, {"minus", "next"})
                self.flight.throttle = clamp(self.flight.throttle + throttle * dt * 0.3, 0, 1)
                elevator = self._axis({"down", "s"}, {"up", "w"})
                aileron = self._axis({"right", "d"}, {"left", "a"})
                if self.mouse_enabled:
                    aileron += self.mouse[0]
                    elevator += self.mouse[1]
                self.flight.update(dt, elevator, aileron,
                                   self._axis({"e"}, {"q"}), brake="space" in self.keys)
            self.draw()
        self.root.after(16, self._frame)

    def _camera(self):
        f = self.flight
        heading = math.radians(f.heading)
        if self.external:
            distance, height = (32, 11) if f.aircraft == AIRCRAFT[0] else (85, 28)
            self.eye = (f.x - math.sin(heading) * distance,
                        f.y - math.cos(heading) * distance, f.z + height)
            pitch, bank = math.radians(-12), 0
        else:
            self.eye = (f.x, f.y, f.z + (2 if f.aircraft == AIRCRAFT[0] else 5))
            pitch, bank = math.radians(f.pitch), math.radians(f.bank)
        right = (math.cos(heading), -math.sin(heading), 0)
        up = (-math.sin(heading) * math.sin(pitch),
              -math.cos(heading) * math.sin(pitch), math.cos(pitch))
        self.forward = (math.sin(heading) * math.cos(pitch),
                        math.cos(heading) * math.cos(pitch), math.sin(pitch))
        self.right = tuple(r * math.cos(bank) - u * math.sin(bank) for r, u in zip(right, up))
        self.up = tuple(u * math.cos(bank) + r * math.sin(bank) for r, u in zip(right, up))
        self.camera_pitch, self.camera_bank = pitch, bank

    def _camera_point(self, point):
        relative = tuple(p - e for p, e in zip(point, self.eye))
        return tuple(sum(a * b for a, b in zip(relative, axis))
                     for axis in (self.right, self.up, self.forward))

    def _project(self, point):
        x, y, depth = point
        return self.width / 2 + self.focal * x / depth, self.height / 2 - self.focal * y / depth

    def _clip(self, points):
        return clip_polygon(points, lambda p: p[2] - 1)

    def _view_planes(self):
        return (
            lambda p: p[2] - 1,
            lambda p: p[2] * self.width / 2 + p[0] * self.focal,
            lambda p: p[2] * self.width / 2 - p[0] * self.focal,
            lambda p: p[2] * self.height / 2 + p[1] * self.focal,
            lambda p: p[2] * self.height / 2 - p[1] * self.focal,
        )

    def _polygon(self, points, color):
        camera_points = [self._camera_point(point) for point in points]
        if (min(point[2] for point in camera_points) > 50000
                or max(point[2] for point in camera_points) < 1):
            return
        clipped = camera_points
        for plane in self._view_planes():
            clipped = clip_polygon(clipped, plane)
        if len(clipped) >= 3:
            coordinates = [value for point in clipped for value in self._project(point)]
            self.canvas.create_polygon(*coordinates, fill=color, outline="")

    def _ground_line(self, first, second, color):
        a, b = self._camera_point(first), self._camera_point(second)
        for plane in self._view_planes():
            da, db = plane(a), plane(b)
            if da < 0 and db < 0:
                return
            if (da >= 0) != (db >= 0):
                ratio = da / (da - db)
                intersection = tuple(x + ratio * (y - x) for x, y in zip(a, b))
                if da < 0:
                    a = intersection
                else:
                    b = intersection
        self.canvas.create_line(*self._project(a), *self._project(b), fill=color)

    @staticmethod
    def _runway_point(airport, along, across, height=0.05):
        x, y = airport.position
        heading = math.radians(airport.runway_heading)
        return (x + along * math.sin(heading) + across * math.cos(heading),
                y + along * math.cos(heading) - across * math.sin(heading), height)

    def _runway(self, airport):
        length, width = airport.runway_length / 2, airport.runway_width / 2
        self._polygon([self._runway_point(airport, a, b) for a, b in (
            (-length, -width - 10), (length, -width - 10),
            (length, width + 10), (-length, width + 10))], "#506a46")
        self._polygon([self._runway_point(airport, a, b) for a, b in (
            (-length, -width), (length, -width), (length, width), (-length, width))], "#444b50")
        for across in (-width + 1, width - 1):
            self._ground_line(self._runway_point(airport, -length, across),
                              self._runway_point(airport, length, across), "#eeeecc")
        for along in range(int(-length + 60), int(length - 60), 120):
            self._polygon([self._runway_point(airport, a, b) for a, b in (
                (along, -0.8), (along + 45, -0.8), (along + 45, 0.8), (along, 0.8))], "white")
        for end in (-1, 1):
            for across in (-0.7, -0.4, 0.4, 0.7):
                start = end * (length - 35)
                stop = end * (length - 70)
                center = across * width
                self._polygon([self._runway_point(airport, a, b) for a, b in (
                    (start, center - 1), (stop, center - 1),
                    (stop, center + 1), (start, center + 1))], "white")
        label = self._camera_point((*airport.position, 35))
        if label[2] > 1:
            self.canvas.create_text(*self._project(label), text=airport.code,
                                    fill="#ffffff", font=("", 13, "bold"))

    def _plane(self):
        f = self.flight
        heading, pitch, bank = map(math.radians, (f.heading, f.pitch, f.bank))
        def world(point):
            across, along, up = point
            across, up = (across * math.cos(bank) + up * math.sin(bank),
                          up * math.cos(bank) - across * math.sin(bank))
            along, up = (along * math.cos(pitch) - up * math.sin(pitch),
                         up * math.cos(pitch) + along * math.sin(pitch))
            return (f.x + across * math.cos(heading) + along * math.sin(heading),
                    f.y - across * math.sin(heading) + along * math.cos(heading),
                    f.z + (1.5 if f.aircraft == AIRCRAFT[0] else 3.3) + up)

        surfaces = aircraft_surfaces(f.aircraft, f.gear, f.time, f.engine_power)
        transformed = [([world(point) for point in points], color) for points, color in surfaces]
        return transformed

    def _map(self):
        f, c = self.flight, self.canvas
        x0, y0, w, h = self.width - 210, 105, 195, 160
        c.create_rectangle(x0, y0, x0 + w, y0 + h, fill="#192d39", outline="#93bdc9")
        positions = [airport.position for airport in AIRPORTS] + [(f.x, f.y)]
        xmin, xmax = min(p[0] for p in positions), max(p[0] for p in positions)
        ymin, ymax = min(p[1] for p in positions), max(p[1] for p in positions)
        scale = min((w - 40) / max(xmax - xmin, 1), (h - 40) / max(ymax - ymin, 1))

        def point(position):
            return (x0 + w / 2 + (position[0] - (xmin + xmax) / 2) * scale,
                    y0 + h / 2 - (position[1] - (ymin + ymax) / 2) * scale)

        c.create_line(*point(f.departure.position), *point(f.destination.position),
                      fill="#e2bb53", dash=(4, 4))
        for airport in AIRPORTS:
            x, y = point(airport.position)
            c.create_oval(x - 3, y - 3, x + 3, y + 3, fill="white")
            c.create_text(x, y - 10, text=airport.code, fill="white", font=("", 9))
        x, y = point((f.x, f.y))
        c.create_oval(x - 4, y - 4, x + 4, y + 4, fill="#ff8b38")
        c.create_text(x0 + 10, y0 + h - 10, anchor="w", text="N ↑   Route map", fill="#b9d1da")

    def draw(self):
        c, f = self.canvas, self.flight
        self.width, self.height = c.winfo_width(), c.winfo_height()
        self.focal = self.width * (0.75 if self.external else 0.58)
        c.delete("all")
        self._camera()
        # A screen ray hits flat ground exactly when its world Z points down.
        screen = [(0, 0), (self.width, 0), (self.width, self.height), (0, self.height)]
        ground_screen = clip_polygon(screen, lambda p: -(
            self.right[2] * (p[0] - self.width / 2) / self.focal
            + self.up[2] * (self.height / 2 - p[1]) / self.focal + self.forward[2]))
        if len(ground_screen) >= 3:
            c.create_polygon(*[v for p in ground_screen for v in p], fill="#528c9c", outline="")
        ground, solids = terrain(f.x, f.y)
        solids = list(solids)
        for points, color in LAND_SURFACES + ground + self.regional_ground + self.london_ground:
            self._polygon(points, color)
        for airport in sorted(AIRPORTS, key=lambda a: math.dist(a.position, (f.x, f.y)), reverse=True):
            if math.dist(airport.position, (f.x, f.y)) < 50000:
                self._runway(airport)
        if self.external:
            solids.extend(self._plane())
        solids.extend(self.london_solids)
        solids.extend((points, color) for points, color in self.regional_solids
                      if any(math.hypot(p[0] - f.x, p[1] - f.y) < 40000 for p in points))
        solids.sort(key=lambda item: sum(self._camera_point(p)[2] for p in item[0]) / len(item[0]),
                    reverse=True)
        for points, color in solids:
            self._polygon(points, color)
        if not self.external:
            self._cockpit()
        self._hud()
        self._map()

    def _cockpit(self):
        c, f, w, h = self.canvas, self.flight, self.width, self.height
        top = h * 0.79
        ink = "#a9ebca" if f.lights_on else "#86958d"
        c.create_line(0, top, w * 0.045, 90, fill="#26313b", width=9)
        c.create_line(w, top, w * 0.955, 90, fill="#26313b", width=9)
        c.create_rectangle(0, top, w, h, fill="#202c36", outline="#52616b", width=4)
        radius = min(w * 0.035, h * 0.048)
        for x, label, value, reading in (
            (0.075, "AIRSPEED", f.airspeed / f.aircraft.max_speed, f"{f.airspeed * 1.94384:.0f} kt"),
            (0.19, "ALTITUDE", (f.z * 3.28084 % 10000) / 10000, f"{f.z * 3.28084:.0f} ft"),
            (0.305, "HEADING", f.heading / 360, f"{f.heading:03.0f}"),
            (0.42, "CLIMB", clamp(0.5 + f.vz / 30, 0, 1), f"{f.vz * 196.85:+.0f} fpm"),
        ):
            cx, cy = w * x, top + radius + 16
            c.create_oval(cx - radius, cy - radius, cx + radius, cy + radius,
                          fill="#101b23", outline="#6b7c87", width=3)
            for i in range(11):
                angle = math.radians(-225 + i * 27)
                c.create_line(cx + math.cos(angle) * radius * 0.78,
                              cy + math.sin(angle) * radius * 0.78,
                              cx + math.cos(angle) * radius * 0.92,
                              cy + math.sin(angle) * radius * 0.92, fill=ink)
            angle = math.radians(-225 + clamp(value, 0, 1) * 270)
            c.create_line(cx, cy, cx + math.cos(angle) * radius * 0.72,
                          cy + math.sin(angle) * radius * 0.72, fill="#f3ce77", width=3)
            c.create_text(cx, cy + radius + 12, text=label, fill=ink, font=("", 8))
            c.create_text(cx, cy + radius + 28, text=reading, fill=ink, font=("", 10))
        sx, sy = w * 0.52, h - 28
        grip_x, grip_y = sx + f.aileron * 23, sy - 47 + f.elevator * 18
        c.create_oval(sx - 20, sy - 8, sx + 20, sy + 8, fill="#101820", outline="#66717b")
        c.create_line(sx, sy, grip_x, grip_y, fill="#7e8d96", width=9)
        c.create_rectangle(grip_x - 8, grip_y - 15, grip_x + 8, grip_y + 5,
                           fill="#111a21", outline="#7b8d98", width=2)
        c.create_oval(grip_x - 3, grip_y - 12, grip_x + 3, grip_y - 6, fill="#d95746")
        for i in range(1 if f.aircraft == AIRCRAFT[0] else 2):
            tx = w * 0.59 + i * 18
            c.create_rectangle(tx - 4, top + 20, tx + 4, h - 30, fill="#0c141b", outline="#66717b")
            ty = h - 36 - f.throttle * (h - top - 64)
            c.create_line(tx, h - 28, tx, ty, fill="#8d9ba4", width=4)
            c.create_rectangle(tx - 9, ty - 6, tx + 9, ty + 6, fill="#dde0d6", outline="#555f64")
        c.create_text(w * 0.61, h - 14, text=f"THRUST {f.engine_power:.0%}", fill=ink, font=("", 8))
        for x, label in ((0.69, "GEAR [G]"), (0.8, "LIGHTS [L]"), (0.91, "MOUSE [M]")):
            c.create_rectangle(w * (x - 0.045), top + 12, w * (x + 0.045), top + 42,
                               fill="#394b58", outline="#81939d")
            c.create_text(w * x, top + 27, text=label, fill=ink, font=("", 9))
        gear_color = "#73ec94" if f.gear >= 0.99 else "#edb64d" if f.gear > 0.01 else "#36434c"
        for x in (0.67, 0.69, 0.71):
            c.create_oval(w * x - 4, top + 51, w * x + 4, top + 59, fill=gear_color)
        c.create_text(w * 0.69, top + 74, text="DOWN" if f.gear >= 0.99 else
                      "TRANSIT" if f.gear > 0.01 else "UP", fill=ink, font=("", 8))
        for x, label, active in ((0.8, "POWER", f.engine_power > 0.1),
                                 (0.91, "STALL", f.stalled)):
            c.create_oval(w * x - 5, top + 51, w * x + 5, top + 61,
                          fill=("#f17252" if f.stalled and label == "STALL" else "#73ec94")
                          if active else "#36434c")
            c.create_text(w * x, top + 74, text=label, fill=ink, font=("", 8))
        c.create_text(w * 0.82, top + 99,
                      text=f"PITCH {f.pitch:+.0f}   BANK {f.bank:+.0f}", fill=ink, font=("", 9))

    def _hud(self):
        c, f = self.canvas, self.flight
        w, h = self.width, self.height
        distance, bearing = f.navigation
        c.create_rectangle(0, 0, w, 90, fill="#172936", outline="")
        c.create_text(18, 19, anchor="w", fill="white", font=("", 13, "bold"),
                      text=f"{f.aircraft.name}   |   {f.departure.code} → {f.destination.code}"
                           f"   |   {'External' if self.external else 'Cockpit'} view")
        c.create_text(18, 47, anchor="w", fill="#a9ebca", font=("TkFixedFont", 12),
                      text=f"AIR {f.airspeed * 1.94384:5.0f} kt   "
                           f"ALT {f.z * 3.28084:6.0f} ft   HDG {f.heading:03.0f}°   "
                           f"THR {f.throttle:3.0%}   V/S {f.vz * 196.85:+5.0f} ft/min")
        c.create_text(18, 73, anchor="w", fill="white",
                      text=f"To {f.destination.code}: {distance / 1000:.1f} km / {bearing:03.0f}°"
                           f"     Wind FROM {f.wind_from:03.0f}° at {math.hypot(*f.wind):.1f} m/s"
                           f"     Mouse steering: {'ON' if self.mouse_enabled else 'OFF'}")
        cx, cy = w / 2, h / 2
        c.create_line(cx - 20, cy, cx - 5, cy, fill="#fff3aa", width=2)
        c.create_line(cx + 5, cy, cx + 20, cy, fill="#fff3aa", width=2)
        c.create_line(cx, cy - 5, cx, cy + 5, fill="#fff3aa", width=2)
        if self.mouse_enabled:
            mx, my = self.mouse
            c.create_oval(cx + mx * 70 - 5, cy - my * 70 - 5,
                          cx + mx * 70 + 5, cy - my * 70 + 5, outline="white")
        if self.external:
            c.create_rectangle(0, h - 100, w, h, fill="#172936", outline="")
            c.create_text(18, h - 80, anchor="w", fill="#ffd47d", text=f.message, font=("", 12))
            c.create_text(18, h - 51, anchor="w", fill="white",
                          text="Arrows/WASD pitch/bank · Q/E steer · +/− throttle · Space brake · G gear · L lights")
            c.create_text(18, h - 25, anchor="w", fill="white",
                          text="V views · M mouse · Wheel throttle · P pause · R restart · Esc menu")
        else:
            c.create_text(18, 103, anchor="w", fill="#fff3aa", text=f.message, font=("", 10))
        warning = ("PAUSED — P to continue" if self.paused else
                   "FLIGHT COMPLETE" if f.completed else "FLIGHT ENDED — R to retry" if f.crashed else
                   "STALL — lower the nose" if f.stalled else
                   "OVERSPEED — reduce throttle" if f.airspeed > f.aircraft.max_speed * 0.9 else "")
        if warning:
            c.create_rectangle(w / 2 - 220, 108, w / 2 + 220, 148, fill="#472e28", outline="")
            c.create_text(w / 2, 128, text=warning, fill="#ffdf91", font=("", 16, "bold"))


def main():
    try:
        root = tk.Tk()
    except tk.TclError as error:
        raise SystemExit("Cannot open a game window. Run on a desktop with a display.\n"
                         f"Details: {error}") from error
    FlightSchool(root)
    root.mainloop()


if __name__ == "__main__":
    main()
