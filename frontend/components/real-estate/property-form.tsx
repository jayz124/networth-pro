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
import { Property, PropertySearchResult, createProperty, updateProperty, getValuationStatus } from "@/lib/api"
import { AddressSearch } from "@/components/real-estate/address-search"

const propertyTypes = [
    { value: "residential", label: "Residential" },
    { value: "rental", label: "Rental Property" },
    { value: "commercial", label: "Commercial" },
    { value: "land", label: "Land" },
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

    const [name, setName] = React.useState(property?.name || "")
    const [address, setAddress] = React.useState(property?.address || "")
    const [propertyType, setPropertyType] = React.useState(property?.property_type || "residential")
    const [purchasePrice, setPurchasePrice] = React.useState(property?.purchase_price?.toString() || "")
    const [currentValue, setCurrentValue] = React.useState(property?.current_value?.toString() || "")
    const [purchaseDate, setPurchaseDate] = React.useState(property?.purchase_date || "")

    // Valuation provider fields
    const [providerPropertyId, setProviderPropertyId] = React.useState<string | undefined>(property?.provider_property_id)
    const [valuationProvider, setValuationProvider] = React.useState<string | undefined>(property?.valuation_provider)
    const [rentcastAvailable, setRentcastAvailable] = React.useState(false)
    const [autoFilled, setAutoFilled] = React.useState(false)

    // Check if RentCast is available
    React.useEffect(() => {
        if (open) {
            getValuationStatus().then(status => {
                setRentcastAvailable(status.rentcast_available)
            })
        }
    }, [open])

    // Reset form when property changes
    React.useEffect(() => {
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

        // Auto-fill name if empty
        if (!name) {
            setName(result.address || "")
        }
    }

    const handleSubmit = async () => {
        if (!name || !address || !purchasePrice || !currentValue) return

        setIsLoading(true)

        const data = {
            name,
            address,
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

        setIsLoading(false)

        if (result) {
            onOpenChange(false)
            onSaved()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Property" : "Add New Property"}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? "Update your property details." : "Add a new property to track your real estate portfolio."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            placeholder="My Home"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            Address
                        </Label>
                        <div className="col-span-3 space-y-2">
                            {rentcastAvailable ? (
                                <>
                                    <AddressSearch
                                        onSelect={handleAddressSelect}
                                        selectedAddress={address}
                                        placeholder="Search US address..."
                                    />
                                    {!address && (
                                        <p className="text-xs text-muted-foreground">
                                            Search to auto-fill property details, or type manually below
                                        </p>
                                    )}
                                    <Input
                                        placeholder="Or enter address manually"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value)
                                            setProviderPropertyId(undefined)
                                            setValuationProvider(undefined)
                                            setAutoFilled(false)
                                        }}
                                    />
                                </>
                            ) : (
                                <Input
                                    id="address"
                                    placeholder="123 Main St, City, State"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                />
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <div className="col-span-3">
                            <Select value={propertyType} onValueChange={setPropertyType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {propertyTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="purchase-price" className="text-right">
                            Purchase Price
                        </Label>
                        <Input
                            id="purchase-price"
                            type="number"
                            step="any"
                            placeholder="450000"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="current-value" className="text-right">
                            Current Value
                        </Label>
                        <div className="col-span-3 space-y-1">
                            <Input
                                id="current-value"
                                type="number"
                                step="any"
                                placeholder="520000"
                                value={currentValue}
                                onChange={(e) => {
                                    setCurrentValue(e.target.value)
                                    setAutoFilled(false)
                                }}
                            />
                            {autoFilled && valuationProvider && (
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className="text-xs">
                                        Auto-filled from RentCast
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="purchase-date" className="text-right">
                            Purchase Date
                        </Label>
                        <Input
                            id="purchase-date"
                            type="date"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !name || !address || !purchasePrice || !currentValue}
                    >
                        {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Property"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
