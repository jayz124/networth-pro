/**
 * Shared chart theme configuration for Recharts.
 *
 * Provides consistent tooltip styling, color palette, axis defaults,
 * and CartesianGrid props across all chart components.
 */

import type { CSSProperties } from "react"

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/** Standard tooltip contentStyle used across all charts. */
export const tooltipContentStyle: CSSProperties = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    padding: "8px 12px",
    fontSize: "13px",
}

/** Cursor style for line/area chart tooltips. */
export const tooltipCursor = {
    stroke: "hsl(var(--muted-foreground))",
    strokeWidth: 1,
    strokeDasharray: "4 4",
}

// ---------------------------------------------------------------------------
// Color palette — semantic chart colors
// ---------------------------------------------------------------------------

export const chartColors = {
    // Income / positive / gain
    gain: "#10b981",
    // Expenses / negative / loss
    loss: "#ef4444",
    // Primary accent (blue)
    primary: "#3b82f6",
    // Secondary accent (purple)
    secondary: "#8b5cf6",
    // Tertiary accents
    cyan: "#06b6d4",
    amber: "#f59e0b",
    orange: "#f97316",
    slate: "#94a3b8",
    // Net worth (gold)
    netWorth: "hsl(38, 92%, 50%)",
    // Extended purple shades
    purpleLight: "#a855f7",
    purpleLighter: "#c084fc",
    // Extended blue shades
    blueLight: "#0ea5e9",
    // Shortfall
    shortfall: "#dc2626",
} as const

/** Default allocation pie chart colors (used when data has no inherent color). */
export const allocationColors = [
    chartColors.primary,
    chartColors.gain,
    chartColors.amber,
    chartColors.orange,
    chartColors.secondary,
    chartColors.cyan,
]

// ---------------------------------------------------------------------------
// Axis defaults
// ---------------------------------------------------------------------------

export const axisTickStyle = {
    className: "fill-muted-foreground text-[11px]",
}

export const defaultAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: axisTickStyle,
}

export const xAxisDefaults = {
    ...defaultAxisProps,
    dy: 8,
}

export const yAxisDefaults = {
    ...defaultAxisProps,
    width: 70,
    dx: -5,
}

// ---------------------------------------------------------------------------
// CartesianGrid
// ---------------------------------------------------------------------------

export const gridProps = {
    strokeDasharray: "3 3",
    vertical: false,
    className: "stroke-border/50",
}
