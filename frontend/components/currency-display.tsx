"use client"

import { useSettings } from "@/lib/settings-context"

interface CurrencyDisplayProps {
    value: number
    compact?: boolean
    showSign?: boolean
    className?: string
}

export function CurrencyDisplay({ value, compact = false, showSign = false, className }: CurrencyDisplayProps) {
    const { formatCurrency, formatCompactCurrency } = useSettings()

    const formatted = compact ? formatCompactCurrency(value) : formatCurrency(value)
    const displayValue = showSign && value > 0 ? `+${formatted}` : formatted

    return <span className={className}>{displayValue}</span>
}

// For use in places where we just need the symbol
export function CurrencySymbol({ className }: { className?: string }) {
    const { settings } = useSettings()
    return <span className={className}>{settings.currency.symbol}</span>
}
