"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SecuritySearch } from "@/components/portfolio/security-search"
import { Portfolio, SecuritySearchResult, addHolding } from "@/lib/api"

type AddHoldingDialogProps = {
    portfolios: Portfolio[]
    selectedPortfolioId?: number
    onAdded: () => void
}

export function AddHoldingDialog({ portfolios, selectedPortfolioId, onAdded }: AddHoldingDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    // Form state
    const [portfolioId, setPortfolioId] = React.useState<string>(
        selectedPortfolioId?.toString() || ""
    )
    const [selectedSecurity, setSelectedSecurity] = React.useState<SecuritySearchResult | null>(null)
    const [quantity, setQuantity] = React.useState("")
    const [purchasePrice, setPurchasePrice] = React.useState("")

    // Update portfolio when selectedPortfolioId changes
    React.useEffect(() => {
        if (selectedPortfolioId) {
            setPortfolioId(selectedPortfolioId.toString())
        }
    }, [selectedPortfolioId])

    const handleSecuritySelect = (security: SecuritySearchResult) => {
        setSelectedSecurity(security)
        // Auto-fill current price as purchase price if available
        if (security.current_price) {
            setPurchasePrice(security.current_price.toString())
        }
    }

    const handleSubmit = async () => {
        if (!portfolioId || !selectedSecurity || !quantity) return

        setIsLoading(true)
        const result = await addHolding(parseInt(portfolioId), {
            ticker: selectedSecurity.ticker,
            asset_type: selectedSecurity.asset_type,
            quantity: parseFloat(quantity),
            purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        })
        setIsLoading(false)

        if (result) {
            setOpen(false)
            resetForm()
            onAdded()
        }
    }

    const resetForm = () => {
        setSelectedSecurity(null)
        setQuantity("")
        setPurchasePrice("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Holding
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Holding</DialogTitle>
                    <DialogDescription>
                        Search for a security and add it to your portfolio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Portfolio Selector */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="portfolio" className="text-right">
                            Portfolio
                        </Label>
                        <div className="col-span-3">
                            <Select value={portfolioId} onValueChange={setPortfolioId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select portfolio" />
                                </SelectTrigger>
                                <SelectContent>
                                    {portfolios.map((p) => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Security Search */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            Security
                        </Label>
                        <div className="col-span-3">
                            <SecuritySearch
                                onSelect={handleSecuritySelect}
                                selectedTicker={selectedSecurity?.ticker}
                                placeholder="Search by ticker or name..."
                            />
                            {selectedSecurity && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {selectedSecurity.name} ({selectedSecurity.asset_type})
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">
                            Quantity
                        </Label>
                        <Input
                            id="quantity"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="col-span-3"
                        />
                    </div>

                    {/* Purchase Price */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="purchase-price" className="text-right">
                            Avg Price
                        </Label>
                        <Input
                            id="purchase-price"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            className="col-span-3"
                        />
                    </div>

                    {/* Preview */}
                    {selectedSecurity && quantity && purchasePrice && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-muted-foreground">
                                Total Cost
                            </Label>
                            <div className="col-span-3 text-sm font-medium">
                                ${(parseFloat(quantity) * parseFloat(purchasePrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !portfolioId || !selectedSecurity || !quantity}
                    >
                        {isLoading ? "Adding..." : "Add Holding"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
