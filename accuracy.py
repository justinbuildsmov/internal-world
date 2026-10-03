#!/usr/bin/env python3
"""Score every finished 2° run against real elevation (NOAA ETOPO, sampled at
the exact same points — truth_2deg.csv from coastwatch ERDDAP etopo180).

Metrics are area-weighted by cos(latitude) so the stretched poles don't count
extra (same convention as the "blind Claudes" land/water eval):
  land/water  — % of the Earth where it got the sign right (land vs ocean)
  MAE         — mean absolute error in meters
  corr        — correlation with the true elevation (1.0 = perfect shape)
Also renders the real Earth with the same palette: results/truth_etopo_2.png
"""
import csv
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from elevation import ROOT, grid, load_grid, render_grid

lats, lons = grid(2)
truth = np.full((len(lats), len(lons)), np.nan)
li = {round(float(v), 3): i for i, v in enumerate(lats)}
lj = {round(float(v), 3): j for j, v in enumerate(lons)}
with open(ROOT / "truth_2deg.csv") as fh:
    rows = list(csv.reader(fh))[2:]
for la, lo, alt in rows:
    truth[li[round(float(la), 3)], lj[round(float(lo), 3)]] = float(alt)

render_grid(truth, ROOT / "results" / "truth_etopo_2.png")
w = np.cos(np.radians(lats))[:, None] * np.ones_like(truth)

print(f"{'model':28} {'done':>6} {'land/water':>11} {'MAE (m)':>9} {'corr':>6}")
results = []
for d in sorted((ROOT / "results").glob("*_2")):
    if not d.is_dir() or d.name.startswith("truth"):
        continue
    backend, model = d.name.split("_", 1)
    model = model.rsplit("_", 1)[0]
    _, _, z = load_grid(SimpleNamespace(backend=backend, model=model, step=2.0))
    ok = ~np.isnan(z)
    done = ok.mean()
    ww = w[ok]
    lw = np.average((z[ok] > 0) == (truth[ok] > 0), weights=ww)
    mae = np.average(np.abs(z[ok] - truth[ok]), weights=ww)
    corr = np.corrcoef(z[ok], truth[ok])[0, 1]
    results.append((lw, model, done, mae, corr))
for lw, model, done, mae, corr in sorted(results, reverse=True):
    print(f"{model:28} {done:6.0%} {lw:11.1%} {mae:9.0f} {corr:6.3f}")

# Biggest misses per model → notes/misses.md (invented mountains, lost islands, ...)
lines = ["# Biggest misses per model (vs NOAA ETOPO, 2° grid)\n"]
for d in sorted((ROOT / "results").glob("*_2")):
    if not d.is_dir():
        continue
    backend, model = d.name.split("_", 1)
    model = model.rsplit("_", 1)[0]
    _, _, z = load_grid(SimpleNamespace(backend=backend, model=model, step=2.0))
    err = np.where(np.isnan(z), 0, z - truth)
    lines.append(f"\n## {model}\n")
    for idx in np.argsort(-np.abs(err), axis=None)[:8]:
        i, j = np.unravel_index(idx, err.shape)
        lines.append(f"- ({lats[i]:+.0f}, {lons[j]:+.0f}): said {z[i, j]:,.0f} m, "
                     f"real {truth[i, j]:,.0f} m (off by {err[i, j]:+,.0f})")
(ROOT / "notes" / "misses.md").write_text("\n".join(lines) + "\n")
