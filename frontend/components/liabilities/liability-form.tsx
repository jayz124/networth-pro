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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Liability, createLiability, updateLiability } from "@/lib/api"

type LiabilityFormProps = {
    liability?: Liability
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}

const liabilityCategories = [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'auto_loan', label: 'Auto Loan' },
    { value: 'student_loan', label: 'Student Loan' },
    { value: 'personal_loan', label: 'Personal Loan' },
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'other', label: 'Other' },
]

export function LiabilityForm({ liability, open, onOpenChange, onSaved }: LiabilityFormProps) {
    const [isLoading, setIsLoading] = React.useState(false)
    const isEditing = !!liability

    // Form state
    const [name, setName] = React.useState(liability?.name || "")
    const [category, setCategory] = React.useState(liability?.category || "credit_card")
    const [currentBalance, setCurrentBalance] = React.useState(
        liability?.current_balance?.toString() || ""
    )

    // Reset form when dialog opens/closes or liability changes
    React.useEffect(() => {
        if (open) {
            setName(liability?.name || "")
            setCategory(liability?.category || "credit_card")
            setCurrentBalance(liability?.current_balance?.toString() || "")
        }
    }, [open, liability])

    const handleSubmit = async () => {
        if (!name || !category) return

        setIsLoading(true)

        if (isEditing && liability) {
            const result = await updateLiability(liability.id, {
                name,
                category,
            })
            if (result) {
                onOpenChange(false)
                onSaved()
            }
        } else {
            const result = await createLiability({
                name,
                category,
                current_balance: currentBalance ? parseFloat(currentBalance) : 0,
            })
            if (result) {
                onOpenChange(false)
                onSaved()
            }
        }

        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Liability' : 'Add Liability'}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the liability details.'
                            : 'Add a debt or liability to track your balance.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Name */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Chase Sapphire"
                            className="col-span-3"
                        />
                    </div>

                    {/* Category */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Category
                        </Label>
                        <div className="col-span-3">
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {liabilityCategories.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Balance (only for new liabilities) */}
                    {!isEditing && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="balance" className="text-right">
                                Balance
                            </Label>
                            <Input
                                id="balance"
                                type="number"
                                step="0.01"
                                value={currentBalance}
                                onChange={(e) => setCurrentBalance(e.target.value)}
                                placeholder="0.00"
                                className="col-span-3"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !name}>
                        {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Liability"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
