"use client"

import * as React from "react"
import { Building2, MapPin, MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Property, deleteProperty } from "@/lib/api"
import { MortgageForm } from "@/components/real-estate/mortgage-form"
import { PropertyForm } from "@/components/real-estate/property-form"

type PropertyCardProps = {
    property: Property
    onUpdate: () => void
}

export function PropertyCard({ property, onUpdate }: PropertyCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
    const [showEditDialog, setShowEditDialog] = React.useState(false)
    const [showMortgageDialog, setShowMortgageDialog] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        const success = await deleteProperty(property.id)
        setIsDeleting(false)
        if (success) {
            setShowDeleteDialog(false)
            onUpdate()
        }
    }

    const appreciationPercent = property.appreciation_percent || 0
    const isPositiveAppreciation = appreciationPercent >= 0

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Building2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{property.name}</CardTitle>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                {property.address}
                            </div>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setShowDeleteDialog(true)}
                                className="text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{property.property_type}</span>
                        <span className={`font-medium ${isPositiveAppreciation ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositiveAppreciation ? '+' : ''}{appreciationPercent.toFixed(1)}%
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Current Value</p>
                            <p className="text-lg font-bold">{formatCurrency(property.current_value)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Your Equity</p>
                            <p className="text-lg font-bold text-emerald-500">
                                {formatCurrency(property.equity || property.current_value)}
                            </p>
                        </div>
                    </div>

                    {property.total_mortgage_balance && property.total_mortgage_balance > 0 && (
                        <div className="pt-3 border-t">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Mortgage Balance</span>
                                <span className="font-medium">{formatCurrency(property.total_mortgage_balance)}</span>
                            </div>
                            {property.monthly_payments && property.monthly_payments > 0 && (
                                <div className="flex justify-between text-sm mt-1">
                                    <span className="text-muted-foreground">Monthly Payment</span>
                                    <span className="font-medium">{formatCurrency(property.monthly_payments)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {property.mortgages && property.mortgages.length > 0 && (
                        <div className="pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Mortgages</p>
                            {property.mortgages.map((mortgage) => (
                                <div key={mortgage.id} className="flex justify-between text-sm py-1">
                                    <span>{mortgage.lender || 'Mortgage'}</span>
                                    <span className="text-muted-foreground">{mortgage.interest_rate}% APR</span>
                                </div>
                            ))}
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
                            className="bg-red-600 hover:bg-red-700"
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
