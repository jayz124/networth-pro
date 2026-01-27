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
import { addMortgage } from "@/lib/api"

type MortgageFormProps = {
    propertyId: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}

export function MortgageForm({ propertyId, open, onOpenChange, onSaved }: MortgageFormProps) {
    const [isLoading, setIsLoading] = React.useState(false)

    const [lender, setLender] = React.useState("")
    const [originalPrincipal, setOriginalPrincipal] = React.useState("")
    const [currentBalance, setCurrentBalance] = React.useState("")
    const [interestRate, setInterestRate] = React.useState("")
    const [monthlyPayment, setMonthlyPayment] = React.useState("")
    const [termYears, setTermYears] = React.useState("30")

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            setLender("")
            setOriginalPrincipal("")
            setCurrentBalance("")
            setInterestRate("")
            setMonthlyPayment("")
            setTermYears("30")
        }
    }, [open])

    const handleSubmit = async () => {
        if (!originalPrincipal || !currentBalance || !interestRate || !monthlyPayment) return

        setIsLoading(true)

        const result = await addMortgage(propertyId, {
            lender: lender || undefined,
            original_principal: parseFloat(originalPrincipal),
            current_balance: parseFloat(currentBalance),
            interest_rate: parseFloat(interestRate),
            monthly_payment: parseFloat(monthlyPayment),
            term_years: parseInt(termYears),
        })

        setIsLoading(false)

        if (result) {
            onOpenChange(false)
            onSaved()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Mortgage</DialogTitle>
                    <DialogDescription>
                        Add a mortgage to this property to track your equity.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="lender" className="text-right">
                            Lender
                        </Label>
                        <Input
                            id="lender"
                            placeholder="Bank of America (optional)"
                            value={lender}
                            onChange={(e) => setLender(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="original-principal" className="text-right">
                            Original Loan
                        </Label>
                        <Input
                            id="original-principal"
                            type="number"
                            step="any"
                            placeholder="400000"
                            value={originalPrincipal}
                            onChange={(e) => setOriginalPrincipal(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="current-balance" className="text-right">
                            Current Balance
                        </Label>
                        <Input
                            id="current-balance"
                            type="number"
                            step="any"
                            placeholder="350000"
                            value={currentBalance}
                            onChange={(e) => setCurrentBalance(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="interest-rate" className="text-right">
                            Interest Rate %
                        </Label>
                        <Input
                            id="interest-rate"
                            type="number"
                            step="0.01"
                            placeholder="6.5"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="monthly-payment" className="text-right">
                            Monthly Payment
                        </Label>
                        <Input
                            id="monthly-payment"
                            type="number"
                            step="any"
                            placeholder="2500"
                            value={monthlyPayment}
                            onChange={(e) => setMonthlyPayment(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="term-years" className="text-right">
                            Term (Years)
                        </Label>
                        <Input
                            id="term-years"
                            type="number"
                            placeholder="30"
                            value={termYears}
                            onChange={(e) => setTermYears(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !originalPrincipal || !currentBalance || !interestRate || !monthlyPayment}
                    >
                        {isLoading ? "Adding..." : "Add Mortgage"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
