"use client"

import * as React from "react"
import { Building2, MapPin, MoreHorizontal, Pencil, Trash2, Plus, TrendingUp, TrendingDown, Home, Building, TreePine, Warehouse, RefreshCw, BarChart3, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Property, deleteProperty, getPropertyValuation } from "@/lib/api"
import { MortgageForm } from "@/components/real-estate/mortgage-form"
import { PropertyForm } from "@/components/real-estate/property-form"
import { ValueHistoryChart } from "@/components/real-estate/value-history-chart"
import { useSettings } from "@/lib/settings-context"

type PropertyCardProps = {
    property: Property
    onUpdate: () => void
}

const getPropertyIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'residential':
            return <Home className="h-5 w-5 text-success" />
        case 'commercial':
            return <Building className="h-5 w-5 text-blue-500" />
        case 'land':
            return <TreePine className="h-5 w-5 text-amber-500" />
        case 'rental':
            return <Warehouse className="h-5 w-5 text-violet-500" />
        default:
            return <Building2 className="h-5 w-5 text-success" />
    }
}

export function PropertyCard({ property, onUpdate }: PropertyCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
    const [showEditDialog, setShowEditDialog] = React.useState(false)
    const [showMortgageDialog, setShowMortgageDialog] = React.useState(false)
    const [showHistoryDialog, setShowHistoryDialog] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isRefreshing, setIsRefreshing] = React.useState(false)
    const { formatCurrency } = useSettings()

    const handleDelete = async () => {
        setIsDeleting(true)
        const success = await deleteProperty(property.id)
        setIsDeleting(false)
        if (success) {
            setShowDeleteDialog(false)
            onUpdate()
        }
    }

    const handleRefreshValue = async () => {
        setIsRefreshing(true)
        await getPropertyValuation(property.id, true)
        setIsRefreshing(false)
        onUpdate()
    }

    const appreciationPercent = property.appreciation_percent || 0
    const isPositiveAppreciation = appreciationPercent >= 0
    const equity = property.equity || property.current_value

    // Rental yield calculation
    const estimatedRent = property.estimated_rent_monthly
    const grossYield = estimatedRent && property.current_value > 0
        ? (estimatedRent * 12) / property.current_value * 100
        : null

    return (
        <>
            <Card variant="elevated" className="group">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 transition-colors group-hover:bg-success/20">
                            {getPropertyIcon(property.property_type)}
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-base leading-tight">{property.name}</CardTitle>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[180px]">{property.address}</span>
                            </div>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Property
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowMortgageDialog(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Mortgage
                            </DropdownMenuItem>
                            {property.valuation_provider && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleRefreshValue} disabled={isRefreshing}>
                                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                        {isRefreshing ? "Refreshing..." : "Refresh Value"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowHistoryDialog(true)}>
                                        <BarChart3 className="mr-2 h-4 w-4" />
                                        Value History
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setShowDeleteDialog(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Type and Appreciation */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-1 text-xs font-medium capitalize">
                                {property.property_type}
                            </span>
                            {property.valuation_provider && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                                    RentCast
                                </Badge>
                            )}
                        </div>
                        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isPositiveAppreciation
                                ? "bg-success/10 text-gain"
                                : "bg-destructive/10 text-loss"
                            }`}>
                            {isPositiveAppreciation ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {isPositiveAppreciation ? '+' : ''}{appreciationPercent.toFixed(1)}%
                        </div>
                    </div>

                    {/* Value and Equity Grid */}
                    <div className="grid grid-cols-2 gap-4 py-2">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(property.current_value)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Your Equity</p>
                            <p className="text-xl font-bold tabular-nums text-gain">
                                {formatCurrency(equity)}
                            </p>
                        </div>
                    </div>

                    {/* Rental Estimate */}
                    {estimatedRent && estimatedRent > 0 && (
                        <div className="pt-3 border-t border-border/50 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Rental Estimate
                                </span>
                                <span className="text-sm font-medium tabular-nums">
                                    {formatCurrency(estimatedRent)}/mo
                                </span>
                            </div>
                            {grossYield !== null && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Gross Yield</span>
                                    <span className={`text-sm font-medium tabular-nums ${grossYield >= 5 ? "text-gain" : "text-muted-foreground"}`}>
                                        {grossYield.toFixed(1)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mortgage Info */}
                    {property.total_mortgage_balance && property.total_mortgage_balance > 0 && (
                        <div className="pt-3 border-t border-border/50 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Mortgage Balance</span>
                                <span className="text-sm font-medium tabular-nums text-loss">
                                    {formatCurrency(property.total_mortgage_balance)}
                                </span>
                            </div>
                            {property.monthly_payments && property.monthly_payments > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Monthly Payment</span>
                                    <span className="text-sm font-medium tabular-nums">
                                        {formatCurrency(property.monthly_payments)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mortgage Details */}
                    {property.mortgages && property.mortgages.length > 0 && (
                        <div className="pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2">Mortgages</p>
                            <div className="space-y-1.5">
                                {property.mortgages.map((mortgage) => (
                                    <div key={mortgage.id} className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{mortgage.lender || 'Mortgage'}</span>
                                        <span className="font-medium tabular-nums">{mortgage.interest_rate}% APR</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Property Dialog */}
            <PropertyForm
                property={property}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSaved={onUpdate}
            />

            {/* Add Mortgage Dialog */}
            <MortgageForm
                propertyId={property.id}
                open={showMortgageDialog}
                onOpenChange={setShowMortgageDialog}
                onSaved={onUpdate}
            />

            {/* Value History Dialog */}
            <ValueHistoryChart
                propertyId={property.id}
                propertyName={property.name}
                purchasePrice={property.purchase_price}
                open={showHistoryDialog}
                onOpenChange={setShowHistoryDialog}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {property.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this property and all associated mortgages.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
