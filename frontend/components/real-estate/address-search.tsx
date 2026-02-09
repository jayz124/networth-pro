"use client"

import * as React from "react"
import { Loader2, Search, MapPin, Home } from "lucide-react"
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
import { searchPropertyAddress, PropertySearchResult } from "@/lib/api"

type AddressSearchProps = {
    onSelect: (result: PropertySearchResult) => void
    placeholder?: string
    selectedAddress?: string
    disabled?: boolean
}

export function AddressSearch({
    onSelect,
    placeholder = "Search by address...",
    selectedAddress,
    disabled = false,
}: AddressSearchProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<PropertySearchResult[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        if (query.length < 3) {
            setResults([])
            return
        }

        setIsLoading(true)
        debounceRef.current = setTimeout(async () => {
            const data = await searchPropertyAddress(query)
            setResults(data)
            setIsLoading(false)
        }, 500)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [query])

    const handleSelect = (result: PropertySearchResult) => {
        onSelect(result)
        setOpen(false)
        setQuery("")
    }

    const formatDetails = (result: PropertySearchResult) => {
        const parts: string[] = []
        if (result.bedrooms) parts.push(`${result.bedrooms} bed`)
        if (result.bathrooms) parts.push(`${result.bathrooms} bath`)
        if (result.square_footage) parts.push(`${result.square_footage.toLocaleString()} sqft`)
        if (result.year_built) parts.push(`Built ${result.year_built}`)
        return parts.join(" · ")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between text-left font-normal"
                    disabled={disabled}
                >
                    {selectedAddress ? (
                        <span className="flex items-center gap-2 truncate">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{selectedAddress}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Type a US address..."
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
                        {!isLoading && query.length >= 3 && results.length === 0 && (
                            <CommandEmpty>No properties found for this address.</CommandEmpty>
                        )}
                        {!isLoading && results.length > 0 && (
                            <CommandGroup heading="Results">
                                {results.map((result, index) => (
                                    <CommandItem
                                        key={`${result.provider_property_id}-${index}`}
                                        value={result.address}
                                        onSelect={() => handleSelect(result)}
                                        className="cursor-pointer"
                                    >
                                        <Home className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex flex-1 flex-col min-w-0">
                                            <span className="font-medium text-sm truncate">{result.address}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {[result.city, result.state, result.zip_code].filter(Boolean).join(", ")}
                                            </span>
                                            {formatDetails(result) && (
                                                <span className="text-xs text-muted-foreground mt-0.5">
                                                    {formatDetails(result)}
                                                </span>
                                            )}
                                        </div>
                                        {result.last_sale_price && (
                                            <span className="text-sm font-medium ml-2 shrink-0">
                                                ${result.last_sale_price.toLocaleString()}
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {!isLoading && query.length < 3 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Enter at least 3 characters to search
                            </div>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
