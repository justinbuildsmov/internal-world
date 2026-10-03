#!/usr/bin/env python3
"""Ask a model "how high above sea level is (lat, lon)?" over a global grid,
from memory only (no tools, no web), and paint the answers as a relief map.

Runs through the CLIs on this Mac instead of API keys:
  claude  — Claude Code headless (`claude -p --tools "" --strict-mcp-config`)
  codex   — Codex CLI (`codex exec`, read-only sandbox, web search off)

Points are sent ~60 per call (200 made models miscount the array) (one integer each, JSON array back) — 16,200
single calls through a CLI would take hours and burn plan limits.

usage:
  elevation.py run    --backend claude --model opus --step 10
  elevation.py render --backend claude --model opus --step 10
  elevation.py run    --backend codex  --model gpt-6-astra --step 2 --workers 4
"""
import argparse
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
CLAUDE = Path.home() / ".local/bin/claude"
CODEX = Path.home() / ".local/bin/codex"

# Kept deliberately short and identical for every model and backend (Justin:
# "very important we keep the prompt simple and consistent"). "Best guess even
# if unsure" stops models from refusing for lack of a database.
PROMPT = """Elevation in meters above sea level at each (latitude, longitude)? Negative for ocean depth. Give your best guess for every point, even if unsure. Reply with only a JSON array of {n} integers.

{points}"""


def grid(step):
    lats = np.arange(90 - step / 2, -90, -step)       # north → south (image rows)
    lons = np.arange(-180 + step / 2, 180, step)      # west → east (image cols)
    return lats, lons


def run_dir(a):
    return ROOT / "results" / f"{a.backend}_{a.model}_{a.step:g}"


# Codex will happily web-search or curl an elevation API unless every tool
# surface is switched off (found 2026-10-03: GPT runs had 40%+ exact NOAA hits).
CODEX_NO_TOOLS = [
    "-c", 'web_search="disabled"',
    *[a for f in ("shell_tool", "unified_exec", "apps", "plugins", "browser_use",
                  "browser_use_external", "computer_use", "in_app_browser",
                  "skill_search", "tool_suggest") for a in ("--disable", f)],
]


def ask(backend, model, prompt):
    """One call, tools off. Raises if the transcript shows any tool use."""
    with tempfile.TemporaryDirectory() as cwd:        # empty dir: nothing to read
        if backend == "claude":
            out = subprocess.run(
                [str(CLAUDE), "-p", prompt, "--model", model, "--tools", "",
                 "--system-prompt", "Answer from memory. No tools.",
                 "--strict-mcp-config", "--no-session-persistence",
                 "--output-format", "json"],
                cwd=cwd, capture_output=True, text=True, timeout=900)
            res = json.loads(out.stdout)
            stu = res.get("usage", {}).get("server_tool_use", {})
            if any(stu.values()) or res.get("num_turns", 1) > 1:
                raise RuntimeError(f"tool use detected: {stu} turns={res.get('num_turns')}")
            return res["result"]
        out = subprocess.run(
            [str(CODEX), "exec", "-m", model, "-s", "read-only", "--skip-git-repo-check",
             "--ephemeral", "-C", cwd, "--json", *CODEX_NO_TOOLS, prompt],
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=900)
        text = None
        for line in out.stdout.splitlines():
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            item = ev.get("item") or {}
            kind = item.get("type")
            if kind == "error":   # API-side failure (e.g. rate limit), not tool use
                raise RuntimeError(f"codex error: {item.get('message', '')[:200]}")
            if kind and kind not in ("agent_message", "reasoning"):
                raise RuntimeError(f"tool use detected: {kind}")
            if kind == "agent_message" and ev.get("type") == "item.completed":
                text = item.get("text", "")
        if text is None:
            raise RuntimeError("no answer: " + out.stderr[-300:])
        return text


def parse(text, n):
    m = re.search(r"\[[\s\S]*\]", text)
    vals = json.loads(m.group(0)) if m else []
    if len(vals) != n:
        raise ValueError(f"expected {n} values, got {len(vals)}")
    return [int(round(float(v))) for v in vals]


