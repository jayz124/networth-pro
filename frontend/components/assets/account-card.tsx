"use client"

import * as React from "react"
import { Wallet, Building, MoreHorizontal, Pencil, Trash2, DollarSign, PiggyBank, TrendingUp, Banknote } from "lucide-react"
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
import { Account, deleteAccount } from "@/lib/api"
import { AccountForm } from "@/components/assets/account-form"
import { UpdateBalanceDialog } from "@/components/assets/update-balance-dialog"
import { useSettings } from "@/lib/settings-context"

type AccountCardProps = {
    account: Account
    onUpdate: () => void
}

const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'checking':
            return <Building className="h-5 w-5 text-info" />
        case 'savings':
            return <PiggyBank className="h-5 w-5 text-success" />
        case 'investment':
            return <TrendingUp className="h-5 w-5 text-accent" />
        case 'cash':
            return <Banknote className="h-5 w-5 text-warning" />
        default:
            return <Wallet className="h-5 w-5 text-accent" />
    }
}

const getAccountColor = (type: string) => {
    switch (type.toLowerCase()) {
        case 'checking':
            return 'bg-info/10'
        case 'savings':
            return 'bg-success/10'
        case 'investment':
            return 'bg-accent/10'
        case 'cash':
            return 'bg-warning/10'
        default:
            return 'bg-accent/10'
    }
}

export function AccountCard({ account, onUpdate }: AccountCardProps) {
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
        const success = await deleteAccount(account.id)
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
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getAccountColor(account.type)} transition-colors group-hover:opacity-80`}>
                            {getAccountIcon(account.type)}
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-base leading-tight">{account.name}</CardTitle>
                            {account.institution && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Building className="h-3 w-3" />
                                    <span className="truncate max-w-[180px]">{account.institution}</span>
                                </div>
                            )}
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
                                Edit Account
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
                    {/* Type Badge */}
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-1 text-xs font-medium capitalize">
                            {account.type}
                        </span>
                    </div>

                    {/* Balance */}
                    <div className="py-2">
                        <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                        <p className="text-2xl font-bold tabular-nums text-gain">
                            {formatCurrency(account.current_balance)}
                        </p>
                    </div>

                    {/* Last Updated */}
                    <div className="pt-3 border-t border-border/50">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Last updated</span>
                            <span className="font-medium">{formatDate(account.last_updated)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Account Dialog */}
            <AccountForm
                account={account}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSaved={onUpdate}
            />

            {/* Update Balance Dialog */}
            <UpdateBalanceDialog
                account={account}
                open={showBalanceDialog}
                onOpenChange={setShowBalanceDialog}
                onSaved={onUpdate}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this account and all balance history.
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
