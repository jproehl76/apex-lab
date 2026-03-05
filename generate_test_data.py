#!/usr/bin/env python3
"""
Synthetic RaceChrono Pro CSV v3 — BMW G80 M3 Competition xDrive
Road Atlanta · 6 laps · 26 channels · full hardware stack simulation

Hardware modeled:
  RaceBox Mini S       25 Hz  — lat, lon, speed, lat_g, long_g, alt, heading
  OBDLink MX+ CAN      25 Hz  — rpm, wheel speeds, throttle, brake, gear, steer, yaw, lat_accel_can
  OBDLink MX+ OBD2     ~2 Hz  — oil_temp, trans_temp, coolant, boost, iat, battery

Raw values stored in metric (hardware native).
Dashboard converts to Imperial at display time.
"""
import numpy as np
import csv
import sys

np.random.seed(2026)

NUM_LAPS    = 6
SAMPLE_RATE = 25
BASE_LAP    = 112.0
LAP_DELTAS  = [+4.2, +2.1, +1.3, 0.0, +0.8, +9.5]  # Lap 4 = best, Lap 6 = cool-down

START_LAT = 34.14743
START_LON = -83.81540

HEADERS = [
    "Timestamp (s)", "Lap #", "Latitude (deg)", "Longitude (deg)",
    "Speed (km/h)", "Altitude (m)", "Heading (deg)",
    "Lateral acceleration (G)", "Longitudinal acceleration (G)",
    "Engine RPM",
    "Wheel Speed FL (km/h)", "Wheel Speed FR (km/h)",
    "Wheel Speed RL (km/h)", "Wheel Speed RR (km/h)",
    "Throttle Position (%)", "Brake Pressure (bar)",
    "Gear Position", "Steering Angle (deg)",
    "Yaw Rate (deg/s)", "CAN Lateral Acceleration (G)",
    "Oil Temperature (°C)", "Transmission Temperature (°C)",
    "Coolant Temperature (°C)", "Boost Pressure (bar)",
    "Intake Air Temperature (°C)", "Battery Voltage (V)",
]
UNITS = [
    "s","","deg","deg","km/h","m","deg","G","G",
    "rpm","km/h","km/h","km/h","km/h","%","bar","","deg","deg/s","G",
    "°C","°C","°C","bar","°C","V",
]

# Road Atlanta corners (frac_start, frac_end, apex_kph, peak_lat_g, direction, entry_kph)
CORNERS = [
    (0.02, 0.10,  88, 0.95, +1, 225),  # T1    heavy stop onto infield
    (0.12, 0.17, 105, 0.75, -1, 160),  # T2    quick left
    (0.20, 0.26, 153, 0.70, +1, 195),  # T3    esses right
    (0.27, 0.33, 145, 0.72, -1, 185),  # T4    esses left
    (0.38, 0.46, 113, 0.85, +1, 210),  # T5    bridge braking zone
    (0.48, 0.54, 129, 0.80, +1, 175),  # T6    downhill right
    (0.56, 0.63, 161, 0.90, -1, 215),  # T7    Coca-Cola sweeper
    (0.66, 0.70, 185, 0.55, +1, 200),  # T8    flat kink
    (0.74, 0.81, 121, 0.88, +1, 200),  # T9    uphill right
    (0.83, 0.87, 153, 0.75, +1, 190),  # T10   carousel
    (0.88, 0.95,  72, 0.92, -1, 225),  # T10A  hairpin — biggest braking zone
    (0.96, 0.99, 169, 0.65, +1, 185),  # T12   onto pit straight
]

