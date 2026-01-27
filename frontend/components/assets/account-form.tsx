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
import { Account, createAccount, updateAccount } from "@/lib/api"

type AccountFormProps = {
    account?: Account
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}

const accountTypes = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'investment', label: 'Investment' },
    { value: 'cash', label: 'Cash' },
]

export function AccountForm({ account, open, onOpenChange, onSaved }: AccountFormProps) {
    const [isLoading, setIsLoading] = React.useState(false)
    const isEditing = !!account

    // Form state
    const [name, setName] = React.useState(account?.name || "")
    const [institution, setInstitution] = React.useState(account?.institution || "")
    const [type, setType] = React.useState(account?.type || "checking")
    const [currentBalance, setCurrentBalance] = React.useState(
        account?.current_balance?.toString() || ""
    )

    // Reset form when dialog opens/closes or account changes
    React.useEffect(() => {
        if (open) {
            setName(account?.name || "")
            setInstitution(account?.institution || "")
            setType(account?.type || "checking")
            setCurrentBalance(account?.current_balance?.toString() || "")
        }
    }, [open, account])

    const handleSubmit = async () => {
        if (!name || !type) return

        setIsLoading(true)

        if (isEditing && account) {
            const result = await updateAccount(account.id, {
                name,
                institution: institution || undefined,
                type,
            })
            if (result) {
                onOpenChange(false)
                onSaved()
            }
        } else {
            const result = await createAccount({
                name,
                institution: institution || undefined,
                type,
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
                    <DialogTitle>{isEditing ? 'Edit Account' : 'Add Account'}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the account details.'
                            : 'Add a new cash account to track your balance.'}
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
                            placeholder="e.g., Chase Checking"
                            className="col-span-3"
                        />
                    </div>

                    {/* Institution */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="institution" className="text-right">
                            Institution
                        </Label>
                        <Input
                            id="institution"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="e.g., Chase Bank"
                            className="col-span-3"
                        />
                    </div>

                    {/* Type */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <div className="col-span-3">
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accountTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Balance (only for new accounts) */}
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
                        {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Account"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
