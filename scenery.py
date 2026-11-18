"""Low-poly visual scenery; coordinates share the flight model's flat ground."""

import math
from functools import lru_cache

from flight_model import AIRPORTS


FIELD_COLORS = ("#718953", "#82935e", "#647e49", "#96976a", "#748654")
THAMES = ((3500, -4000), (6500, -4800), (9500, -3000), (13000, -3300),
          (16000, -1000), (19000, -1700), (21500, 800), (23700, 500),
          (24800, 2200), (25500, 3100), (25900, 5300), (28500, 5800),
          (31000, 3600), (34000, 4000))

# Hand-simplified coastlines, not navigation data; pairs are longitude/latitude.
COASTS = (
    ((-5.7, 50.05), (-5.05, 50.15), (-4.2, 50.35), (-3.65, 50.22),
     (-3.5, 50.6), (-2.45, 50.6), (-2.0, 50.72), (-1.35, 50.75),
     (-0.8, 50.77), (0.25, 50.74), (0.98, 50.92), (1.3, 51.13),
     (1.42, 51.37), (0.9, 51.36), (0.75, 51.47), (0.95, 51.62),
     (1.25, 51.77), (1.28, 52.0), (1.75, 52.48), (1.65, 52.9),
     (0.95, 52.97), (0.35, 52.8), (0.05, 53.0), (0.3, 53.45),
     (-0.12, 53.6), (0.1, 54.0), (-0.7, 54.55), (-1.3, 54.7),
     (-1.65, 55.55), (-2.1, 55.9), (-3.2, 56.0), (-2.5, 56.5),
     (-1.8, 57.5), (-3.1, 57.7), (-4.0, 57.9), (-3.1, 58.6),
     (-5.0, 58.6), (-5.8, 57.8), (-5.7, 56.7), (-6.2, 56.1),
     (-5.1, 55.3), (-4.8, 54.65), (-3.1, 54.95), (-3.6, 54.52),
     (-3.3, 54.1), (-3.05, 53.8), (-3.1, 53.55),
     (-2.9, 53.35), (-4.5, 53.4), (-4.75, 52.8), (-4.1, 52.55),
     (-4.25, 52.0), (-5.3, 51.9), (-5.05, 51.6), (-4.25, 51.55),
     (-3.1, 51.4), (-2.65, 51.6), (-3.0, 51.2), (-4.25, 51.18),
     (-4.6, 50.75), (-5.1, 50.55)),
    ((-5.1, 48.45), (-4.75, 48.7), (-3.5, 48.85), (-2.7, 48.65),
     (-1.95, 48.55), (-1.85, 49.7), (-1.25, 49.7), (-1.0, 49.4),
     (0.15, 49.35), (0.7, 49.87), (1.5, 50.1), (1.6, 50.85),
     (1.85, 50.96), (2.4, 51.05), (3.4, 51.4), (6, 53), (8, 46), (-5, 46)),
)
CITIES = (
    ("London", -0.12, 51.51, 12500), ("Slough", -0.59, 51.51, 2800),
    ("Watford", -0.4, 51.66, 3000), ("Luton", -0.42, 51.88, 3500),
    ("Harlow", 0.1, 51.77, 2800), ("Chelmsford", 0.47, 51.74, 3200),
    ("Cambridge", 0.12, 52.2, 3800), ("Southend", 0.71, 51.54, 3500),
    ("Maidstone", 0.52, 51.27, 2800), ("Canterbury", 1.08, 51.28, 2300),
    ("Dover", 1.31, 51.13, 1800), ("Calais", 1.85, 50.95, 3000),
    ("Amiens", 2.3, 49.89, 4000), ("Paris", 2.35, 48.86, 14000),
)
ROADS = (
    ("M25", ((-0.55, 51.43), (-0.57, 51.58), (-0.4, 51.72), (-0.05, 51.72),
             (0.2, 51.66), (0.28, 51.47), (0.18, 51.28), (-0.2, 51.26),
             (-0.49, 51.32), (-0.55, 51.43))),
    ("M11", ((0.04, 51.59), (0.12, 51.77), (0.19, 51.87), (0.15, 52.08), (0.09, 52.23))),
    ("M1", ((-0.23, 51.58), (-0.4, 51.73), (-0.45, 51.89), (-0.7, 52.05), (-1.1, 52.3))),
    ("M4", ((-0.23, 51.49), (-0.46, 51.5), (-0.65, 51.5), (-0.98, 51.45), (-1.8, 51.55))),
    ("M20", ((0.2, 51.4), (0.51, 51.28), (0.88, 51.15), (1.18, 51.09), (1.31, 51.13))),
    ("M2", ((0.25, 51.39), (0.59, 51.36), (0.88, 51.3), (1.15, 51.28))),
    ("A12", ((0.0, 51.58), (0.29, 51.63), (0.47, 51.74), (0.9, 51.9), (1.16, 52.06))),
    ("A1", ((-0.12, 51.55), (-0.22, 51.77), (-0.2, 52.02), (-0.25, 52.3))),
    ("A16", ((1.85, 50.95), (1.61, 50.72), (1.68, 50.28), (1.83, 50.1), (2.3, 49.89))),
    ("A1 France", ((2.93, 50.5), (2.85, 50.0), (2.72, 49.6), (2.6, 49.2), (2.5, 49.03), (2.35, 48.86))),
)
HILLS = (
    (-0.75, 51.73, 260, 14000, 6500),  # Chilterns
    (0.15, 51.27, 240, 16000, 4500),   # North Downs
    (-0.25, 50.9, 270, 21000, 5000),   # South Downs
    (-4.08, 53.07, 1085, 12000, 10000), # Eryri / Snowdonia
    (-3.95, 50.58, 620, 15000, 13000),  # Dartmoor
    (-3.21, 54.45, 978, 14000, 14000),  # Lake District
)


