"use client";

import { useEffect, useRef } from "react";
import { elevColor, type Stop } from "@/lib/world";

/** One pixel per 2° cell, scaled up crisp — the flat "pixel world" view of a model. */
export default function PixelMap({ elev, rows, cols, stops, className }: {
  elev: (number | null)[] | null; rows: number; cols: number; stops: Stop[]; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !elev) return;
    const img = ctx.createImageData(cols, rows);
    for (let k = 0; k < rows * cols; k++) {
      const z = elev[k];
      const [r, g, b] = z == null ? [24, 27, 34] : elevColor(z, stops);
      img.data.set([r, g, b, 255], k * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [elev, rows, cols, stops]);
  return <canvas ref={ref} width={cols} height={rows} className={className} style={{ imageRendering: "pixelated" }} />;
}
