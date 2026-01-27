"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Bitcoin, Building, Coins, LineChart, Wallet, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoldingActions } from "@/components/portfolio/holding-actions"
import { CurrencyDisplay } from "@/components/currency-display"

export type Holding = {
    id: number
    portfolio_id: number
    portfolio_name?: string
    ticker: string
    asset_type: string
    quantity: number
    currency: string
    purchase_price?: number
    purchase_date?: string
    current_price?: number
    current_value?: number
    cost_basis?: number
    unrealized_gain?: number
    gain_percent?: number
    name?: string
}

const getAssetIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'crypto':
            return <Bitcoin className="h-4 w-4 text-amber-500" />
        case 'stock':
            return <LineChart className="h-4 w-4 text-blue-500" />
        case 'etf':
            return <Coins className="h-4 w-4 text-violet-500" />
        case 'real estate':
        case 'reit':
            return <Building className="h-4 w-4 text-success" />
        default:
            return <Wallet className="h-4 w-4 text-muted-foreground" />
    }
}

export const createColumns = (onUpdate: () => void): ColumnDef<Holding>[] => [
    {
        accessorKey: "ticker",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent hover:text-foreground -ml-4"
                >
                    Asset
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const icon = getAssetIcon(row.getValue("asset_type"))
            return (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                        {icon}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold">{row.getValue("ticker")}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {row.original.name || row.original.asset_type}
                        </span>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "asset_type",
        header: "Type",
        cell: ({ row }) => (
            <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-1 text-xs font-medium capitalize">
                {row.getValue("asset_type")}
            </span>
        )
    },
    {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => {
            const qty = parseFloat(row.getValue("quantity"))
            return (
                <div className="font-mono text-sm tabular-nums">
                    {qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
            )
        },
    },
    {
        accessorKey: "purchase_price",
        header: "Avg Price",
        cell: ({ row }) => {
            const price = row.original.purchase_price
            if (!price) return <span className="text-muted-foreground">-</span>
            return (
                <div className="font-mono text-sm tabular-nums">
                    <CurrencyDisplay value={price} />
                </div>
            )
        },
    },
    {
        accessorKey: "cost_basis",
        header: "Cost Basis",
        cell: ({ row }) => {
            const cost = row.original.cost_basis
            if (!cost) return <span className="text-muted-foreground">-</span>
            return (
                <div className="font-mono text-sm tabular-nums">
                    <CurrencyDisplay value={cost} />
                </div>
            )
        },
    },
    {
        accessorKey: "current_value",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent hover:text-foreground -ml-4"
                >
                    Value
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const val = row.original.current_value || 0
            return (
                <div className="font-mono font-semibold tabular-nums">
                    <CurrencyDisplay value={val} />
                </div>
            )
        },
    },
    {
        accessorKey: "unrealized_gain",
        header: "Unrealized P&L",
        cell: ({ row }) => {
            const gain = row.original.unrealized_gain
            if (gain === undefined || gain === null) return <span className="text-muted-foreground">-</span>
            const isPositive = gain >= 0
            return (
                <div className={`flex items-center gap-1.5 font-mono font-medium tabular-nums ${isPositive ? "text-gain" : "text-loss"}`}>
                    {isPositive ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <CurrencyDisplay value={Math.abs(gain)} showSign={isPositive} />
                </div>
            )
        }
    },
    {
        accessorKey: "gain_percent",
        header: "P&L %",
        cell: ({ row }) => {
            const percent = row.original.gain_percent
            if (percent === undefined || percent === null) return <span className="text-muted-foreground">-</span>
            const isPositive = percent >= 0
            return (
                <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${isPositive
                        ? "bg-success/10 text-gain"
                        : "bg-destructive/10 text-loss"
                    }`}>
                    {isPositive ? "+" : ""}{percent.toFixed(2)}%
                </div>
            )
        }
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            return <HoldingActions holding={row.original} onUpdate={onUpdate} />
        },
    },
]

// Default columns for backward compatibility (without actions)
export const columns: ColumnDef<Holding>[] = createColumns(() => { })
