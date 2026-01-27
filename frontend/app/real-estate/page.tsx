"use client"

import * as React from "react"
import { Plus } from "lucide-react"
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

        return { totalValue, totalEquity, totalMortgage, monthlyPayments }
    }, [properties])

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Real Estate</h2>
                    <p className="text-muted-foreground">Track your properties and mortgages</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                </Button>
            </div>

            <PropertySummary
                totalValue={metrics.totalValue}
                totalEquity={metrics.totalEquity}
                totalMortgage={metrics.totalMortgage}
                monthlyPayments={metrics.monthlyPayments}
            />

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                    Loading properties...
                </div>
            ) : properties.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {properties.map((property) => (
                        <PropertyCard
                            key={property.id}
                            property={property}
                            onUpdate={loadProperties}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-card text-card-foreground rounded-xl border shadow p-12 text-center">
                    <div className="max-w-sm mx-auto">
                        <h3 className="text-lg font-medium">No properties yet</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Add your first property to start tracking your real estate portfolio and equity.
                        </p>
                        <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Property
                        </Button>
                    </div>
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
