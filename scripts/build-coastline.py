#!/usr/bin/env python3
"""
Bygger data/coast.json – kustlinjen runt Karlskrona projicerad till SMHI-
radarbildens pixelkoordinater (471x887, UTM33N/GRS80), så den ligger pixelrätt
under nederbörden i appen.

Kräver Natural Earth land-data i /tmp/land.geojson (ne_10m_land.geojson).
Kör: python3 scripts/build-coastline.py
"""
import json, math

# --- UTM33N (GRS80) forward: lat/lon -> projected (E,N) ---
a = 6378137.0; f = 1/298.257222101; e2 = f*(2-f)
k0 = 0.9996; FE = 500000.0; lon0 = math.radians(15.0)
def tm(lat, lon):
    lat = math.radians(lat); lon = math.radians(lon)
    N = a/math.sqrt(1-e2*math.sin(lat)**2)
    T = math.tan(lat)**2; C = e2/(1-e2)*math.cos(lat)**2; A = (lon-lon0)*math.cos(lat)
    ep2 = e2/(1-e2)
    M = a*((1-e2/4-3*e2**2/64-5*e2**3/256)*lat
        -(3*e2/8+3*e2**2/32+45*e2**3/1024)*math.sin(2*lat)
        +(15*e2**2/256+45*e2**3/1024)*math.sin(4*lat)
        -(35*e2**3/3072)*math.sin(6*lat))
    E = FE+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T**2+72*C-58*ep2)*A**5/120)
    Nn = k0*(M+N*math.tan(lat)*(A**2/2+(5-T+9*C+4*C**2)*A**4/24
        +(61-58*T+T**2+600*C-330*ep2)*A**6/720))
    return E, Nn

# Radarbildens georef (från GeoTIFF)
X0, Y0, PX = 126648.404, 7771252.876, 2014.9581656050955
W, H = 471, 887
def pix(lat, lon):
    E, Nn = tm(lat, lon)
    return ((E-X0)/PX, (Y0-Nn)/PX)

# Behåll bara kust nära Karlskrona-fönstret (px-bbox med marginal)
KX, KY, HALF = 203.4, 767.8, 72
XMIN, XMAX = KX-HALF-30, KX+HALF+30
YMIN, YMAX = KY-HALF-30, KY+HALF+30
# Grovt lat/lon-filter först (snabbar upp)
LAT0, LAT1, LON0, LON1 = 53.0, 58.5, 11.0, 20.0

def simplify(pts, tol=0.6):
    out = [pts[0]]
    for p in pts[1:]:
        if abs(p[0]-out[-1][0]) >= tol or abs(p[1]-out[-1][1]) >= tol:
            out.append(p)
    return out

def inside(p):
    return XMIN <= p[0] <= XMAX and YMIN <= p[1] <= YMAX

def clip(px):
    """Klipp en ring till fönstret → lista av öppna delkurvor (med en punkt
    utanför i varje ände så linjen når kanten)."""
    segs = []; cur = []
    for i, p in enumerate(px):
        if inside(p):
            if not cur and i > 0: cur.append(px[i-1])  # ta med föregående (utanför)
            cur.append(p)
        else:
            if cur:
                cur.append(p)  # nå ut till kanten
                segs.append(cur); cur = []
    if cur: segs.append(cur)
    return segs

d = json.load(open('/tmp/land.geojson'))
rings_out = []
for feat in d['features']:
    g = feat['geometry']; polys = g['coordinates']
    if g['type'] == 'Polygon': polys = [polys]
    for poly in polys:
        for ring in poly:
            if not any(LON0 <= x <= LON1 and LAT0 <= y <= LAT1 for x, y in ring):
                continue
            px = [pix(lat, lon) for lon, lat in ring]
            if not any(inside(p) for p in px):
                continue
            for seg in clip(px):
                seg = simplify([[round(x, 1), round(y, 1)] for x, y in seg])
                if len(seg) >= 2:
                    rings_out.append(seg)

out = {'frame': [W, H], 'karlskrona': [KX, KY], 'rings': rings_out}
json.dump(out, open('data/coast.json', 'w'), separators=(',', ':'))
npts = sum(len(r) for r in rings_out)
print(f'Skrev data/coast.json: {len(rings_out)} ringar, {npts} punkter, '
      f'{len(json.dumps(out))//1024} KB')
