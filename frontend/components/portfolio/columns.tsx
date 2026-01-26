"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Bitcoin, Building, Coins, DollarSign, LineChart, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Holding = {
    id: number
    portfolioId: string
    ticker: string
    asset_type: string
    quantity: number
    currency: string
    purchase_price?: number
    current_value?: number
    change_24h?: number
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

export const columns: ColumnDef<Holding>[] = [
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
                        <span className="text-xs text-muted-foreground">{row.original.name}</span>
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
            const price = parseFloat(row.getValue("purchase_price") || "0")
            return <div>${price.toLocaleString()}</div>
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
            return <div className="font-bold">${val.toLocaleString()}</div>
        },
    },
    {
        accessorKey: "change_24h",
        header: "24h Change",
        cell: ({ row }) => {
            const change = row.original.change_24h || 0
            const isPositive = change >= 0
            return (
                <div className={`font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{change}%
                </div>
            )
        }
    }
]
