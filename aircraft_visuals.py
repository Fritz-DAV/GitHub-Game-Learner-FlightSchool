"""Metre-scale low-poly aircraft meshes shared by the desktop views and tests."""

import math
from functools import lru_cache

from flight_model import AIRCRAFT


def tube(stations, x=0, z=0, flatten=1):
    rings = [[(x + radius * math.cos(i * math.tau / 12), along,
               z + radius * math.sin(i * math.tau / 12) * flatten)
              for i in range(12)] for along, radius in stations]
    return [([a[i], a[(i + 1) % 12], b[(i + 1) % 12], b[i]],
             ("#eef2f3" if i < 6 else "#a5b4bf"))
            for a, b in zip(rings, rings[1:]) for i in range(12)]


@lru_cache(maxsize=3)
def aircraft_hull(aircraft):
    cessna = aircraft == AIRCRAFT[0]
    boeing = aircraft == AIRCRAFT[1]
    length = 8.3 if cessna else 39.5 if boeing else 37.6
    radius = 0.6 if cessna else 1.88 if boeing else 1.98
    span = 5.5 if cessna else 17.9
    tail = -length * 0.48 + (0.5 if cessna else 1.3)
    color = "#c84538" if cessna else "#276397" if boeing else "#168e9b"
    surfaces = tube([(tail, 0.12), (-length * 0.26, radius * 0.8),
                     (length * 0.27, radius),
                     (length * 0.43, radius * (0.65 if cessna or boeing else 0.8)),
                     (length * 0.52, 0.06 if cessna or boeing else 0.22)])
    for side in (-1, 1):
        wing_z = 0.65 if cessna else -0.5
        tip_y = -0.3 if cessna else -6
        surfaces.append(([(side * radius * 0.6, 1.2 if cessna else 3.5, wing_z),
                          (side * span, tip_y, wing_z + 0.3),
                          (side * span, tip_y - (1.2 if cessna else 1.8), wing_z + 0.3),
                          (side * radius, -1.3 if cessna else -4, wing_z)], "#cbd8e1"))
        surfaces.append(([(side * 0.2, tail + 1.5, 0.25),
                          (side * (2 if cessna else 6.2), tail + (0.2 if cessna else -0.7), 0.5),
                          (side * (2 if cessna else 6.2), tail - (0.5 if cessna else 1.3), 0.5),
                          (side * 0.2, tail - 0.5, 0.25)], "#cbd8e1"))
        if cessna:
            surfaces.append(([(side * 0.5, 0, -0.3), (side * 4, -0.4, 0.65),
                              (side * 4, -0.5, 0.65), (side * 0.5, -0.1, -0.3)], "#687c88"))
        else:
            surfaces.append(([(side * span, tip_y, wing_z + 0.3),
                              (side * (span + 0.35), tip_y - 0.5, 2 if boeing else 1.7),
                              (side * (span + 0.35), tip_y - 1.2, 1.8),
                              (side * span, tip_y - 1.8, wing_z + 0.3)], color))
            surfaces.extend(tube([(-2.9, 0.6), (-2.4, 1), (0.8, 1), (1, 0.91)],
                                 side * 5.4, -1.65, 0.8 if boeing else 1))
            surfaces.append(([(side * 5.4 + 0.82 * math.cos(i * math.tau / 12), 1.02,
                               -1.65 + 0.75 * math.sin(i * math.tau / 12))
                              for i in range(12)], "#24333c"))
        for i in range(3 if cessna else 28):
            along = (0.9 - i * 0.6) if cessna else (length * 0.29 - i * 0.8)
            x = side * radius * 0.94
            surfaces.append(([(x, along, 0.2), (x, along + 0.3, 0.2),
                              (x, along + 0.3, 0.55), (x, along, 0.55)], "#284e64"))
        surfaces.append(([(side * radius * 0.85, length * 0.32, radius * 0.48),
                          (side * radius * 0.4, length * 0.4, radius * 0.52),
                          (side * radius * 0.35, length * 0.34, radius * 0.86),
                          (side * radius * 0.75, length * 0.28, radius * 0.8)], "#25485c"))
    fin = [(tail - 0.4, 0), (tail - 0.1, 2 if cessna else 6.5),
           (tail + (1 if cessna else 2), 2 if cessna else 6),
           (tail + (2 if cessna else 5), 0)]
    thickness = 0.04 if cessna else 0.12
    for side in (-1, 1):
        surfaces.append(([(side * thickness, y, z) for y, z in fin], color))
    for (ay, az), (by, bz) in zip(fin, fin[1:]):
        surfaces.append(([(-thickness, ay, az), (thickness, ay, az),
                          (thickness, by, bz), (-thickness, by, bz)], color))
    return tuple(surfaces)


def aircraft_surfaces(aircraft, gear, time=0, engine_power=0):
    surfaces = list(aircraft_hull(aircraft))
    cessna = aircraft == AIRCRAFT[0]
    datum = 1.5 if cessna else 3.3
    if cessna:
        angle = time * (8 + engine_power * 90)
        dx, dz = 1.05 * math.cos(angle), 1.05 * math.sin(angle)
        surfaces.append(([(-dx, 4.35, -dz), (dx, 4.35, dz),
                          (dx + 0.06, 4.35, dz + 0.06), (-dx + 0.06, 4.35, -dz + 0.06)],
                         "#34434c"))
        gear = 1
    if gear <= 0.01:
        return surfaces
    wheel_radius = 0.28 if cessna else 0.55
    for x, y in ((-1.2 if cessna else -2.7, -1.1 if cessna else -2.5),
                 (1.2 if cessna else 2.7, -1.1 if cessna else -2.5),
                 (0, 2.5 if cessna else 12)):
        wheel_z = -0.65 + (-datum + wheel_radius + 0.65) * gear
        wheel_x = x * gear
        surfaces.append(([(wheel_x - 0.06, y, -0.5), (wheel_x + 0.06, y, -0.5),
                          (wheel_x + 0.06, y, wheel_z), (wheel_x - 0.06, y, wheel_z)], "#bbc5ca"))
        for offset in ((0,) if cessna else (-0.28, 0.28)):
            rings = [[(wheel_x + offset + side * wheel_radius * 0.35,
                       y + wheel_radius * math.cos(i * math.tau / 10),
                       wheel_z + wheel_radius * math.sin(i * math.tau / 10))
                      for i in range(10)] for side in (-1, 1)]
            surfaces.extend((ring, "#20272c") for ring in rings)
            surfaces.extend(([rings[0][i], rings[0][(i + 1) % 10],
                              rings[1][(i + 1) % 10], rings[1][i]], "#30373b")
                            for i in range(10))
    return surfaces
