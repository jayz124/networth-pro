"use client"

import * as React from "react"
import { Plus, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PropertySummary } from "@/components/real-estate/property-summary"
import { PropertyCard } from "@/components/real-estate/property-card"
import { PropertyForm } from "@/components/real-estate/property-form"
import { Property, fetchProperties } from "@/lib/api"

export default function RealEstatePage() {
    const [properties, setProperties] = React.useState<Property[]>([])
    const [showAddDialog, setShowAddDialog] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)

    const loadProperties = async () => {
        setIsLoading(true)
        const data = await fetchProperties()
        setProperties(data)
        setIsLoading(false)
    }

    React.useEffect(() => {
        loadProperties()
    }, [])

    // Calculate summary metrics
    const metrics = React.useMemo(() => {
        const totalValue = properties.reduce((sum, p) => sum + p.current_value, 0)
        const totalEquity = properties.reduce((sum, p) => sum + (p.equity || p.current_value), 0)
        const totalMortgage = properties.reduce((sum, p) => sum + (p.total_mortgage_balance || 0), 0)
        const monthlyPayments = properties.reduce((sum, p) => sum + (p.monthly_payments || 0), 0)

        return { totalValue, totalEquity, totalMortgage, monthlyPayments, propertyCount: properties.length }
    }, [properties])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Real Estate</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track your properties and build equity</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Property
                </Button>
            </div>

            {/* Summary Cards */}
            <PropertySummary
                totalValue={metrics.totalValue}
                totalEquity={metrics.totalEquity}
                totalMortgage={metrics.totalMortgage}
                monthlyPayments={metrics.monthlyPayments}
                propertyCount={metrics.propertyCount}
            />

            {/* Properties Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading properties...</p>
                    </div>
                </div>
            ) : properties.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    {properties.map((property, index) => (
                        <div
                            key={property.id}
                            className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_forwards]"
                            style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                        >
                            <PropertyCard
                                property={property}
                                onUpdate={loadProperties}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
                        <Building2 className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold">No properties yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Add your first property to start tracking your real estate portfolio and build equity
                    </p>
                    <Button variant="accent" className="mt-6 gap-2" onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4" />
                        Add Your First Property
                    </Button>
                </div>
            )}

            {/* Add Property Dialog */}
            <PropertyForm
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSaved={loadProperties}
            />
        </div>
    )
}