def geographic(longitude, latitude):
    return (math.radians(longitude) * 6371000 * math.cos(math.radians(50)),
            math.radians(latitude - 50) * 6371000)


LAND = tuple(tuple(geographic(*p) for p in coast) for coast in COASTS)
LAND_SURFACES = [([(x, y, -0.1) for x, y in coast], "#82936e") for coast in LAND]
CITY_POSITIONS = [(geographic(lon, lat), radius) for _, lon, lat, radius in CITIES]


def in_city(x, y):
    return any(((x - cx) / radius) ** 2 + ((y - cy) / (radius * 0.65)) ** 2 < 1
               for (cx, cy), radius in CITY_POSITIONS)


def is_land(x, y):
    for coast in LAND:
        inside = False
        for (ax, ay), (bx, by) in zip(coast[-1:] + coast[:-1], coast):
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                inside = not inside
        if inside:
            return True
    return False


def regional_scenery():
    ground, roads = [], []
    solids = []
    for name, route in ROADS:
        points = [geographic(*p) for p in route]
        motorway = name.startswith("M") or name in ("A16", "A1 France")
        roads.extend(ribbon(points, 32 if motorway else 14, "#666b69"))
        if motorway:
            roads.extend(ribbon(points, 3, "#b0b295"))
    for city, lon, lat, radius in CITIES:
        x, y = geographic(lon, lat)
        for i in range(32):
            a, b = i * math.tau / 32, (i + 1) * math.tau / 32
            sector = [(x, y, 0.005), (x + radius * math.cos(a), y + radius * math.sin(a) * 0.65, 0.005),
                      (x + radius * math.cos(b), y + radius * math.sin(b) * 0.65, 0.005)]
            if all(is_land(px, py) and airport_clear(px, py) for px, py, _ in sector):
                ground.append((sector, "#92917f"))
        for i in range(-4, 5):
            offset = radius * i / 5
            extent = math.sqrt(radius * radius - offset * offset)
            for points in ([(x - extent, y + offset * 0.65), (x + extent, y + offset * 0.65)],
                           [(x + offset, y - extent * 0.65), (x + offset, y + extent * 0.65)]):
                if all(is_land(*p) and airport_clear(*p) for p in points):
                    ground.extend(ribbon(points, 12, "#777872"))
        count = 320 if city in ("London", "Paris") else 80
        for i in range(count):
            seed = cell_seed(i + 1, int(lon * 1000))
            angle = i * 2.399963
            distance = radius * math.sqrt((i + 0.5) / count)
            px, py = x + math.cos(angle) * distance, y + math.sin(angle) * distance * 0.65
            if not is_land(px, py) or not airport_clear(px, py):
                continue
            w, d = 100 + seed % 220, 80 + seed % 150
            height = 8 + seed % 20 + (55 if city in ("London", "Paris") and i < 10 else 0)
            block = [(px - 260, py - 220, 0.01), (px + 260, py - 220, 0.01),
                     (px + 260, py + 220, 0.01), (px - 260, py + 220, 0.01)]
            if all(is_land(a, b) and airport_clear(a, b) for a, b, _ in block):
                ground.append((block, ("#92917f", "#9d9685", "#888e7b")[i % 3]))
            ground.extend(ribbon([(px - w, py - d), (px + w, py - d)], 10, "#777872"))
            solids.extend(box(px, py, w, d, height))
            solids.append(([(px - w / 2, py - d / 2, height),
                            (px + w / 2, py - d / 2, height),
                            (px + w / 2, py + d / 2, height),
                            (px - w / 2, py + d / 2, height)], "#916d58"))
    for lon, lat, height, rx, ry in HILLS:
        x, y = geographic(lon, lat)
        for i in range(20):
            a, b = i * math.tau / 20, (i + 1) * math.tau / 20
            solids.append(([(x + rx * math.cos(a), y + ry * math.sin(a), 0),
                            (x + rx * math.cos(b), y + ry * math.sin(b), 0),
                            (x + rx * 0.12, y, height)],
                           ("#64794f", "#718159", "#7d8964", "#596e49")[i % 4]))
    return ground + roads, solids