GPS_WP = [
    (0.00, 0.0000, 0.0000),(0.05, 0.0008, 0.0015),(0.10, 0.0021, 0.0028),
    (0.15, 0.0018, 0.0042),(0.22, 0.0025, 0.0055),(0.30, 0.0031, 0.0050),
    (0.38, 0.0038, 0.0040),(0.46, 0.0042, 0.0025),(0.54, 0.0038, 0.0010),
    (0.62, 0.0028,-0.0005),(0.70, 0.0015,-0.0018),(0.78, 0.0005,-0.0028),
    (0.85,-0.0008,-0.0022),(0.91,-0.0018,-0.0010),(0.96,-0.0012, 0.0005),
    (1.00, 0.0000, 0.0000),
]

def gps_at(frac):
    for i in range(len(GPS_WP) - 1):
        f0, la0, lo0 = GPS_WP[i]
        f1, la1, lo1 = GPS_WP[i + 1]
        if f0 <= frac <= f1:
            t = (frac - f0) / (f1 - f0) if f1 > f0 else 0
            lat = START_LAT + la0 + (la1 - la0) * t
            lon = START_LON + lo0 + (lo1 - lo0) * t
            hdg = (90 - np.degrees(np.arctan2(la1 - la0, lo1 - lo0))) % 360
            return lat, lon, hdg
    return START_LAT, START_LON, 0.0

def alt_at(f):
    return 274.0 + 20*np.sin(f*np.pi) + 15*np.sin(f*2*np.pi+1.2) + 10*np.cos(f*3*np.pi)

def get_corner(frac):
    for fs, fe, apex, plg, dr, entry in CORNERS:
        if fs <= frac <= fe:
            pf = (frac - fs) / (fe - fs)
            phase = 'brake' if pf < 0.25 else ('apex' if pf < 0.65 else 'exit')
            return (fs, fe, apex, plg, dr, entry), phase, pf
    return None, 'straight', 0.0

def speed_at(frac, delta):
    c, phase, pf = get_corner(frac)
    if c is None:
        return min(230.0, 145.0 + frac * 80 + delta * 0.5)
    fs, fe, apex, plg, dr, entry = c
    if phase == 'brake':  return entry - (entry - apex) * (pf / 0.25)
    elif phase == 'apex': return apex + delta * 0.3
    else:                 return apex + (entry * 0.8 - apex) * ((pf - 0.65) / 0.35)

def long_g_at(frac):
    c, phase, pf = get_corner(frac)
    if c is None: return 0.35
    fs, fe, apex, plg, dr, entry = c
    if phase == 'brake':   return -0.9 * np.sin((pf / 0.25) * np.pi)
    elif phase == 'apex':  return -0.12 if pf < 0.45 else 0.10
    else:                  return 0.40

def lat_g_at(frac):
    c, phase, pf = get_corner(frac)
    if c is None: return 0.0, 0.0
    fs, fe, apex, plg, dr, entry = c
    if phase == 'brake':   lg = dr * plg * 0.3 * (pf / 0.25)
    elif phase == 'apex':  lg = dr * plg * np.sin(((pf - 0.25) / 0.40) * np.pi)
    else:                  lg = dr * plg * (1 - (pf - 0.65) / 0.35) * 0.6
    return lg, lg * 52.0

def brake_at(frac):
    c, phase, pf = get_corner(frac)
    if c is None: return 0.0
    fs, fe, apex, plg, dr, entry = c
    if phase == 'brake':               return max(0.0, 45.0 * plg * np.sin((pf / 0.25) * np.pi))
    if phase == 'apex' and pf < 0.35: return max(0.0, 8.0 * (1 - (pf - 0.25) / 0.10))
    return 0.0

def thr_at(frac, brk):
    if brk > 5.0: return 0.0
    c, phase, pf = get_corner(frac)
    if c is None: return 92.0
    if phase == 'brake': return 0.0
    if phase == 'apex':
        af = (pf - 0.25) / 0.40
        return 2.0 if af < 0.4 else min(60.0, 60.0 * ((af - 0.4) / 0.6))
    return min(100.0, 60.0 + 40.0 * ((pf - 0.65) / 0.35))

