"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const portfolios = [
    {
        value: "all",
        label: "All Portfolios",
        icon: Wallet,
    },
    {
        value: "personal",
        label: "Personal Stock",
        icon: Wallet,
    },
    {
        value: "crypto",
        label: "Crypto Assets",
        icon: Wallet,
    },
    {
        value: "real_estate",
        label: "Real Estate",
        icon: Wallet,
    },
    {
        value: "retirement",
        label: "Retirement (IRA)",
        icon: Wallet,
    },
]

type PortfolioSelectorProps = {
    selectedPortfolio: string
    onSelect: (value: string) => void
}

export function PortfolioSelector({ selectedPortfolio, onSelect }: PortfolioSelectorProps) {
    const [open, setOpen] = React.useState(false)

    const selected = portfolios.find(p => p.value === selectedPortfolio) || portfolios[0]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                    <div className="flex items-center gap-2 truncate">
                        <selected.icon className="h-4 w-4 shrink-0 opacity-50" />
                        {selected.label}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search portfolio..." />
                    <CommandList>
                        <CommandEmpty>No portfolio found.</CommandEmpty>
                        <CommandGroup heading="Portfolios">
                            {portfolios.map((portfolio) => (
                                <CommandItem
                                    key={portfolio.value}
                                    value={portfolio.value}
                                    onSelect={(currentValue) => {
                                        onSelect(currentValue === selectedPortfolio ? "all" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPortfolio === portfolio.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {portfolio.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Portfolio
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
