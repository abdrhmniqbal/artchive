"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChartFrame, type ChartFrameProps } from "@/components/ui/chart.tsx";
import { useChoreography } from "@/lib/cojeev-motion/choreography.ts";
import { arcPath, chartColor, clamp, finiteValue, pieAngles, type ChartColor, type ChartSlice } from "@/lib/cojeev/chart-geometry.ts";

export type CircularChartProps = Omit<ChartFrameProps, "children" | "legendMode" | "interaction" | "data" | "series"> & { data: ChartSlice[] };
export function CircularChart({ kind, variant, max = 100, data, ...props }: CircularChartProps & { kind: "pie" | "radial"; variant: string; max?: number }) {
  const { quiet, transition } = useChoreography();
  return <ChartFrame {...props} data={data.map(item => ({ ...item }))} series={[{ key: "value", label: kind === "radial" ? "Progress" : "Amount" }]} legendMode="points" interaction="shape">{plot => {
    const slices: ChartSlice[] = plot.data.map(point => ({ label: point.label, value: finiteValue(point.value), color: point.color as ChartColor }));
    const cx = plot.width / 2, cy = variant === "semicircle" ? plot.height * .7 : plot.height / 2;
    const outer = Math.max(1, Math.min(plot.width / 2 - 16, variant === "semicircle" ? 150 : 124));
    const total = slices.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0);
    const angles = pieAngles(slices);
    const ceiling = Number.isFinite(max) && max > 0 ? max : 100;
    const band = Math.min(18, outer / Math.max(2, slices.length + 1) * .72), gap = band * .35;
    return <>
      {kind === "pie" ? <>
        <circle cx={cx} cy={cy} r={outer} fill="var(--v-beige)" />
        <AnimatePresence initial={!quiet}>
          {angles.map((arc, index) => {
            if (!arc.value) return null;
            const selected = plot.active === index;
            const path = arcPath(cx, cy, outer - (selected ? 0 : 3), variant === "donut" ? outer * .64 : 0, arc.start, Math.max(arc.start, arc.end - (slices.length > 1 ? .022 : 0)));
            return <motion.path key={`${slices[index].label}-${index}`} data-slot="chart-mark" d={path} fill={chartColor(slices[index].color, index)} stroke="var(--card)" strokeWidth="2"
              initial={quiet ? false : { d: path, opacity: 0, scale: .94 }} animate={{ d: path, opacity: plot.active === null || selected ? 1 : .5, scale: 1 }} exit={{ opacity: 0, scale: .94 }} transition={transition}
              style={{ transformOrigin: `${cx}px ${cy}px` }} onPointerEnter={() => plot.inspect(index)} />;
          })}
        </AnimatePresence>
        {variant === "donut" && <circle cx={cx} cy={cy} r={outer * .62} fill="var(--card)" />}
        {(variant === "donut" || total <= 0) && <g className="v-chart-center" aria-hidden="true"><text x={cx} y={cy + 2} textAnchor="middle">{total > 0 ? (props.valueFormatter?.(total) ?? total.toLocaleString()) : "—"}</text><text className="v-chart-center__label" x={cx} y={cy + 24} textAnchor="middle">{total > 0 ? "Total" : "No positive values"}</text></g>}
      </> : <>
        <AnimatePresence initial={!quiet}>
          {slices.map((slice, index) => {
            const radius = Math.max(band, outer - index * (band + gap)), inner = Math.max(0, radius - band);
            const start = variant === "semicircle" ? -Math.PI : -Math.PI / 2;
            const sweep = variant === "semicircle" ? Math.PI : Math.PI * 2;
            const progress = clamp((slice.value ?? 0) / ceiling, 0, 1);
            const track = arcPath(cx, cy, radius, inner, start, start + sweep);
            const fill = arcPath(cx, cy, radius, inner, start, start + sweep * progress);
            return <motion.g key={`${slice.label}-${index}`} initial={quiet ? false : { opacity: 0 }} animate={{ opacity: plot.active === null || plot.active === index ? 1 : .45 }} exit={{ opacity: 0 }} transition={transition} onPointerEnter={() => plot.inspect(index)}>
              <path d={track} fill="var(--v-beige)" />
              <AnimatePresence initial={!quiet}>{fill && <motion.path key="value" data-slot="chart-mark" d={fill} fill={chartColor(slice.color, index)} initial={quiet ? false : { d: fill, opacity: 0 }} animate={{ d: fill, opacity: 1 }} exit={{ opacity: 0 }} transition={transition} />}</AnimatePresence>
            </motion.g>;
          })}
        </AnimatePresence>
        <g className="v-chart-center" aria-hidden="true"><text x={cx} y={cy + (variant === "semicircle" ? -6 : 2)} textAnchor="middle">{plot.active === null ? slices.length : `${Math.round(clamp((slices[plot.active]?.value ?? 0) / ceiling, 0, 1) * 100)}%`}</text><text className="v-chart-center__label" x={cx} y={cy + (variant === "semicircle" ? 17 : 24)} textAnchor="middle">{plot.active === null ? "Measures" : "of target"}</text></g>
      </>}
    </>;
  }}</ChartFrame>;
}
