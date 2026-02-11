"use client"

import * as React from "react"
import { CreditCard, MoreHorizontal, Pencil, Trash2, DollarSign, Car, GraduationCap, Home, Banknote } from "lucide-react"
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
import { Liability, deleteLiability } from "@/lib/api"
import { LiabilityForm } from "@/components/liabilities/liability-form"
import { UpdateLiabilityBalanceDialog } from "@/components/liabilities/update-liability-balance-dialog"
import { useSettings } from "@/lib/settings-context"

type LiabilityCardProps = {
    liability: Liability
    onUpdate: () => void
}

function normalizeLiabilityCategory(category: string | null | undefined): string {
    if (!category) return 'other'
    const c = category.toLowerCase().trim()
    if (c === 'credit_card' || c === 'credit card') return 'credit_card'
    if (c === 'auto_loan' || c === 'auto loan' || c === 'car loan') return 'auto_loan'
    if (c === 'student_loan' || c === 'student loan') return 'student_loan'
    if (c === 'personal_loan' || c === 'personal loan') return 'personal_loan'
    if (c === 'mortgage') return 'mortgage'
    return 'other'
}

const getLiabilityIcon = (category: string) => {
    switch (normalizeLiabilityCategory(category)) {
        case 'credit_card':
            return <CreditCard className="h-5 w-5 text-destructive" />
        case 'auto_loan':
            return <Car className="h-5 w-5 text-warning" />
        case 'student_loan':
            return <GraduationCap className="h-5 w-5 text-info" />
        case 'mortgage':
            return <Home className="h-5 w-5 text-accent" />
        case 'personal_loan':
            return <Banknote className="h-5 w-5 text-warning" />
        default:
            return <CreditCard className="h-5 w-5 text-destructive" />
    }
}

const getLiabilityColor = (category: string) => {
    switch (normalizeLiabilityCategory(category)) {
        case 'credit_card':
            return 'bg-destructive/10'
        case 'auto_loan':
            return 'bg-warning/10'
        case 'student_loan':
            return 'bg-info/10'
        case 'mortgage':
            return 'bg-accent/10'
        case 'personal_loan':
            return 'bg-warning/10'
        default:
            return 'bg-destructive/10'
    }
}

const formatCategory = (category: string) => {
    if (!category) return 'Other'
    // Handle both "credit_card" and "Credit Card" formats
    return category.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function LiabilityCard({ liability, onUpdate }: LiabilityCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
    const [showEditDialog, setShowEditDialog] = React.useState(false)
    const [showBalanceDialog, setShowBalanceDialog] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const { formatCurrency } = useSettings()

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Never'
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        const success = await deleteLiability(liability.id)
        setIsDeleting(false)
        if (success) {
            setShowDeleteDialog(false)
            onUpdate()
        }
    }

    return (
        <>
            <Card variant="elevated" className="group">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getLiabilityColor(liability.category || '')} transition-colors group-hover:opacity-80`}>
                            {getLiabilityIcon(liability.category || '')}
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-base leading-tight">{liability.name}</CardTitle>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{formatCategory(liability.category || '')}</span>
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
                            <DropdownMenuItem onClick={() => setShowBalanceDialog(true)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Update Balance
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Liability
                            </DropdownMenuItem>
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
                    {/* Category Badge */}
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-1 text-xs font-medium">
                            {formatCategory(liability.category || '')}
                        </span>
                    </div>

                    {/* Balance */}
                    <div className="py-2">
                        <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
                        <p className="text-2xl font-bold tabular-nums text-loss">
                            {formatCurrency(liability.current_balance)}
                        </p>
                    </div>

                    {/* Last Updated */}
                    <div className="pt-3 border-t border-border/50">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Last updated</span>
                            <span className="font-medium">{formatDate(liability.last_updated)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Liability Dialog */}
            <LiabilityForm
                liability={liability}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSaved={onUpdate}
            />

            {/* Update Balance Dialog */}
            <UpdateLiabilityBalanceDialog
                liability={liability}
                open={showBalanceDialog}
                onOpenChange={setShowBalanceDialog}
                onSaved={onUpdate}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {liability.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this liability and all balance history.
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
