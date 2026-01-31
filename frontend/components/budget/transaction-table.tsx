"use client"

import * as React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { MoreHorizontal, Pencil, Trash2, Sparkles, RefreshCw } from "lucide-react"
import { Transaction, deleteTransaction } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

interface TransactionTableProps {
    transactions: Transaction[]
    isLoading: boolean
    onEdit: (transaction: Transaction) => void
    onRefresh: () => void
}

export function TransactionTable({
    transactions,
    isLoading,
    onEdit,
    onRefresh,
}: TransactionTableProps) {
    const { formatCurrency } = useSettings()
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const [transactionToDelete, setTransactionToDelete] = React.useState<Transaction | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const handleDeleteClick = (transaction: Transaction) => {
        setTransactionToDelete(transaction)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!transactionToDelete) return
        setIsDeleting(true)
        const success = await deleteTransaction(transactionToDelete.id)
        if (success) {
            onRefresh()
        }
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setTransactionToDelete(null)
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-muted-foreground">No transactions found</p>
                <p className="text-sm text-muted-foreground">Add your first transaction to get started</p>
            </div>
        )
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((txn) => (
                            <TableRow key={txn.id}>
                                <TableCell className="font-medium text-muted-foreground">
                                    {formatDate(txn.date)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{txn.description}</span>
                                        {txn.merchant && (
                                            <span className="text-xs text-muted-foreground">
                                                {txn.merchant}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {txn.category_name ? (
                                        <Badge
                                            variant="outline"
                                            className="font-normal"
                                            style={{
                                                borderColor: txn.category_color || "#64748b",
                                                color: txn.category_color || "#64748b",
                                            }}
                                        >
                                            {txn.ai_categorized && (
                                                <Sparkles className="h-3 w-3 mr-1" />
                                            )}
                                            {txn.category_name}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">
                                            Uncategorized
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${
                                    txn.amount >= 0 ? "text-success" : "text-destructive"
                                }`}>
                                    {txn.amount >= 0 ? "+" : ""}{formatCurrency(txn.amount)}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(txn)}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDeleteClick(txn)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this transaction? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