def gear_at(spd):
    for thr, g in [(55,1),(90,2),(125,3),(155,4),(185,5),(215,6)]:
        if spd < thr: return g
    return 7

def rpm_at(spd, gear):
    ratios = {1:4.23, 2:2.53, 3:1.74, 4:1.31, 5:1.00, 6:0.82, 7:0.69}
    wps = (spd / 3.6) / (2 * np.pi * 0.331)
    return float(np.clip(wps * ratios.get(gear, 1.0) * 3.15 * 60, 900, 7500))


class Thermals:
    """
    G80 M3 engine and drivetrain thermal model.
    Channels build realistically over the full session.
    Session end targets at sustained track pace:
      Oil:     ~107C (224F)
      Trans:   ~76C  (169F)
      Coolant: ~94C  (201F)
      IAT:     ~42C  (108F)
    """
    def __init__(self):
        self.oil   = 82.0
        self.trans = 52.0
        self.cool  = 78.0
        self.iat   = 28.0

    def step(self, dt: float, thr_pct: float, spd_kph: float) -> None:
        load = thr_pct / 100.0
        af   = min(1.0, spd_kph / 180.0)

        oil_tgt   = 108.0 + load * 28.0
        trans_tgt =  90.0 + load * 20.0
        cool_tgt  =  93.0 + load *  9.0
        iat_tgt   =  38.0 + load * 14.0 + (self.oil - 90) * 0.15

        self.oil   += (oil_tgt   - self.oil)   * 0.003  * dt - af * 0.06 * dt
        self.trans += (trans_tgt - self.trans)  * 0.002  * dt - af * 0.05 * dt
        self.cool  += (cool_tgt  - self.cool)   * 0.006  * dt - af * 0.03 * dt
        self.iat   += (iat_tgt   - self.iat)    * 0.005  * dt - af * 0.04 * dt

        self.oil   = float(np.clip(self.oil,   82, 138))
        self.trans = float(np.clip(self.trans, 52, 115))
        self.cool  = float(np.clip(self.cool,  78, 108))
        self.iat   = float(np.clip(self.iat,   22,  62))

    def boost(self, thr_pct: float, rpm: float) -> float:
        if thr_pct < 15 or rpm < 2500:
            return max(0.0, float(np.random.normal(0, 0.01)))
        load = thr_pct / 100.0
        rpmf = min(1.0, (rpm - 2500) / 2500.0)
        return max(0.0, 1.35 * load * rpmf + float(np.random.normal(0, 0.02)))


