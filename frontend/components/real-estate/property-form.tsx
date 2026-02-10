"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Property, PropertySearchResult, createProperty, updateProperty, addMortgage, getValuationStatus } from "@/lib/api"
import { AddressSearch } from "@/components/real-estate/address-search"
import { useSettings } from "@/lib/settings-context"
import { Home, Building, TreePine, Warehouse, Building2, AlertCircle, ChevronDown, ChevronUp, Landmark } from "lucide-react"

const propertyTypes = [
    { value: "residential", label: "Residential", icon: Home },
    { value: "rental", label: "Rental Property", icon: Warehouse },
    { value: "commercial", label: "Commercial", icon: Building },
    { value: "land", label: "Land", icon: TreePine },
]

type PropertyFormProps = {
    property?: Property
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}

export function PropertyForm({ property, open, onOpenChange, onSaved }: PropertyFormProps) {
    const isEditing = !!property
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const { settings, formatCurrency } = useSettings()

    // Property fields
    const [name, setName] = React.useState("")
    const [address, setAddress] = React.useState("")
    const [propertyType, setPropertyType] = React.useState("residential")
    const [purchasePrice, setPurchasePrice] = React.useState("")
    const [currentValue, setCurrentValue] = React.useState("")
    const [purchaseDate, setPurchaseDate] = React.useState("")

    // Valuation provider fields
    const [providerPropertyId, setProviderPropertyId] = React.useState<string | undefined>()
    const [valuationProvider, setValuationProvider] = React.useState<string | undefined>()
    const [rentcastAvailable, setRentcastAvailable] = React.useState(false)
    const [autoFilled, setAutoFilled] = React.useState(false)

    // Mortgage section (new properties only)
    const [showMortgage, setShowMortgage] = React.useState(false)
    const [mortgageLender, setMortgageLender] = React.useState("")
    const [mortgageOriginal, setMortgageOriginal] = React.useState("")
    const [mortgageBalance, setMortgageBalance] = React.useState("")
    const [mortgageRate, setMortgageRate] = React.useState("")
    const [mortgagePayment, setMortgagePayment] = React.useState("")
    const [mortgageTerm, setMortgageTerm] = React.useState("30")

    // Touched tracking for validation
    const [touched, setTouched] = React.useState<Record<string, boolean>>({})
    const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }))

    // Check if RentCast is available
    React.useEffect(() => {
        if (open) {
            getValuationStatus().then(status => {
                setRentcastAvailable(status.rentcast_available)
            })
        }
    }, [open])

    // Reset form when property changes or dialog opens
    React.useEffect(() => {
        if (open) {
            setError(null)
            setTouched({})
            if (property) {
                setName(property.name)
                setAddress(property.address)
                setPropertyType(property.property_type)
                setPurchasePrice(property.purchase_price.toString())
                setCurrentValue(property.current_value.toString())
                setPurchaseDate(property.purchase_date || "")
                setProviderPropertyId(property.provider_property_id)
                setValuationProvider(property.valuation_provider)
                setAutoFilled(false)
                setShowMortgage(false)
            } else {
                setName("")
                setAddress("")
                setPropertyType("residential")
                setPurchasePrice("")
                setCurrentValue("")
                setPurchaseDate("")
                setProviderPropertyId(undefined)
                setValuationProvider(undefined)
                setAutoFilled(false)
                setShowMortgage(false)
                setMortgageLender("")
                setMortgageOriginal("")
                setMortgageBalance("")
                setMortgageRate("")
                setMortgagePayment("")
                setMortgageTerm("30")
            }
        }
    }, [property, open])

    const handleAddressSelect = (result: PropertySearchResult) => {
        const fullAddress = [result.address, result.city, result.state, result.zip_code].filter(Boolean).join(", ")
        setAddress(fullAddress)
        setProviderPropertyId(result.provider_property_id)
        setValuationProvider(result.provider)

        // Auto-fill current value from last sale or tax assessment
        if (result.last_sale_price && !currentValue) {
            setCurrentValue(result.last_sale_price.toString())
            setAutoFilled(true)
        } else if (result.tax_assessed_value && !currentValue) {
            setCurrentValue(result.tax_assessed_value.toString())
            setAutoFilled(true)
        }

        // Auto-fill purchase price from last sale
        if (result.last_sale_price && !purchasePrice) {
            setPurchasePrice(result.last_sale_price.toString())
        }

        // Auto-fill name if empty
        if (!name) {
            setName(result.address || "")
        }

        // Auto-fill property type from search result
        if (result.property_type) {
            const typeMap: Record<string, string> = {
                "Single Family": "residential",
                "Multi Family": "rental",
                "Condo": "residential",
                "Townhouse": "residential",
                "Commercial": "commercial",
                "Land": "land",
            }
            const mapped = typeMap[result.property_type] || "residential"
            setPropertyType(mapped)
        }
    }

    // Compute equity preview
    const previewEquity = React.useMemo(() => {
        const cv = parseFloat(currentValue) || 0
        const mb = parseFloat(mortgageBalance) || 0
        if (cv === 0) return null
        return cv - mb
    }, [currentValue, mortgageBalance])

    // Validation
    const isNameValid = name.trim().length > 0
    const isAddressValid = address.trim().length > 0
    const isPurchasePriceValid = purchasePrice !== "" && parseFloat(purchasePrice) >= 0
    const isCurrentValueValid = currentValue !== "" && parseFloat(currentValue) >= 0
    const canSubmit = isNameValid && isAddressValid && isPurchasePriceValid && isCurrentValueValid

    // Mortgage validation (only if mortgage section is expanded and has any content)
    const hasMortgageData = mortgageOriginal || mortgageBalance || mortgageRate || mortgagePayment
    const isMortgageValid = !showMortgage || !hasMortgageData || (
        parseFloat(mortgageOriginal) > 0 &&
        parseFloat(mortgageBalance) >= 0 &&
        parseFloat(mortgageRate) >= 0 &&
        parseFloat(mortgagePayment) >= 0
    )

    const handleSubmit = async () => {
        if (!canSubmit || !isMortgageValid) return

        setIsLoading(true)
        setError(null)

        try {
            const data = {
                name: name.trim(),
                address: address.trim(),
                property_type: propertyType,
                purchase_price: parseFloat(purchasePrice),
                current_value: parseFloat(currentValue),
                purchase_date: purchaseDate || undefined,
                provider_property_id: providerPropertyId,
                valuation_provider: valuationProvider,
            }

            let result
            if (isEditing && property) {
                result = await updateProperty(property.id, data)
            } else {
                result = await createProperty(data)
            }

            if (!result) {
                setError("Failed to save property. Please try again.")
                setIsLoading(false)
                return
            }

            // If adding a new property with mortgage data, create the mortgage too
            if (!isEditing && showMortgage && hasMortgageData && result.id) {
                const mortgageResult = await addMortgage(result.id, {
                    lender: mortgageLender || undefined,
                    original_principal: parseFloat(mortgageOriginal),
                    current_balance: parseFloat(mortgageBalance),
                    interest_rate: parseFloat(mortgageRate),
                    monthly_payment: parseFloat(mortgagePayment),
                    term_years: parseInt(mortgageTerm),
                })
                if (!mortgageResult) {
                    // Property was created but mortgage failed — still close, but show a note
                    console.warn("Property created but mortgage creation failed")
                }
            }

            setIsLoading(false)
            onOpenChange(false)
            onSaved()
        } catch {
            setError("An unexpected error occurred. Please try again.")
            setIsLoading(false)
        }
    }

    const currencySymbol = settings.currency.symbol

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-accent" />
                        {isEditing ? "Edit Property" : "Add Property"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update your property details."
                            : "Add a property to track its value and build equity."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Error display */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── Property Details ── */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Property Details</h4>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="prop-name">
                                Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="prop-name"
                                placeholder="e.g. Primary Residence"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={() => markTouched("name")}
                                className={touched.name && !isNameValid ? "border-destructive" : ""}
                            />
                            {touched.name && !isNameValid && (
                                <p className="text-xs text-destructive">Name is required</p>
                            )}
                        </div>

                        {/* Address */}
                        <div className="space-y-2">
                            <Label>
                                Address <span className="text-destructive">*</span>
                            </Label>
                            {rentcastAvailable ? (
                                <div className="space-y-2">
                                    <AddressSearch
                                        onSelect={handleAddressSelect}
                                        selectedAddress={address}
                                        placeholder="Search US address for auto-fill..."
                                    />
                                    <Input
                                        placeholder="Or type address manually"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value)
                                            setProviderPropertyId(undefined)
                                            setValuationProvider(undefined)
                                            setAutoFilled(false)
                                        }}
                                        onBlur={() => markTouched("address")}
                                        className={touched.address && !isAddressValid ? "border-destructive" : ""}
                                    />
                                </div>
                            ) : (
                                <Input
                                    placeholder="123 Main St, City, State ZIP"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onBlur={() => markTouched("address")}
                                    className={touched.address && !isAddressValid ? "border-destructive" : ""}
                                />
                            )}
                            {touched.address && !isAddressValid && (
                                <p className="text-xs text-destructive">Address is required</p>
                            )}
                        </div>

                        {/* Property Type */}
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={propertyType} onValueChange={setPropertyType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {propertyTypes.map((type) => {
                                        const Icon = type.icon
                                        return (
                                            <SelectItem key={type.value} value={type.value}>
                                                <span className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                    {type.label}
                                                </span>
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* ── Financials ── */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Financials</h4>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Purchase Price */}
                            <div className="space-y-2">
                                <Label htmlFor="purchase-price">
                                    Purchase Price <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                    <Input
                                        id="purchase-price"
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="450,000"
                                        value={purchasePrice}
                                        onChange={(e) => setPurchasePrice(e.target.value)}
                                        onBlur={() => markTouched("purchasePrice")}
                                        className={`pl-7 ${touched.purchasePrice && !isPurchasePriceValid ? "border-destructive" : ""}`}
                                    />
                                </div>
                            </div>

                            {/* Current Value */}
                            <div className="space-y-2">
                                <Label htmlFor="current-value">
                                    Current Value <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                    <Input
                                        id="current-value"
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="520,000"
                                        value={currentValue}
                                        onChange={(e) => {
                                            setCurrentValue(e.target.value)
                                            setAutoFilled(false)
                                        }}
                                        onBlur={() => markTouched("currentValue")}
                                        className={`pl-7 ${touched.currentValue && !isCurrentValueValid ? "border-destructive" : ""}`}
                                    />
                                </div>
                                {autoFilled && valuationProvider && (
                                    <Badge variant="secondary" className="text-xs">
                                        Auto-filled from RentCast
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Purchase Date */}
                        <div className="space-y-2">
                            <Label htmlFor="purchase-date">Purchase Date</Label>
                            <Input
                                id="purchase-date"
                                type="date"
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        {/* Appreciation preview */}
                        {purchasePrice && currentValue && parseFloat(currentValue) > 0 && parseFloat(purchasePrice) > 0 && (
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Appreciation</span>
                                    {(() => {
                                        const gain = parseFloat(currentValue) - parseFloat(purchasePrice)
                                        const pct = (gain / parseFloat(purchasePrice)) * 100
                                        const isPositive = gain >= 0
                                        return (
                                            <span className={`font-medium tabular-nums ${isPositive ? "text-gain" : "text-loss"}`}>
                                                {isPositive ? "+" : ""}{formatCurrency(gain)} ({isPositive ? "+" : ""}{pct.toFixed(1)}%)
                                            </span>
                                        )
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Mortgage Section (new properties only) ── */}
                    {!isEditing && (
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setShowMortgage(!showMortgage)}
                                className="flex items-center gap-2 text-sm font-medium text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors w-full"
                            >
                                <Landmark className="h-4 w-4" />
                                <span>Mortgage</span>
                                <span className="text-xs font-normal normal-case text-muted-foreground/70">(optional)</span>
                                {showMortgage ? (
                                    <ChevronUp className="h-4 w-4 ml-auto" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 ml-auto" />
                                )}
                            </button>

                            {showMortgage && (
                                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                    {/* Lender */}
                                    <div className="space-y-2">
                                        <Label htmlFor="mortgage-lender">Lender</Label>
                                        <Input
                                            id="mortgage-lender"
                                            placeholder="e.g. Chase, Wells Fargo"
                                            value={mortgageLender}
                                            onChange={(e) => setMortgageLender(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Original Loan */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mortgage-original">Original Loan</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                                <Input
                                                    id="mortgage-original"
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    placeholder="400,000"
                                                    value={mortgageOriginal}
                                                    onChange={(e) => setMortgageOriginal(e.target.value)}
                                                    className="pl-7"
                                                />
                                            </div>
                                        </div>

                                        {/* Current Balance */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mortgage-balance">Current Balance</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                                <Input
                                                    id="mortgage-balance"
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    placeholder="350,000"
                                                    value={mortgageBalance}
                                                    onChange={(e) => setMortgageBalance(e.target.value)}
                                                    className="pl-7"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Interest Rate */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mortgage-rate">Rate %</Label>
                                            <Input
                                                id="mortgage-rate"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="6.5"
                                                value={mortgageRate}
                                                onChange={(e) => setMortgageRate(e.target.value)}
                                            />
                                        </div>

                                        {/* Monthly Payment */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mortgage-payment">Monthly</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                                <Input
                                                    id="mortgage-payment"
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    placeholder="2,500"
                                                    value={mortgagePayment}
                                                    onChange={(e) => setMortgagePayment(e.target.value)}
                                                    className="pl-7"
                                                />
                                            </div>
                                        </div>

                                        {/* Term */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mortgage-term">Term (yrs)</Label>
                                            <Select value={mortgageTerm} onValueChange={setMortgageTerm}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="15">15</SelectItem>
                                                    <SelectItem value="20">20</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="30">30</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Equity preview */}
                                    {previewEquity !== null && showMortgage && mortgageBalance && (
                                        <div className="rounded-lg border bg-background px-4 py-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Estimated Equity</span>
                                                <span className={`font-medium tabular-nums ${previewEquity >= 0 ? "text-gain" : "text-loss"}`}>
                                                    {formatCurrency(previewEquity)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !canSubmit || !isMortgageValid}
                    >
                        {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Property"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
