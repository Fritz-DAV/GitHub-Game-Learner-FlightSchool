"""Run with python flight_school.py. Only Python and Tkinter are needed."""

import math
import time
import tkinter as tk
from tkinter import ttk

from flight_model import AIRCRAFT, AIRPORTS, Flight, clamp


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
        self._build_menu()
        root.bind("<KeyPress>", self._key_down)
        root.bind("<KeyRelease>", lambda event: self.keys.discard(event.keysym.lower()))
        root.bind("<FocusOut>", lambda event: root.after_idle(self._focus_lost))
        self.canvas.bind("<Motion>", self._mouse_move)
        self.canvas.bind("<MouseWheel>", lambda event: self._wheel(event.delta / 120))
        self.canvas.bind("<Button-4>", lambda event: self._wheel(1))
        self.canvas.bind("<Button-5>", lambda event: self._wheel(-1))
        self.canvas.bind("<Button-1>", lambda event: self.canvas.focus_set())
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
        elif key == "r":
            self.start()
        elif key == "escape":
            self.show_menu()

    def _focus_lost(self):
        if self.canvas.winfo_ismapped() and self.root.focus_displayof() is None:
            self.keys.clear()
            self.mouse = (0, 0)
            self.paused = True

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
            self.eye = (f.x - math.sin(heading) * 85,
                        f.y - math.cos(heading) * 85, f.z + 28)
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
        # Clip polygons at the camera's near plane before dividing by depth.
        result = []
        for previous, current in zip(points[-1:] + points[:-1], points):
            if (previous[2] >= 1) != (current[2] >= 1):
                ratio = (1 - previous[2]) / (current[2] - previous[2])
                result.append(tuple(a + ratio * (b - a) for a, b in zip(previous, current)))
            if current[2] >= 1:
                result.append(current)
        return result

    def _polygon(self, points, color):
        camera_points = [self._camera_point(point) for point in points]
        if min(point[2] for point in camera_points) > 50000:
            return
        clipped = self._clip(camera_points)
        if len(clipped) >= 3:
            coordinates = [value for point in clipped for value in self._project(point)]
            self.canvas.create_polygon(*coordinates, fill=color, outline="")

    def _ground_line(self, first, second, color):
        a, b = self._camera_point(first), self._camera_point(second)
        if a[2] < 1 and b[2] < 1:
            return
        if a[2] < 1 or b[2] < 1:
            ratio = (1 - a[2]) / (b[2] - a[2])
            intersection = tuple(x + ratio * (y - x) for x, y in zip(a, b))
            if a[2] < 1:
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
        size = 1 if f.aircraft == AIRCRAFT[0] else 3

        def world(point):
            across, along, up = (value * size for value in point)
            across, up = (across * math.cos(bank) + up * math.sin(bank),
                          up * math.cos(bank) - across * math.sin(bank))
            along, up = (along * math.cos(pitch) - up * math.sin(pitch),
                         up * math.cos(pitch) + along * math.sin(pitch))
            return (f.x + across * math.cos(heading) + along * math.sin(heading),
                    f.y - across * math.sin(heading) + along * math.cos(heading),
                    f.z + 1.5 * size + up)

        surfaces = [
            ([(-1, -4, 0), (0, 5, 0), (1, -4, 0)], "#eeeeee"),
            ([(-5.5, -1, 0), (0, 1, 0), (5.5, -1, 0), (0, -2, 0)], "#d9e3ec"),
            ([(-2, -3.5, 0), (2, -3.5, 0), (0, -2.5, 0)], "#f1b84e"),
            ([(0, -4, 0), (0, -3.5, 2), (0, -2, 0)], "#e8ac36"),
        ]
        transformed = [([world(point) for point in points], color) for points, color in surfaces]
        transformed.sort(key=lambda item: sum(self._camera_point(p)[2] for p in item[0]) / len(item[0]),
                         reverse=True)
        for points, color in transformed:
            self._polygon(points, color)

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
        self.focal = self.width * 0.75
        c.delete("all")
        self._camera()
        extent = self.width * 5
        horizon = self.height / 2 + self.focal * math.tan(self.camera_pitch)
        slope = math.tan(self.camera_bank)
        c.create_polygon(-extent, horizon + extent * slope,
                         extent, horizon - extent * slope,
                         extent, self.height + extent, -extent, self.height + extent,
                         fill="#668852", outline="")
        spacing = 1000
        x0, y0 = int(f.x // spacing) * spacing, int(f.y // spacing) * spacing
        for offset in range(-8, 9):
            self._ground_line((x0 + offset * spacing, y0 - 8000, 0),
                              (x0 + offset * spacing, y0 + 8000, 0), "#76965f")
            self._ground_line((x0 - 8000, y0 + offset * spacing, 0),
                              (x0 + 8000, y0 + offset * spacing, 0), "#76965f")
        for airport in sorted(AIRPORTS, key=lambda a: math.dist(a.position, (f.x, f.y)), reverse=True):
            if math.dist(airport.position, (f.x, f.y)) < 50000:
                self._runway(airport)
        if self.external:
            self._plane()
        else:
            # A simple cockpit frame and instrument panel, not an aircraft replica.
            c.create_line(0, self.height, self.width * 0.14, 0, fill="#26313b", width=16)
            c.create_line(self.width, self.height, self.width * 0.86, 0, fill="#26313b", width=16)
            c.create_rectangle(0, self.height - 155, self.width, self.height, fill="#202c36", outline="")
        self._hud()
        self._map()

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
        c.create_rectangle(0, h - 100, w, h, fill="#172936", outline="")
        c.create_text(18, h - 80, anchor="w", fill="#ffd47d", text=f.message, font=("", 12))
        c.create_text(18, h - 51, anchor="w", fill="white",
                      text="↑/W nose down · ↓/S nose up · ←/A →/D bank · Q/E steer · +/− throttle · Space brake")
        c.create_text(18, h - 25, anchor="w", fill="white",
                      text="V views (1 cockpit, 2 external) · M mouse · Wheel throttle · P pause · R restart · Esc menu")
        if not self.external:
            c.create_text(w / 2, h - 128, fill="#a9ebca", font=("TkFixedFont", 12),
                          text=f"PITCH {f.pitch:+5.1f}°   BANK {f.bank:+5.1f}°   "
                               f"GROUND {f.ground_speed * 1.94384:.0f} kt")
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
