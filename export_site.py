#!/usr/bin/env python3
"""Export every 2° run + NOAA truth as JSON for the landing page.

writes site/public/data/
  results.json   per-model scores + metadata (small; loads first)
  truth.json     16,200 real elevations, row-major north→south, west→east
  <id>.json      16,200 elevations for one model (null where missing)
Scores match accuracy.py: cos(latitude) area weighting.
"""
import csv
import json
from types import SimpleNamespace

import numpy as np

from elevation import PROMPT, ROOT, STOPS, grid, load_grid

OUT = ROOT / "site" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# Display order within each family: oldest → newest.
MODELS = [
    ("claude", "claude-haiku-4-5", "Claude Haiku 4.5", "Haiku 4.5"),
    ("claude", "claude-sonnet-4-5", "Claude Sonnet 4.5", "Sonnet 4.5"),
    ("claude", "claude-opus-4-5", "Claude Opus 4.5", "Opus 4.5"),
    ("claude", "claude-opus-5-5", "Claude Opus 5.5", "Opus 5.5"),
    ("claude", "claude-fable-5-1", "Claude Fable 5.1", "Fable 5.1"),
    ("codex", "gpt-5.5", "GPT-5.5", "5.5"),
    ("codex", "gpt-5.6-sol", "GPT-5.6 Sol", "5.6 Sol"),
    ("codex", "gpt-6-luna", "GPT-6 Luna", "6 Luna"),
    ("codex", "gpt-6-astra", "GPT-6 Astra", "6 Astra"),
    ("codex", "gpt-6.1-sol", "GPT-6.1 Sol", "6.1 Sol"),
]

FINDINGS = [
    {"title": "Tibet comes out white, and that's correct",
     "body": "Every strong model draws the Tibetan Plateau as a solid block above 4,500 m. "
             "The real plateau averages 4,500 to 5,000 m. They know it from text alone."},
    {"title": "The older model thinks 8× longer and does worse",
     "body": "Same 60 points, one call each: Opus 5.5 answered in 18 seconds with about 1,800 "
             "thinking tokens. Opus 4.5 took 3 minutes and about 14,000, and scored lower."},
    {"title": "Haiku first refused",
     "body": "Asked to answer from memory, the smallest model declined. Told to give its best "
             "guess, it drew a recognizable planet.",
     "quote": "I don't have detailed elevation and bathymetry data memorized for specific "
              "coordinates."},
    {"title": "Haiku can't count to 60",
     "body": "It returned 59, 61, 62 or 63 numbers instead of 60 on 8 of 270 batches. "
             "The elevations were fine; it just loses its place in the list."},
]

lats, lons = grid(2)
truth = np.full((len(lats), len(lons)), np.nan)
li = {round(float(v), 3): i for i, v in enumerate(lats)}
lj = {round(float(v), 3): j for j, v in enumerate(lons)}
with open(ROOT / "truth_2deg.csv") as fh:
    for la, lo, alt in list(csv.reader(fh))[2:]:
        truth[li[round(float(la), 3)], lj[round(float(lo), 3)]] = float(alt)
w = np.cos(np.radians(lats))[:, None] * np.ones_like(truth)

(OUT / "truth.json").write_text(json.dumps([int(v) for v in truth.ravel()]))

models = []
for backend, mid, label, short in MODELS:
    entry = {"id": mid, "label": label, "short": short,
             "family": "claude" if backend == "claude" else "gpt",
             "done": 0.0, "elev": f"data/{mid}.json"}
    d = ROOT / "results" / f"{backend}_{mid}_2"
    if d.is_dir():
        _, _, z = load_grid(SimpleNamespace(backend=backend, model=mid, step=2.0))
        ok = ~np.isnan(z)
        entry["done"] = round(float(ok.mean()), 4)
        if ok.any():
            ww = w[ok]
            entry["landwater"] = round(float(np.average((z[ok] > 0) == (truth[ok] > 0), weights=ww)), 4)
            entry["mae"] = round(float(np.average(np.abs(z[ok] - truth[ok]), weights=ww)), 1)
            entry["corr"] = round(float(np.corrcoef(z[ok], truth[ok])[0, 1]), 4)
            (OUT / f"{mid}.json").write_text(json.dumps(
                [None if np.isnan(v) else int(v) for v in z.ravel()]))
    models.append(entry)

results = {
    "grid": {"step": 2, "rows": len(lats), "cols": len(lons),
             "lat0": float(lats[0]), "lon0": float(lons[0])},
    "prompt": PROMPT,
    "stops": [[z, list(c)] for z, c in STOPS],
    "models": models,
    "findings": FINDINGS,
}
(OUT / "results.json").write_text(json.dumps(results, indent=1))
for m in models:
    print(f"{m['id']:20} {m['done']:6.0%}  {m.get('landwater', 0):.1%}")
