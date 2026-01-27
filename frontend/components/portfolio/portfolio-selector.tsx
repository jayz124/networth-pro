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
import { Portfolio } from "@/lib/api"
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog"

type PortfolioSelectorProps = {
    portfolios: Portfolio[]
    selectedPortfolio: string
    onSelect: (value: string) => void
    onPortfolioCreated: () => void
}

export function PortfolioSelector({ portfolios, selectedPortfolio, onSelect, onPortfolioCreated }: PortfolioSelectorProps) {
    const [open, setOpen] = React.useState(false)

    // Build list with "All Portfolios" option
    const allOption = { id: 0, name: "All Portfolios", value: "all" }

    const selected = selectedPortfolio === "all"
        ? allOption
        : portfolios.find(p => p.id.toString() === selectedPortfolio) || allOption

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
                        <Wallet className="h-4 w-4 shrink-0 opacity-50" />
                        {selected.name}
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
                            {/* All Portfolios option */}
                            <CommandItem
                                value="all"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedPortfolio === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All Portfolios
                            </CommandItem>
                            {/* Dynamic portfolios from API */}
                            {portfolios.map((portfolio) => (
                                <CommandItem
                                    key={portfolio.id}
                                    value={portfolio.id.toString()}
                                    onSelect={(currentValue) => {
                                        onSelect(currentValue === selectedPortfolio ? "all" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPortfolio === portfolio.id.toString() ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {portfolio.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CreatePortfolioDialog
                                onCreated={() => {
                                    setOpen(false)
                                    onPortfolioCreated()
                                }}
                                trigger={
                                    <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create Portfolio
                                    </div>
                                }
                            />
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