def cmd_run(a):
    lats, lons = grid(a.step)
    pts = [(float(la), float(lo)) for la in lats for lo in lons]
    chunks = [pts[i:i + a.chunk] for i in range(0, len(pts), a.chunk)]
    d = run_dir(a)
    d.mkdir(parents=True, exist_ok=True)
    todo = [i for i in range(len(chunks)) if not (d / f"chunk_{i:04d}.json").exists()]
    if a.reverse:   # a second process on the same run works from the far end
        todo.reverse()
    if a.shuffle:   # a third one samples the middle, rarely colliding with either end
        import random
        random.shuffle(todo)
    print(f"{len(pts)} points, {len(chunks)} calls, {len(todo)} to go → {d}")

    def work(i):
        if (d / f"chunk_{i:04d}.json").exists():   # the other end got here first
            return i
        c = chunks[i]
        body = "\n".join(f"{k + 1}. {la:.1f}, {lo:.1f}" for k, (la, lo) in enumerate(c))
        for attempt in range(2):
            text = ""
            try:
                text = ask(a.backend, a.model, PROMPT.format(n=len(c), points=body))
                vals = parse(text, len(c))
                break
            except Exception as e:
                if attempt:
                    (d / f"chunk_{i:04d}.raw.txt").write_text(f"{e}\n\n{text}")
                    raise
        (d / f"chunk_{i:04d}.json").write_text(json.dumps({"points": c, "elev": vals}))
        return i

    with ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(work, i): i for i in todo}
        for f in as_completed(futs):
            i = futs[f]
            try:
                f.result()
                print(f"  chunk {i} ok")
            except Exception as e:
                print(f"  chunk {i} FAILED: {e}")


# depth/elevation → color stops (m): deep ocean, shelf, coast, lowland, hills, mountains, snow
STOPS = [(-8000, (8, 20, 60)), (-3000, (20, 60, 130)), (-200, (60, 120, 190)),
         (0, (150, 200, 230)), (1, (70, 130, 70)), (500, (150, 160, 90)),
         (1500, (140, 100, 60)), (3000, (110, 85, 70)), (5000, (240, 240, 240))]


def colorize(z):
    xs = np.array([s[0] for s in STOPS], float)
    rgb = np.stack([np.interp(z, xs, [s[1][c] for s in STOPS]) for c in range(3)], -1)
    return rgb


def load_grid(a):
    """(lats, lons, z) for a finished run; NaN where a chunk is missing."""
    lats, lons = grid(a.step)
    z = np.full((len(lats), len(lons)), np.nan)
    li = {round(float(v), 3): i for i, v in enumerate(lats)}
    lj = {round(float(v), 3): j for j, v in enumerate(lons)}
    for f in sorted(run_dir(a).glob("chunk_*.json")):
        c = json.loads(f.read_text())
        for (la, lo), e in zip(c["points"], c["elev"]):
            z[li[round(la, 3)], lj[round(lo, 3)]] = e
    return lats, lons, z


def render_grid(z, out):
    """Relief PNG: upsample smoothly, hillshade from the northwest so it reads 3D."""
    z = np.nan_to_num(z, nan=-4000)
    rows, cols = z.shape
    scale = max(1, int(round(1440 / cols)))
    big = np.asarray(Image.fromarray(z.astype(np.float32)).resize(
        (cols * scale, rows * scale), Image.BICUBIC))
    gy, gx = np.gradient(big)
    shade = np.clip(0.75 + (-gx + gy) * (0.6 / max(scale, 1)) / 150, 0.35, 1.25)
    land = big > 0
    rgb = colorize(big)
    rgb[land] *= shade[land, None]
    img = Image.fromarray(rgb.clip(0, 255).astype(np.uint8))
    with_legend(img).save(out)


def with_legend(img):
    """Append a labeled color bar under the map: ocean depth → sea level → peaks."""
    w, h = img.size
    band = 90
    canvas = Image.new("RGB", (w, h + band), (14, 16, 22))
    canvas.paste(img, (0, 0))
    lo, hi = STOPS[0][0], STOPS[-1][0]
    x0, x1, y0, y1 = int(w * 0.08), int(w * 0.92), h + 18, h + 42
    zs = lo + (hi - lo) * (np.arange(x1 - x0) / (x1 - x0 - 1))
    bar = colorize(zs)[None, :, :].repeat(y1 - y0, 0)
    canvas.paste(Image.fromarray(bar.astype(np.uint8)), (x0, y0))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 18)
    for z, label in [(-8000, "-8,000 m"), (-4000, "-4,000"), (0, "sea level"),
                     (2000, "2,000"), (5000, "5,000+ m")]:
        x = x0 + (z - lo) / (hi - lo) * (x1 - x0)
        d.line([(x, y1), (x, y1 + 6)], fill=(200, 200, 200), width=2)
        d.text((x, y1 + 9), label, font=font, fill=(220, 220, 220), anchor="ma")
    return canvas


def cmd_render(a):
    _, _, z = load_grid(a)
    out = run_dir(a).parent / (run_dir(a).name + ".png")  # not with_suffix: "gpt-5.5_2" has a dot
    render_grid(z, out)
    print(f"wrote {out}  ({int(np.isnan(z).sum())} missing points)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["run", "render"])
    ap.add_argument("--backend", choices=["claude", "codex"], required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--step", type=float, default=10)
    ap.add_argument("--chunk", type=int, default=60)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--reverse", action="store_true")
    ap.add_argument("--shuffle", action="store_true")
    a = ap.parse_args()
    cmd_run(a) if a.cmd == "run" else cmd_render(a)


if __name__ == "__main__":
    main()
