"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { Progress } from "@/components/ui/progress"
import {
    Tag,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    RefreshCw,
} from "lucide-react"
import {
    BudgetCategory,
    BudgetSummary,
    fetchBudgetCategories,
    createBudgetCategory,
    updateBudgetCategory,
    deleteBudgetCategory,
} from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

const PRESET_COLORS = [
    "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4",
    "#ec4899", "#f97316", "#ef4444", "#6366f1", "#64748b",
]

interface CategoryManagerProps {
    summary?: BudgetSummary | null
}

export function CategoryManager({ summary }: CategoryManagerProps) {
    const { formatCurrency } = useSettings()
    const [categories, setCategories] = React.useState<BudgetCategory[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [editingCategory, setEditingCategory] = React.useState<BudgetCategory | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const [categoryToDelete, setCategoryToDelete] = React.useState<BudgetCategory | null>(null)

    // Form state
    const [name, setName] = React.useState("")
    const [color, setColor] = React.useState(PRESET_COLORS[0])
    const [budgetLimit, setBudgetLimit] = React.useState("")
    const [isIncome, setIsIncome] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const loadCategories = React.useCallback(async () => {
        setIsLoading(true)
        const data = await fetchBudgetCategories()
        setCategories(data)
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadCategories()
    }, [loadCategories])

    const handleOpenDialog = (category?: BudgetCategory) => {
        if (category) {
            setEditingCategory(category)
            setName(category.name)
            setColor(category.color || PRESET_COLORS[0])
            setBudgetLimit(category.budget_limit?.toString() || "")
            setIsIncome(category.is_income)
        } else {
            setEditingCategory(null)
            setName("")
            setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
            setBudgetLimit("")
            setIsIncome(false)
        }
        setDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setIsSaving(true)

        const data = {
            name: name.trim(),
            color,
            budget_limit: budgetLimit ? parseFloat(budgetLimit) : undefined,
            is_income: isIncome,
        }

        let result
        if (editingCategory) {
            result = await updateBudgetCategory(editingCategory.id, data)
        } else {
            result = await createBudgetCategory(data)
        }

        if (result) {
            await loadCategories()
            setDialogOpen(false)
        }

        setIsSaving(false)
    }

    const handleDeleteClick = (category: BudgetCategory) => {
        setCategoryToDelete(category)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return
        setIsDeleting(true)
        const success = await deleteBudgetCategory(categoryToDelete.id)
        if (success) {
            await loadCategories()
        }
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setCategoryToDelete(null)
    }

    // Get spending data from summary
    const getCategorySpending = (categoryId: number) => {
        if (!summary) return { spent: 0, percent: 0 }
        const catData = summary.by_category.find(c => c.category_id === categoryId)
        if (!catData) return { spent: 0, percent: 0 }
        return {
            spent: catData.expenses,
            percent: 0,
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Categories
                        </CardTitle>
                        <CardDescription>
                            Manage spending categories and budgets
                        </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No categories yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {categories.map((cat) => {
                                const spending = getCategorySpending(cat.id)
                                const budgetPercent = cat.budget_limit
                                    ? (spending.spent / cat.budget_limit) * 100
                                    : null

                                return (
                                    <div
                                        key={cat.id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className="w-4 h-4 rounded-full shrink-0"
                                                style={{ backgroundColor: cat.color || "#64748b" }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">{cat.name}</span>
                                                    {cat.is_income && (
                                                        <span className="text-xs text-success">Income</span>
                                                    )}
                                                </div>
                                                {cat.budget_limit && (
                                                    <div className="mt-1 space-y-1">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">
                                                                {formatCurrency(spending.spent)} of {formatCurrency(cat.budget_limit)}
                                                            </span>
                                                            <span className={
                                                                budgetPercent && budgetPercent > 100
                                                                    ? "text-destructive"
                                                                    : budgetPercent && budgetPercent > 80
                                                                    ? "text-yellow-600"
                                                                    : "text-muted-foreground"
                                                            }>
                                                                {budgetPercent?.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={Math.min(budgetPercent || 0, 100)}
                                                            className="h-1.5"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenDialog(cat)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteClick(cat)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>
                                {editingCategory ? "Edit Category" : "Add Category"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingCategory
                                    ? "Update the category details."
                                    : "Create a new spending category."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Groceries"
                                    required
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                                                color === c
                                                    ? "border-foreground scale-110"
                                                    : "border-transparent hover:scale-105"
                                            }`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="budget">Monthly Budget (optional)</Label>
                                <Input
                                    id="budget"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={budgetLimit}
                                    onChange={(e) => setBudgetLimit(e.target.value)}
                                    placeholder="e.g., 500"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="income" className="text-sm">
                                    Income category
                                </Label>
                                <Switch
                                    id="income"
                                    checked={isIncome}
                                    onCheckedChange={setIsIncome}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving || !name.trim()}>
                                {isSaving ? "Saving..." : editingCategory ? "Update" : "Add"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{categoryToDelete?.name}"?
                            Transactions in this category will become uncategorized.
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