def generate(output_path: str) -> None:
    rows = []
    elapsed = 0.0
    dt = 1.0 / SAMPLE_RATE
    lap_times = [BASE_LAP + d for d in LAP_DELTAS]
    thermals = Thermals()

    for lap_num, lap_time in enumerate(lap_times, 1):
        samples  = int(lap_time * SAMPLE_RATE)
        delta    = LAP_DELTAS[lap_num - 1]
        cnoise   = float(np.random.normal(0, 0.5))  # per-lap consistency variation

        for i in range(samples):
            frac = i / samples
            t    = elapsed + i * dt

            lat, lon, hdg = gps_at(frac)
            lat += float(np.random.normal(0, 0.000005))
            lon += float(np.random.normal(0, 0.000005))
            alt  = alt_at(frac) + float(np.random.normal(0, 0.2))

            spd   = max(40.0, speed_at(frac, delta) + float(np.random.normal(0, 1.5)))
            lg_r, steer_r = lat_g_at(frac)
            lg    = lg_r + float(np.random.normal(0, 0.018)) + cnoise * 0.01
            lng   = long_g_at(frac) + float(np.random.normal(0, 0.02))
            steer = steer_r + float(np.random.normal(0, 0.8))
            yaw   = lg * 22.0 + float(np.random.normal(0, 0.4))
            lat_can = lg + float(np.random.normal(0, 0.008))

            brk  = max(0.0, brake_at(frac) + float(np.random.normal(0, 0.4)))
            thr  = float(np.clip(thr_at(frac, brk) + np.random.normal(0, 1.2), 0, 100))
            gear = gear_at(spd)
            rpm  = float(np.clip(rpm_at(spd, gear) + np.random.normal(0, 45), 900, 7500))

            cd    = lg * 2.2  # xDrive lateral load transfer
            ws_fl = spd + cd       + float(np.random.normal(0, 0.2))
            ws_fr = spd - cd       + float(np.random.normal(0, 0.2))
            ws_rl = spd + cd * 0.7 + float(np.random.normal(0, 0.2))
            ws_rr = spd - cd * 0.7 + float(np.random.normal(0, 0.2))

            thermals.step(dt, thr, spd)
            boost = thermals.boost(thr, rpm)
            batt  = 13.82 + float(np.random.normal(0, 0.04))

            rows.append([
                f"{t:.3f}", lap_num,
                f"{lat:.7f}", f"{lon:.7f}",
                f"{spd:.2f}", f"{alt:.1f}", f"{hdg:.1f}",
                f"{lg:.4f}", f"{lng:.4f}",
                f"{rpm:.0f}",
                f"{ws_fl:.2f}", f"{ws_fr:.2f}", f"{ws_rl:.2f}", f"{ws_rr:.2f}",
                f"{thr:.2f}", f"{brk:.3f}",
                int(gear), f"{steer:.2f}",
                f"{yaw:.3f}", f"{lat_can:.4f}",
                f"{thermals.oil:.1f}", f"{thermals.trans:.1f}", f"{thermals.cool:.1f}",
                f"{boost:.3f}", f"{thermals.iat:.1f}", f"{batt:.2f}",
            ])

        elapsed += lap_time

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        f.write('"This file is created using RaceChrono v9.1 ( http://www.racechrono.com/ )."\n')
        f.write('"Session title","HPDE Session 1 \u2014 Road Atlanta"\n')
        f.write('"Session type","Lap timing"\n')
        f.write('"Track name","Road Atlanta"\n')
        f.write('"Driver name","Jonathan"\n')
        f.write('"Vehicle","2025 BMW G80 M3 Competition xDrive"\n')
        f.write('"Export scope","All laps"\n')
        f.write('"Created","2026-05-02 09:15:00"\n')
        f.write('"Note","Synthetic test data \u2014 G80 M3 full channel set"\n')
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(HEADERS)
        w.writerow(UNITS)
        for r in rows:
            w.writerow(r)

    c2f = lambda c: c * 9 / 5 + 32
    print(f"\u2713 Generated {len(rows):,} rows \u2192 {output_path}")
    print(f"  Track:     Road Atlanta (2.54 mi)")
    print(f"  Laps:      {NUM_LAPS}  |  Best: Lap {lap_times.index(min(lap_times))+1} @ {min(lap_times):.1f}s  |  Spread: {max(lap_times)-min(lap_times):.1f}s")
    print(f"  Lap times: {[f'{t:.1f}s' for t in lap_times]}")
    print(f"  Channels:  {len(HEADERS)}")
    print(f"  Duration:  {elapsed/60:.1f} min  |  Sample rate: {SAMPLE_RATE} Hz")
    print(f"  Thermals at session end:")
    print(f"    Oil:     {thermals.oil:.0f}\u00b0C  ({c2f(thermals.oil):.0f}\u00b0F)")
    print(f"    Trans:   {thermals.trans:.0f}\u00b0C  ({c2f(thermals.trans):.0f}\u00b0F)")
    print(f"    Coolant: {thermals.cool:.0f}\u00b0C  ({c2f(thermals.cool):.0f}\u00b0F)")
    print(f"    IAT:     {thermals.iat:.0f}\u00b0C  ({c2f(thermals.iat):.0f}\u00b0F)")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'test_session_road_atlanta.csv'
    generate(out)
