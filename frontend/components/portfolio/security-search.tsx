"use client"

import * as React from "react"
import { Check, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { searchSecurities, SecuritySearchResult } from "@/lib/api"

type SecuritySearchProps = {
    onSelect: (security: SecuritySearchResult) => void
    placeholder?: string
    selectedTicker?: string
}

export function SecuritySearch({ onSelect, placeholder = "Search securities...", selectedTicker }: SecuritySearchProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<SecuritySearchResult[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        if (query.length < 1) {
            setResults([])
            return
        }

        setIsLoading(true)
        debounceRef.current = setTimeout(async () => {
            const data = await searchSecurities(query)
            setResults(data)
            setIsLoading(false)
        }, 300)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [query])

    const handleSelect = (security: SecuritySearchResult) => {
        onSelect(security)
        setOpen(false)
        setQuery("")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedTicker ? (
                        <span className="font-medium">{selectedTicker}</span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search by ticker or name..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {isLoading && (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                            </div>
                        )}
                        {!isLoading && query.length > 0 && results.length === 0 && (
                            <CommandEmpty>No securities found.</CommandEmpty>
                        )}
                        {!isLoading && results.length > 0 && (
                            <CommandGroup heading="Results">
                                {results.map((security) => (
                                    <CommandItem
                                        key={security.ticker}
                                        value={security.ticker}
                                        onSelect={() => handleSelect(security)}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedTicker === security.ticker ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-1 items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{security.ticker}</span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {security.name}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-muted-foreground capitalize">
                                                    {security.asset_type}
                                                </span>
                                                {security.current_price && (
                                                    <span className="text-sm font-medium">
                                                        ${security.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
