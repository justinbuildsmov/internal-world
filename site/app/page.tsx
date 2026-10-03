"use client";

import { useEffect, useMemo, useState } from "react";
import VoxelWorld, { type Hover } from "@/components/voxel-world";
import PixelMap from "@/components/pixel-map";
import { Segmented } from "@/components/ui/segmented";
import { FileText } from "lucide-react";
import { fmt, pct, type Mode, type Model, type Results } from "@/lib/world";

// Paper = the write-up below the map. TODO: GitHub link once the repo is public.
const LINKS = { paper: "#paper", github: "#" };

const FAMILY = { claude: "Claude", gpt: "GPT" } as const;
const FAMILY_NAME = { claude: "Claude", gpt: "ChatGPT" } as const;
const FAMILY_COLOR = { claude: "#e08a5f", gpt: "#6fb6a5" } as const;

export default function Home() {
  const [data, setData] = useState<Results | null>(null);
  const [truth, setTruth] = useState<number[] | null>(null);
  const [elevs, setElevs] = useState<Record<string, (number | null)[]>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("model");
  const [hover, setHover] = useState<Hover>(null);

  useEffect(() => {
    Promise.all([fetch("data/results.json").then((r) => r.json()), fetch("data/truth.json").then((r) => r.json())])
      .then(([d, t]: [Results, number[]]) => {
        const done = d.models.filter((m) => m.done >= 1)
          .sort((a, b) => b.landwater! - a.landwater! || a.mae! - b.mae!);
        done.forEach((m, i) => (m.rank = i + 1));
        setData(d);
        setTruth(t);
        setSel(done[0].id);
        // Thumbnails need every model; they're ~100 KB each.
        d.models.filter((m) => m.done > 0).forEach((m) =>
          fetch(m.elev).then((r) => r.json()).then((e) => setElevs((p) => ({ ...p, [m.id]: e }))));
      });
  }, []);

  const model = data?.models.find((m) => m.id === sel) ?? null;
  const ranked = useMemo(() => (data?.models ?? []).filter((m) => m.done >= 1).sort((a, b) => a.rank! - b.rank!), [data]);

  if (!data || !model) return <div className="h-screen grid place-items-center font-mono text-sm text-white/40">loading world…</div>;
  const g = data.grid;
  const elev = elevs[model.id] ?? null;

  const pick = (id: string, scroll = false) => {
    setSel(id);
    if (mode === "real") setMode("model");
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="font-[family-name:var(--font-geist-sans)]">
      {/* ── the world ─────────────────────────────────── */}
      <section className="relative h-[100svh] min-h-[560px] overflow-hidden select-none">
        <VoxelWorld rows={g.rows} cols={g.cols} elev={elev} truth={truth} mode={mode} stops={data.stops} onHover={setHover} />

        <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-8 bg-gradient-to-b from-[#05070c] via-[#05070c]/70 to-transparent pb-16">
          <h1 className="-ml-[0.055em] font-semibold tracking-[-0.045em] leading-[.9] text-[clamp(40px,7.5vw,104px)] whitespace-nowrap">
            Internal <span className="text-[#f2c46d]">World</span>
          </h1>
          <div className="text-sm text-white/45 mt-3">an experiment by @justinbuilds.mov</div>
        </div>

        <nav className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10 flex gap-2">
          <a href={LINKS.paper} className="flex h-9 items-center gap-2 rounded-full bg-white/[.06] ring-1 ring-inset ring-white/[.1] backdrop-blur-xl px-4 text-[13px] text-white/80 hover:text-white hover:bg-white/[.1] transition">
            <FileText className="size-3.5" /> Paper
          </a>
          <a href={LINKS.github} className="flex h-9 items-center gap-2 rounded-full bg-white/[.06] ring-1 ring-inset ring-white/[.1] backdrop-blur-xl px-4 text-[13px] text-white/80 hover:text-white hover:bg-white/[.1] transition">
            <GitHubMark /> GitHub
          </a>
        </nav>

        {hover && truth && (
          <Tooltip hover={hover} label={mode === "real" ? "Real Earth" : chipName(model)}
            said={mode === "real" ? null : elev?.[hover.i * g.cols + hover.j] ?? null}
            real={truth[hover.i * g.cols + hover.j]} lat={g.lat0 - hover.i * g.step} lon={g.lon0 + hover.j * g.step} />
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6 bg-gradient-to-t from-[#05070c] via-[#05070c]/85 to-transparent pt-20">
          <div className="mx-auto max-w-5xl flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Stats model={model} total={ranked.length} mode={mode} />
              <Segmented id="mode" value={mode} onChange={(v) => setMode(v as Mode)}
                items={[{ value: "model", label: "Model's Earth" }, { value: "real", label: "Real Earth" }, { value: "error", label: "Difference" }]} />
            </div>
            <div className="flex flex-col gap-2">
              {(Object.keys(FAMILY) as (keyof typeof FAMILY)[]).map((f) => (
                <div key={f} className="flex items-center gap-3 min-w-0">
                  <span className="w-16 shrink-0 text-[13px] font-medium" style={{ color: FAMILY_COLOR[f] }}>{FAMILY_NAME[f]}</span>
                  <Segmented id={`fam-${f}`} accent={FAMILY_COLOR[f]} className="max-w-full overflow-x-auto"
                    value={mode !== "real" ? sel : null} onChange={(v) => pick(v)}
                    items={data.models.filter((m) => m.family === f).map((m) => ({
                      value: m.id,
                      label: chipName(m),
                      disabled: m.done <= 0,
                      hint: m.done > 0 && m.done < 1 ? `${Math.round(m.done * 100)}%` : undefined,
                    }))} />
                </div>
              ))}
            </div>
            <div className="text-xs text-white/30 hidden sm:block">Drag to orbit, scroll to zoom, hover to inspect.</div>
          </div>
        </div>
      </section>

      {/* ── accuracy ─────────────────────────────────── */}
      <Section id="paper" title="The accuracy of each model"
        sub="Each model's answer at every coordinate was compared with NOAA's elevation data. Points near the poles sit closer together than points at the equator, so each one is weighted by how much of the Earth it actually covers.">
        <div className="flex flex-col">
          <div className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[48px_200px_1fr_110px_90px] gap-3 sm:gap-5 pb-3 border-b border-white/10 text-[13px] text-white/40">
            <span /><span>Model</span><span className="hidden sm:block" /><span className="text-right">% Accuracy</span><span className="text-right hidden sm:block">Avg. Error</span>
          </div>
          {ranked.map((m) => (
            <button key={m.id} onClick={() => pick(m.id, true)}
              className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[48px_200px_1fr_110px_90px] items-center gap-3 sm:gap-5 py-3.5 border-b border-white/[.06] text-left hover:bg-white/[.03] transition">
              <span className="font-mono text-sm text-white/35 pl-1">{m.rank}</span>
              <span className="font-medium flex items-center gap-2.5">
                <i className="size-2 rounded-full" style={{ background: FAMILY_COLOR[m.family] }} />{m.label}
              </span>
              <span className="hidden sm:flex items-center">
                <span className="h-1.5 flex-1 rounded-full bg-white/[.06] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${((m.landwater! - 0.75) / 0.25) * 100}%`, background: FAMILY_COLOR[m.family] }} /></span>
              </span>
              <span className="font-mono text-sm text-right tabular-nums">{pct(m.landwater!)}</span>
              <span className="font-mono text-sm text-white/50 text-right tabular-nums hidden sm:block">{fmt(m.mae!)} m</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── evolution ────────────────────────────────── */}
      <Section title="Model improvement" sub="As we can see, as generations of models increased, their spatial reasoning of the world got better and better.">
        <div className="flex flex-col gap-8">
          {(Object.keys(FAMILY) as (keyof typeof FAMILY)[]).map((f) => (
            <div key={f}>
              <div className="text-sm font-medium mb-3" style={{ color: FAMILY_COLOR[f] }}>{FAMILY[f]}</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {data.models.filter((m) => m.family === f).map((m) => (
                  <button key={m.id} disabled={m.done <= 0} onClick={() => pick(m.id, true)} className="text-left group disabled:opacity-40">
                    <PixelMap elev={elevs[m.id] ?? null} rows={g.rows} cols={g.cols} stops={data.stops}
                      className="w-full aspect-[2/1] bg-white/[.03] border border-white/10 group-hover:border-white/40 transition" />
                    <div className="flex justify-between mt-1.5 font-mono text-xs text-white/60">
                      <b className="text-white font-medium">{m.short}</b>
                      <span>{m.done >= 1 ? pct(m.landwater!) : m.done > 0 ? `running ${Math.round(m.done * 100)}%` : "soon"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-3 text-[#f2c46d]">NOAA Data</div>
              <PixelMap elev={truth} rows={g.rows} cols={g.cols} stops={data.stops} className="w-full aspect-[2/1] border border-white/10" />
            </div>
            {ranked[0] && (
              <button onClick={() => pick(ranked[0].id, true)} className="text-left group">
                <div className="text-sm font-medium mb-3 flex justify-between">
                  <span style={{ color: FAMILY_COLOR[ranked[0].family] }}>Most accurate · {ranked[0].label}</span>
                  <span className="text-white/50 tabular-nums">{pct(ranked[0].landwater!)}</span>
                </div>
                <PixelMap elev={elevs[ranked[0].id] ?? null} rows={g.rows} cols={g.cols} stops={data.stops}
                  className="w-full aspect-[2/1] bg-white/[.03] border border-white/10 group-hover:border-white/40 transition" />
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* ── findings ─────────────────────────────────── */}
      <Section title="Things we didn't expect">
        <div className="grid sm:grid-cols-2 gap-4">
          {data.findings.map((f, i) => (
            <div key={i} className="border border-white/10 bg-white/[.02] p-6">
              <div className="font-mono text-[11px] text-[#f2c46d]">0{i + 1}</div>
              <h3 className="font-semibold tracking-[-0.01em] text-xl leading-snug mt-3 mb-2">{f.title}</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">{f.body}</p>
              {f.quote && <blockquote className="mt-4 pl-3 border-l-2 border-white/15 font-mono text-[13px] text-white/55">“{f.quote}”</blockquote>}
            </div>
          ))}
        </div>
      </Section>

      {/* ── method ───────────────────────────────────── */}
      <Section title="How it works">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10">
          <pre className="border border-white/10 bg-white/[.02] p-5 font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {data.prompt.split("{points}")[0].replace("{n}", "60")}
            <span className="text-white/35">{"1. 89.0, -179.0\n2. 89.0, -177.0\n…\n60. 89.0, -61.0"}</span>
          </pre>
          <ul className="flex flex-col gap-3.5 text-white/60 text-[15px]">
            <li><b className="text-white font-medium">16,200 points</b>, every 2° of latitude and longitude, asked 60 at a time.</li>
            <li><b className="text-white font-medium">No tools.</b> Web search, code and files were switched off. Answers come from what the model memorized.</li>
            <li><b className="text-white font-medium">Claude</b> models ran through Claude Code, <b className="text-white font-medium">GPT</b> models through Codex, both headless with tools disabled.</li>
            <li><b className="text-white font-medium">Ground truth</b> is NOAA ETOPO, sampled at the exact same coordinates.</li>
          </ul>
        </div>
      </Section>

      <footer className="mx-auto max-w-5xl px-4 sm:px-6 pt-28 pb-12 text-sm text-white/40">
        Made by <a className="text-white/70 hover:text-white" href="https://instagram.com/justinbuilds.mov">@justinbuilds.mov</a>
      </footer>
    </main>
  );
}

function Section({ id, title, sub, children }: { id?: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-4 sm:px-6 pt-24 scroll-mt-4">
      <h2 className="font-semibold tracking-[-0.03em] text-[clamp(28px,4vw,44px)] leading-tight">{title}</h2>
      {sub && <p className="mt-3 mb-8 max-w-2xl text-white/55">{sub}</p>}
      {!sub && <div className="mb-8" />}
      {children}
    </section>
  );
}

const chipName = (m: Model) => (m.family === "gpt" ? `GPT-${m.short}` : m.short);

function Stats({ model, total, mode }: { model: Model; total: number; mode: Mode }) {
  if (mode === "real") return (
    <div className="text-2xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#f2c46d] leading-none">Real Earth</div>
  );
  if (model.done < 1) return (
    <div>
      <div className="text-2xl sm:text-4xl font-semibold tracking-[-0.03em] leading-none">{model.label}</div>
      <div className="text-sm text-white/45 mt-2">Still mapping, {Math.round(model.done * 100)}% done</div>
    </div>
  );
  return (
    <div className="flex items-end gap-6 sm:gap-10">
      <div>
        <div className="text-2xl sm:text-4xl font-semibold tracking-[-0.03em] leading-none">{model.label}</div>
        <div className="text-sm text-white/45 mt-2">Ranked {model.rank} of {total}</div>
      </div>
      <Stat v={pct(model.landwater!)} k="Accuracy" />
      <Stat v={`${fmt(model.mae!)} m`} k="Avg. Error" />
    </div>
  );
}

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="hidden sm:block">
      <div className="text-2xl font-medium tabular-nums leading-none tracking-[-0.02em]">{v}</div>
      <div className="text-sm text-white/45 mt-2">{k}</div>
    </div>
  );
}

// Map hover card, after 21st.dev's Hover Card (halaska-studio): frosted panel,
// soft shadow, label/value rows.
function Tooltip({ hover, label, said, real, lat, lon }: {
  hover: NonNullable<Hover>; label: string; said: number | null; real: number; lat: number; lon: number;
}) {
  const flip = typeof window !== "undefined" && hover.x > window.innerWidth - 260;
  const off = said == null ? null : said - real;
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-6"><span className="text-white/50">{k}</span><span className="tabular-nums text-white">{v}</span></div>
  );
  return (
    <div className="pointer-events-none absolute z-20 w-[220px] rounded-xl bg-[rgba(20,22,28,.92)] backdrop-blur-xl ring-1 ring-white/10 shadow-[0_12px_32px_rgba(0,0,0,.5)] p-3.5 text-[13px] leading-6"
      style={{ left: hover.x, top: hover.y, transform: flip ? "translate(calc(-100% - 16px), 16px)" : "translate(16px, 16px)" }}>
      <div className="text-xs text-white/45 mb-1.5 tabular-nums">
        {Math.abs(lat)}° {lat >= 0 ? "N" : "S"}, {Math.abs(lon)}° {lon >= 0 ? "E" : "W"}
      </div>
      {said != null && <Row k={label} v={`${fmt(said)} m`} />}
      <Row k="Real" v={`${fmt(real)} m`} />
      {off != null && (
        <div className="mt-2 pt-2 border-t border-white/[.08] flex justify-between">
          <span className="text-white/50">Difference</span>
          <span className="tabular-nums" style={{ color: Math.abs(off) < 300 ? "#7fd1a3" : off > 0 ? "#f0893a" : "#5b9cf0" }}>
            {off > 0 ? "+" : off < 0 ? "−" : ""}{fmt(Math.abs(off))} m
          </span>
        </div>
      )}
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
