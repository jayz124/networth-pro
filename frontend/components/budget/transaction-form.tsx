"use client"

import * as React from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Transaction,
    BudgetCategory,
    Account,
    createTransaction,
    updateTransaction,
} from "@/lib/api"

interface TransactionFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction?: Transaction  // If provided, we're editing
    categories: BudgetCategory[]
    accounts: Account[]
    onSaved: () => void
}

export function TransactionForm({
    open,
    onOpenChange,
    transaction,
    categories,
    accounts,
    onSaved,
}: TransactionFormProps) {
    const isEditing = !!transaction

    const [type, setType] = React.useState<"expense" | "income">(
        transaction && transaction.amount >= 0 ? "income" : "expense"
    )
    const [date, setDate] = React.useState(
        transaction?.date?.split("T")[0] || new Date().toISOString().split("T")[0]
    )
    const [description, setDescription] = React.useState(transaction?.description || "")
    const [amount, setAmount] = React.useState(
        transaction ? Math.abs(transaction.amount).toString() : ""
    )
    const [categoryId, setCategoryId] = React.useState<string>(
        transaction?.category_id?.toString() || ""
    )
    const [accountId, setAccountId] = React.useState<string>(
        transaction?.account_id?.toString() || ""
    )
    const [merchant, setMerchant] = React.useState(transaction?.merchant || "")
    const [notes, setNotes] = React.useState(transaction?.notes || "")
    const [isRecurring, setIsRecurring] = React.useState(transaction?.is_recurring || false)
    const [recurrenceFrequency, setRecurrenceFrequency] = React.useState<string>(
        transaction?.recurrence_frequency || "monthly"
    )
    const [isLoading, setIsLoading] = React.useState(false)

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            if (transaction) {
                setType(transaction.amount >= 0 ? "income" : "expense")
                setDate(transaction.date?.split("T")[0] || new Date().toISOString().split("T")[0])
                setDescription(transaction.description || "")
                setAmount(Math.abs(transaction.amount).toString())
                setCategoryId(transaction.category_id?.toString() || "")
                setAccountId(transaction.account_id?.toString() || "")
                setMerchant(transaction.merchant || "")
                setNotes(transaction.notes || "")
                setIsRecurring(transaction.is_recurring || false)
                setRecurrenceFrequency(transaction.recurrence_frequency || "monthly")
            } else {
                setType("expense")
                setDate(new Date().toISOString().split("T")[0])
                setDescription("")
                setAmount("")
                setCategoryId("")
                setAccountId("")
                setMerchant("")
                setNotes("")
                setIsRecurring(false)
                setRecurrenceFrequency("monthly")
            }
        }
    }, [open, transaction])

    // Filter categories based on type
    const filteredCategories = categories.filter(c =>
        type === "income" ? c.is_income : !c.is_income
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!description.trim() || !amount || !date) return

        setIsLoading(true)

        const amountValue = parseFloat(amount)
        const finalAmount = type === "income" ? Math.abs(amountValue) : -Math.abs(amountValue)

        const data = {
            date: new Date(date).toISOString(),
            description: description.trim(),
            amount: finalAmount,
            category_id: categoryId ? parseInt(categoryId) : undefined,
            account_id: accountId ? parseInt(accountId) : undefined,
            merchant: merchant.trim() || undefined,
            notes: notes.trim() || undefined,
            is_recurring: isRecurring,
            recurrence_frequency: isRecurring ? recurrenceFrequency : undefined,
        }

        let result
        if (isEditing && transaction) {
            result = await updateTransaction(transaction.id, data)
        } else {
            result = await createTransaction(data)
        }

        if (result) {
            onSaved()
            onOpenChange(false)
        }

        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? "Edit Transaction" : "Add Transaction"}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? "Update the transaction details below."
                                : "Enter the details of your transaction."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Type Toggle */}
                        <Tabs value={type} onValueChange={(v) => setType(v as "expense" | "income")}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="expense" className="text-destructive data-[state=active]:bg-destructive/10">
                                    Expense
                                </TabsTrigger>
                                <TabsTrigger value="income" className="text-success data-[state=active]:bg-success/10">
                                    Income
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* Date and Amount Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., Grocery shopping"
                                required
                            />
                        </div>

                        {/* Category and Account Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCategories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                                <span className="flex items-center gap-2">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: cat.color || "#64748b" }}
                                                    />
                                                    {cat.name}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="account">Account</Label>
                                <Select value={accountId} onValueChange={setAccountId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((acct) => (
                                            <SelectItem key={acct.id} value={acct.id.toString()}>
                                                {acct.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Merchant */}
                        <div className="grid gap-2">
                            <Label htmlFor="merchant">Merchant (optional)</Label>
                            <Input
                                id="merchant"
                                value={merchant}
                                onChange={(e) => setMerchant(e.target.value)}
                                placeholder="e.g., Whole Foods"
                            />
                        </div>

                        {/* Notes */}
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional details..."
                                rows={2}
                            />
                        </div>

                        {/* Recurring Toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="recurring" className="text-sm">
                                Recurring transaction
                            </Label>
                            <Switch
                                id="recurring"
                                checked={isRecurring}
                                onCheckedChange={setIsRecurring}
                            />
                        </div>

                        {/* Recurrence Frequency - shown when recurring is enabled */}
                        {isRecurring && (
                            <div className="grid gap-2">
                                <Label htmlFor="frequency">Frequency</Label>
                                <Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !description.trim() || !amount}>
                            {isLoading ? "Saving..." : isEditing ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
