// Shared data types + color math for the voxel world and the pixel thumbnails.

export type Stop = [number, [number, number, number]];

export type Model = {
  id: string;
  label: string;
  short: string;
  family: "claude" | "gpt";
  done: number;
  elev: string;
  landwater?: number;
  mae?: number;
  corr?: number;
  rank?: number;
};

export type Results = {
  grid: { step: number; rows: number; cols: number; lat0: number; lon0: number };
  prompt: string;
  stops: Stop[];
  models: Model[];
  findings: { title: string; body: string; quote?: string }[];
};

export type Mode = "model" | "real" | "error";

/** Elevation (m) → RGB 0..255, piecewise-linear over the shared palette. */
export function elevColor(z: number, stops: Stop[]): [number, number, number] {
  if (z <= stops[0][0]) return stops[0][1];
  for (let s = 1; s < stops.length; s++) {
    const [z1, c1] = stops[s];
    if (z <= z1) {
      const [z0, c0] = stops[s - 1];
      const t = (z - z0) / (z1 - z0);
      return [0, 1, 2].map((c) => c0[c] + (c1[c] - c0[c]) * t) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/** Model minus truth (m) → blue (too low) … neutral … orange (too high). */
export function errorColor(d: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, d / 2500));
  const mid: [number, number, number] = [36, 40, 48];
  const hi: [number, number, number] = [240, 104, 58];
  const lo: [number, number, number] = [52, 120, 230];
  const end = t > 0 ? hi : lo;
  const a = Math.pow(Math.abs(t), 0.7);
  return [0, 1, 2].map((c) => mid[c] + (end[c] - mid[c]) * a) as [number, number, number];
}

/** Elevation (m) → voxel height in grid-cell units. Land is exaggerated so relief reads. */
export function voxelHeight(z: number | null): number {
  if (z == null) return 0.15;
  if (z <= 0) return Math.max(0.12, 0.6 + z / 16000);
  return 0.6 + z / 650;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (n: number) => (n * 100).toFixed(1) + "%";
