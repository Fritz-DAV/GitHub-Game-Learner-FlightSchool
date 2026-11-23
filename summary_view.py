"""Post-landing summary panel drawn on a Tk canvas (or anything with its create_* methods)."""

import math

from flight_model import clamp
from scenery import CITY_POSITIONS, COASTS, clip_polygon, geographic

FEET = 3.28084


def format_duration(seconds):
    whole = round(seconds)
    return f"{whole // 60} min {whole % 60:02d} s"


def format_distance(metres):
    return f"{metres:.0f} m" if metres < 2000 else f"{metres / 1000:.1f} km"


def draw_summary(c, w, h, flight, summary):
    left, top, right, bottom = 70, 100, w - 70, h - 50
    c.create_rectangle(left, top, right, bottom, fill="#0c1a22", outline="#93bdc9", width=2)
    c.create_text(left + 20, top + 24, anchor="w", fill="#e6f4eb", font=("", 18, "bold"),
                  text="Flight complete")
    c.create_text(left + 20, top + 50, anchor="w", fill="#f2d89e",
                  text=f"{flight.aircraft.name}   |   {flight.departure.name} → "
                       f"{flight.destination.name}")
    scores = summary["scores"]
    box = (right - left - 40 - 3 * 10) / 4
    for i, (label, key) in enumerate((("Take-off", "takeoff"), ("Flight", "flight"),
                                      ("Landing", "landing"), ("Overall", "overall"))):
        x = left + 20 + i * (box + 10)
        c.create_rectangle(x, top + 66, x + box, top + 124, fill="#13232c",
                           outline="#f2d16b" if key == "overall" else "#2a3d47")
        c.create_text(x + 10, top + 80, anchor="w", fill="#93a9a2", text=label)
        c.create_text(x + 10, top + 106, anchor="w", fill="#e6f4eb", font=("", 20, "bold"),
                      text=f"{scores[key]} / 100")
    c.create_text(left + 20, top + 140, anchor="w", fill="#e6f4eb",
                  text=f"Total time {format_duration(summary['time'])}   |   "
                       f"Airborne {format_duration(summary['airborne_time'])}   |   "
                       f"Distance flown {format_distance(summary['distance'])}   |   "
                       f"Planned route {format_distance(summary['planned_distance'])}")
    chart_top, chart_bottom = top + 160, bottom - 40
    middle = (left + right) / 2
    draw_route_map(c, (left + 20, chart_top, middle - 8, chart_bottom), flight, summary)
    draw_altitude_chart(c, (middle + 8, chart_top, right - 20, chart_bottom), summary)
    c.create_text(w / 2, bottom - 20, fill="#a9ebca",
                  text="R: fly again   Esc: choose a different flight   Enter: hide/show summary")


def draw_route_map(c, area, flight, summary):
    x0, y0, x1, y1 = area
    w, h = x1 - x0, y1 - y0
    start, end = summary["planned"]
    points = [(p[0], p[1]) for p in summary["track"]] + [start, end]
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    centre = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
    span_x = max(max(xs) - min(xs), 30000) * 1.3
    span_y = max(max(ys) - min(ys), 30000 * h / w) * 1.3
    scale = min(w / span_x, h / span_y)

    def point(position):
        return (x0 + w / 2 + (position[0] - centre[0]) * scale,
                y0 + h / 2 - (position[1] - centre[1]) * scale)

    def clipped(shape):
        for edge in (lambda p: p[0] - x0, lambda p: x1 - p[0],
                     lambda p: p[1] - y0, lambda p: y1 - p[1]):
            shape = clip_polygon(shape, edge)
            if not shape:
                break
        return shape

    c.create_rectangle(x0, y0, x1, y1, fill="#2c5f7a", outline="")
    for coast in COASTS:
        shape = clipped([point(geographic(*p)) for p in coast])
        if len(shape) >= 3:
            c.create_polygon(*[v for p in shape for v in p], fill="#78915f", outline="")
    for (cx, cy), radius in CITY_POSITIONS:
        shape = clipped([point((cx + radius * math.cos(a * math.tau / 16),
                                cy + radius * 0.65 * math.sin(a * math.tau / 16)))
                         for a in range(16)])
        if len(shape) >= 3:
            c.create_polygon(*[v for p in shape for v in p], fill="#aaa99a", outline="")
    c.create_line(*point(start), *point(end), fill="#f2d16b", dash=(6, 5), width=2)
    flown = [v for p in summary["track"] for v in point(p)]
    if len(flown) >= 4:
        c.create_line(*flown, fill="#ff6a2b", width=3)
    for airport, position in ((flight.departure, start), (flight.destination, end)):
        x, y = point(position)
        c.create_oval(x - 4, y - 4, x + 4, y + 4, fill="white")
        c.create_text(x, y - 12, text=airport.code, fill="white", font=("", 9))
    c.create_text(x0 + 6, y1 - 24, anchor="w", fill="#f2d16b", text="- - planned route")
    c.create_text(x0 + 6, y1 - 9, anchor="w", fill="#ff9c6e", text="— route flown")


def draw_altitude_chart(c, area, summary):
    x0, y0, x1, y1 = area
    left, top, bottom = x0 + 48, y0 + 12, y1 - 20
    track = summary["track"]
    peak = max([p[2] * FEET for p in track] + [100])
    step = next((s for s in (100, 200, 500, 1000, 2000, 5000, 10000, 20000)
                 if peak / s <= 5), 20000)
    top_alt = math.ceil(peak / step) * step
    duration = max(summary["time"], 1)

    def px(t):
        return left + clamp(t / duration, 0, 1) * (x1 - 10 - left)

    def py(alt):
        return bottom - alt / top_alt * (bottom - top)

    c.create_rectangle(x0, y0, x1, y1, fill="#13232c", outline="")
    for alt in range(0, int(top_alt) + 1, step):
        c.create_line(left, py(alt), x1 - 10, py(alt), fill="#2a3d47")
        c.create_text(left - 5, py(alt), anchor="e", fill="#93a9a2", text=f"{alt} ft",
                      font=("", 8))
    line = [(px(p[3]), py(p[2] * FEET)) for p in track]
    if len(line) >= 2:
        area_points = [(left, bottom)] + line + [(line[-1][0], bottom)]
        c.create_polygon(*[v for p in area_points for v in p], fill="#5a3322", outline="")
        c.create_line(*[v for p in line for v in p], fill="#ff8b38", width=2)
    c.create_text(left, y1 - 8, fill="#93a9a2", text="0", font=("", 8))
    c.create_text(x1 - 40, y1 - 8, fill="#93a9a2", text=format_duration(duration), font=("", 8))
    c.create_text((x0 + x1) / 2, y0 + 4, fill="#93a9a2", text="Altitude through the flight",
                  font=("", 8))
