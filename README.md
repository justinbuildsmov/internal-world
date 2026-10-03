# Internal World

What does the Earth look like inside an AI?

We asked 10 language models for the elevation of 16,200 points on Earth (every 2° of latitude and longitude), from memory, with every tool switched off, and compared the answers with NOAA's real elevation data.

**Explore it:** [internal-world.justinbuilds.mov](https://internal-world.justinbuilds.mov)

## The prompt

Identical for every model, 60 coordinates per call:

```
Elevation in meters above sea level at each (latitude, longitude)? Negative for ocean depth. Give your best guess for every point, even if unsure. Reply with only a JSON array of 60 integers.

1. 89.0, -179.0
2. 89.0, -177.0
…
```

## Results

| # | Model | % Accuracy | Avg. Error |
|---|---|---|---|
| 1 | GPT-6.1 Sol | 98.8% | 456 m |
| 2 | GPT-6 Astra | 98.7% | 437 m |
| 3 | Claude Opus 5.5 | 98.6% | 418 m |
| 4 | Claude Fable 5.1 | 98.1% | 356 m |
| 5 | GPT-5.6 Sol | 97.0% | 609 m |
| 6 | Claude Opus 4.5 | 95.9% | 653 m |
| 7 | GPT-5.5 | 94.5% | 764 m |
| 8 | Claude Sonnet 4.5 | 90.9% | 905 m |
| 9 | Claude Haiku 4.5 | 79.9% | 1,583 m |
| 10 | GPT-6 Luna | 78.3% | 1,966 m |

**% Accuracy** is the share of the Earth's surface where the model got land vs. ocean right. **Avg. Error** is the mean absolute elevation error. Both are weighted by cos(latitude), because 2° grid points near the poles cover less ground than points at the equator.

## How it was run

- **Claude** through Claude Code headless: `claude -p --tools "" --strict-mcp-config`, with a system prompt of "Answer from memory. No tools."
- **GPT** through Codex: `codex exec --json` with web search, shell, browser, computer use and plugins all disabled.
- Every call's transcript is checked, and an answer is rejected if any tool was used (`elevation.py`).
- Ground truth: [NOAA ETOPO](https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.html), sampled at the same coordinates (`truth_2deg.csv`).

### The first GPT runs looked things up

Our first GPT runs used `codex exec -s read-only` without `--search`, which we assumed meant no tools. It didn't: the transcripts show the models running web searches and calling a public elevation API with `curl`. GPT-6.1 Sol matched NOAA to the exact meter on 42% of points, compared with about 0.4% for Claude. Those runs are kept in `results/_contaminated/` for reference. Every GPT model was rerun with all tools disabled and per-call transcript checks, and the clean reruns match exactly on about 0.1% of points.

More odd behavior is collected in [`notes/interesting.md`](notes/interesting.md).

## Reproduce

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./batch.sh claude claude-opus-5-5          # or: ./batch.sh codex gpt-6-astra
.venv/bin/python accuracy.py                # score every finished run
.venv/bin/python export_site.py             # data for the site
cd site && npm install && npm run dev
```

Each run writes resumable `results/<backend>_<model>_2/chunk_####.json` files, so an interrupted run picks up where it stopped. `--workers` sets the number of parallel calls. Each one is a separate CLI process of about 200 to 270 MB, so keep the total within your RAM.

## Layout

```
elevation.py      ask models + render maps
accuracy.py       score runs against NOAA
export_site.py    JSON for the site
og_image.py       link-preview image
batch.sh          run + render one or more models
results/          raw answers per model (and _contaminated/)
site/             Next.js + three.js voxel globe
```

Made by [@justinbuilds.mov](https://instagram.com/justinbuilds.mov).
