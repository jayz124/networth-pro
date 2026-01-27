"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Bitcoin, Building, Coins, LineChart, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoldingActions } from "@/components/portfolio/holding-actions"

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
            return <Bitcoin className="mr-2 h-4 w-4 text-orange-500" />
        case 'stock':
            return <LineChart className="mr-2 h-4 w-4 text-blue-500" />
        case 'etf':
            return <Coins className="mr-2 h-4 w-4 text-purple-500" />
        case 'real estate':
        case 'reit':
            return <Building className="mr-2 h-4 w-4 text-emerald-500" />
        default:
            return <Wallet className="mr-2 h-4 w-4 text-gray-500" />
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
                >
                    Asset
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const icon = getAssetIcon(row.getValue("asset_type"))
            return (
                <div className="flex items-center">
                    {icon}
                    <div className="flex flex-col">
                        <span className="font-bold">{row.getValue("ticker")}</span>
                        <span className="text-xs text-muted-foreground">{row.original.name || row.original.asset_type}</span>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "asset_type",
        header: "Type",
        cell: ({ row }) => <div className="capitalize">{row.getValue("asset_type")}</div>
    },
    {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => {
            const qty = parseFloat(row.getValue("quantity"))
            return <div className="font-medium">{qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        },
    },
    {
        accessorKey: "purchase_price",
        header: "Avg Price",
        cell: ({ row }) => {
            const price = row.original.purchase_price
            if (!price) return <div className="text-muted-foreground">-</div>
            return <div>${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        },
    },
    {
        accessorKey: "cost_basis",
        header: "Cost Basis",
        cell: ({ row }) => {
            const cost = row.original.cost_basis
            if (!cost) return <div className="text-muted-foreground">-</div>
            return <div>${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        },
    },
    {
        accessorKey: "current_value",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Value
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const val = row.original.current_value || 0
            return <div className="font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        },
    },
    {
        accessorKey: "unrealized_gain",
        header: "Unrealized P&L",
        cell: ({ row }) => {
            const gain = row.original.unrealized_gain
            if (gain === undefined || gain === null) return <div className="text-muted-foreground">-</div>
            const isPositive = gain >= 0
            return (
                <div className={`font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{gain.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                </div>
            )
        }
    },
    {
        accessorKey: "gain_percent",
        header: "P&L %",
        cell: ({ row }) => {
            const percent = row.original.gain_percent
            if (percent === undefined || percent === null) return <div className="text-muted-foreground">-</div>
            const isPositive = percent >= 0
            return (
                <div className={`font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
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
export const columns: ColumnDef<Holding>[] = createColumns(() => {})