def clip_polygon(points, distance):
    """Keep the positive half-space, including intersections at its boundary."""
    result = []
    for previous, current in zip(points[-1:] + points[:-1], points):
        a, b = distance(previous), distance(current)
        if (a >= 0) != (b >= 0):
            ratio = a / (a - b)
            result.append(tuple(x + ratio * (y - x) for x, y in zip(previous, current)))
        if b >= 0:
            result.append(current)
    return result


def cell_seed(x, y):
    return (x * 73856093 ^ y * 19349663) & 0x7fffffff


def box(x, y, width, depth, height, base=0):
    bottom = [(x - width / 2, y - depth / 2, base),
              (x + width / 2, y - depth / 2, base),
              (x + width / 2, y + depth / 2, base),
              (x - width / 2, y + depth / 2, base)]
    top = [(a, b, base + height) for a, b, _ in bottom]
    return [(top, "#b8c5c6")] + [
        ([bottom[i], bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]],
         ("#647b86", "#8ba1ac", "#536c78", "#95a7aa")[i]) for i in range(4)]


def ribbon(points, width, color):
    surfaces = []
    # Shared cross-sections keep river bends watertight.
    edges = []
    for i, (x, y) in enumerate(points):
        before, after = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        scale = width / (2 * math.hypot(dx, dy))
        edges.append(((x - dy * scale, y + dx * scale, 0.02),
                      (x + dy * scale, y - dx * scale, 0.02)))
    for a, b in zip(edges, edges[1:]):
        surfaces.append(([a[0], a[1], b[1], b[0]], color))
    return surfaces


def airport_clear(x, y):
    for airport in AIRPORTS:
        along, across = airport.runway_coordinates(x, y)
        if abs(along) < airport.runway_length / 2 + 450 and abs(across) < 1200:
            return False
    hx, hy = AIRPORTS[0].position
    for (ax, ay), (bx, by) in zip(THAMES, THAMES[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((x - hx - ax) * dx + (y - hy - ay) * dy) / (dx * dx + dy * dy)))
        if math.hypot(x - hx - ax - t * dx, y - hy - ay - t * dy) < 240:
            return False
    return True


def terrain(x, y):
    return _terrain(math.floor(x / 800), math.floor(y / 800))


