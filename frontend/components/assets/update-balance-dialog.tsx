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
import { Account, updateAccountBalance } from "@/lib/api"

type UpdateBalanceDialogProps = {
    account: Account
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}

export function UpdateBalanceDialog({ account, open, onOpenChange, onSaved }: UpdateBalanceDialogProps) {
    const [isLoading, setIsLoading] = React.useState(false)
    const [balance, setBalance] = React.useState(account.current_balance.toString())

    React.useEffect(() => {
        if (open) {
            setBalance(account.current_balance.toString())
        }
    }, [open, account.current_balance])

    const handleSubmit = async () => {
        if (!balance) return

        setIsLoading(true)
        const result = await updateAccountBalance(account.id, parseFloat(balance))
        setIsLoading(false)

        if (result) {
            onOpenChange(false)
            onSaved()
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    const newBalance = parseFloat(balance) || 0
    const difference = newBalance - account.current_balance

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Update Balance</DialogTitle>
                    <DialogDescription>
                        Record the current balance for {account.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Current Balance Display */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Previous Balance</span>
                        <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(account.current_balance)}
                        </span>
                    </div>

                    {/* New Balance Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="balance" className="text-right">
                            New Balance
                        </Label>
                        <Input
                            id="balance"
                            type="number"
                            step="0.01"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="0.00"
                            className="col-span-3"
                            autoFocus
                        />
                    </div>

                    {/* Change Preview */}
                    {difference !== 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <span className="text-sm text-muted-foreground">Change</span>
                            <span className={`text-sm font-semibold tabular-nums ${difference > 0 ? 'text-gain' : 'text-loss'}`}>
                                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                            </span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !balance}>
                        {isLoading ? "Updating..." : "Update Balance"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
