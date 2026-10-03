"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Segmented control after 21st.dev's "Segmented Tabs" (micka_design): a spring
// thumb slides to the selected item and a softer highlight follows the cursor.
// Trimmed to plain buttons — no Base UI / tab panels needed here.

export type SegmentedItem = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  hint?: string; // small trailing text, e.g. "24%"
};

const spring = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const;

export function Segmented({ id, items, value, onChange, accent, className }: {
  id: string;                  // unique per control (scopes the shared layout animation)
  items: SegmentedItem[];
  value: string | null;
  onChange: (v: string) => void;
  accent?: string;             // tint for the selected thumb
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div
      role="radiogroup"
      onMouseLeave={() => setHover(null)}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full p-1",
        "bg-white/[.06] ring-1 ring-inset ring-white/[.08] backdrop-blur-xl",
        className,
      )}
    >
      {items.map((it) => {
        const selected = it.value === value;
        return (
          <button
            key={it.value}
            role="radio"
            aria-checked={selected}
            disabled={it.disabled}
            onMouseEnter={() => setHover(it.value)}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative h-8 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              "disabled:cursor-default disabled:opacity-30",
              selected ? "text-white font-medium" : "text-white/55 hover:text-white/85",
            )}
          >
            {hover === it.value && !selected && !it.disabled && (
              <motion.span layoutId={`${id}-hover`} transition={spring}
                className="absolute inset-0 rounded-full bg-white/[.06]" />
            )}
            {selected && (
              <motion.span layoutId={`${id}-thumb`} transition={spring}
                className="absolute inset-0 rounded-full shadow-[0_1px_2px_rgba(0,0,0,.4),inset_0_1px_0_rgba(255,255,255,.12)]"
                style={{ background: accent ? `color-mix(in oklab, ${accent} 30%, rgba(255,255,255,.08))` : "rgba(255,255,255,.14)" }} />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {it.label}
              {it.hint && <span className="text-[11px] tabular-nums text-white/40">{it.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