@lru_cache(maxsize=4)
def _terrain(cx, cy):
    ground, solids = [], []
    for ix in range(cx - 10, cx + 11):
        for iy in range(cy - 10, cy + 11):
            seed = cell_seed(ix, iy)
            px, py = ix * 800, iy * 800
            if not all(is_land(a, b) for a, b in
                       ((px, py), (px + 800, py), (px + 800, py + 800), (px, py + 800))):
                continue
            ground.append(([(px, py, 0), (px + 800, py, 0),
                            (px + 800, py + 800, 0), (px, py + 800, 0)],
                           FIELD_COLORS[seed % len(FIELD_COLORS)]))
            ground.extend(ribbon([(px, py), (px + 800, py)], 5, "#4e6840"))
            ground.extend(ribbon([(px, py), (px, py + 800)], 5, "#4e6840"))
            if abs(ix - cx) > 4 or abs(iy - cy) > 4:
                continue
            for n in range(3):
                tx = px + 60 + (seed + n * 239) % 680
                ty = py + 60 + (seed // 97 + n * 317) % 680
                if not airport_clear(tx, ty) or in_city(tx, ty):
                    continue
                height = 12 + seed % 13
                solids.extend((points, "#71533b") for points, _ in
                              box(tx, ty, 2, 2, height * 0.55))
                corners = [(tx - 9, ty - 9, 5), (tx + 9, ty - 9, 5),
                           (tx + 9, ty + 9, 5), (tx - 9, ty + 9, 5)]
                for i in range(4):
                    solids.append(([corners[i], corners[(i + 1) % 4], (tx, ty, height)],
                                   ("#315d37", "#427344", "#285132", "#527b40")[i]))
    return ground, solids


def heathrow_scenery():
    hx, hy = AIRPORTS[0].position
    ground = ribbon([(hx + x, hy + y) for x, y in THAMES], 220, "#468b9e")
    solids = []
    for x, y, w, d in ((-1250, 650, 400, 180), (150, 500, 500, 150),
                        (1000, -650, 450, 180)):
        x, y = hx + x, hy + y
        ground.append(([(x - w, y - d * 2, 0.03), (x + w, y - d * 2, 0.03),
                        (x + w, y + d * 2, 0.03), (x - w, y + d * 2, 0.03)], "#89908a"))
        ground.extend(ribbon([(x, y), (x, hy)], 28, "#737b7c"))
        solids.extend(box(x, y, w, d, 24))
        for offset in (-0.35, 0, 0.35):
            solids.extend(box(x + w * offset, y - d * 0.7, 24, 160, 10))
    solids.extend(box(hx + 450, hy + 280, 18, 18, 65))
    solids.extend(box(hx + 450, hy + 280, 40, 35, 12, 65))
    # Approximate central London, about 25 km east of Heathrow.
    ex, ey = hx + 25400, hy + 2900
    for i in range(32):
        a, b = i * math.tau / 32, (i + 1) * math.tau / 32
        def ring(angle, radius):
            return (ex + radius * math.cos(angle) * 0.35,
                    ey + radius * math.cos(angle) * 0.94, 70 + radius * math.sin(angle))
        solids.append(([ring(a, 65), ring(b, 65), ring(b, 61), ring(a, 61)], "#e4e6df"))
        solids.extend(ribbon_3d((ex, ey, 70), ring(a, 62), 0.7, "#bfcdd0"))
        if i % 2 == 0:
            px, py, pz = ring(a, 65)
            solids.extend(box(px, py, 6, 8, 4, pz - 2))
    for dx in (-30, 30):
        solids.extend(ribbon_3d((ex + dx, ey - 15, 0), (ex, ey, 70), 3, "#e4e6df"))
    solids.extend(box(ex - 450, ey - 250, 140, 70, 25))
    solids.extend(box(ex - 440, ey - 250, 18, 18, 96))
    # Bridges make the river's scale easier to read from altitude.
    for x, y in ((23700, 500), (25500, 3100), (28500, 5800)):
        solids.extend(box(hx + x, hy + y, 350, 22, 10))
    return ground, solids


def ribbon_3d(a, b, width, color):
    return [([(a[0] - width, a[1], a[2]), (b[0] - width, b[1], b[2]),
              (b[0] + width, b[1], b[2]), (a[0] + width, a[1], a[2])], color)]
