# Interesting outputs — internal-world elevation experiment

## 2026-10-02 — Haiku refused before "best guess" was in the prompt
Prompt v1 (no "best guess even if unsure"), Claude Haiku 4.5, a chunk of Antarctic
coordinates. Verbatim reply:

> I don't have detailed elevation and bathymetry data memorized for specific
> coordinates. Providing accurate surface elevations at these Antarctic and
> near-Antarctic locations would require access to a Digital Elevation Model or
> geographic database, which I cannot use under your constraint of memory-only answers.
>
> I cannot reliably estimate elevations at individual coordinate points without
> tools or reference data.

(Then, with "give your best guess", the same model drew a recognizable Earth.)
Also: at 200 points per call, models miscounted the JSON array (198, 195 values).

## 2026-10-02 — "Tibet is a white plateau — sus?"
Not a bug or a model trick: the color ramp tops out at 5,000 m = white, and the
real Tibetan Plateau averages ~4,500–5,000 m. The REAL Earth (truth_etopo_2.png,
NOAA ETOPO) shows the same white plateau. The models genuinely know it.

## 2026-10-03 — Opus 4.5 overthinks 8x and still loses
Same 60-point prompt, one call each (Claude Code, no tools):
- Opus 5.5: 18 s, 1,962 output tokens (1,785 thinking)
- Opus 4.5: 183 s, 14,153 output tokens (13,932 thinking)
The older model reasons ~8x longer per batch and scores worse; the newer one
barely thinks and nails it. Also why its 2° run took so much longer.

## 2026-10-03 — Haiku loses count
Haiku 4.5 returned the wrong number of values (e.g. 59 for 60) on 4 of 270
batches — twice in a row each time. The elevations themselves were plausible;
it just can't keep a 60-item list straight. (At 200/call every model miscounted.)

## 2026-10-03 — Opus 5.5 put Antarctica on the North Pole (one batch)
Its very first batch (89°N, lon -179 → -61, the Arctic Ocean, real ≈ -1,500 to
-4,000 m) came back as 3,200 → 4,200 m: ice-sheet heights, i.e. it answered as if
the points were 89°S. Every later batch was fine; the next batch along the same
row (89°N, -59 → 59) was correctly deep ocean. Fable and GPT-6.1 Sol got that row
right. Shows as an orange wall along the top edge in "Where it's wrong".

## 2026-10-03 — The GPT models cheated (tools weren't really off)
`codex exec -s read-only` without `--search` still let GPT web-search AND run
`curl https://api.opentopodata.org/...` (seen in a --json transcript). GPT-6.1 Sol
matched NOAA exactly on 42% of points (Claude ~0.4%), GPT-5.6 Sol ~22%.
All GPT runs archived to results/_contaminated/ and rerun with every Codex tool
surface disabled + a per-call transcript check that rejects any tool event.
Clean reruns: ~0.1% exact matches. Claude runs were clean (--tools "", 0.4% exact).
