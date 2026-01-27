"use client"

import * as React from "react"
import { Plus, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiabilitySummary } from "@/components/liabilities/liability-summary"
import { LiabilityCard } from "@/components/liabilities/liability-card"
import { LiabilityForm } from "@/components/liabilities/liability-form"
import { Liability, fetchLiabilities } from "@/lib/api"

export default function LiabilitiesPage() {
    const [liabilities, setLiabilities] = React.useState<Liability[]>([])
    const [showAddDialog, setShowAddDialog] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)

    const loadLiabilities = async () => {
        setIsLoading(true)
        const data = await fetchLiabilities()
        setLiabilities(data)
        setIsLoading(false)
    }

    React.useEffect(() => {
        loadLiabilities()
    }, [])

    // Calculate summary metrics by category
    const metrics = React.useMemo(() => {
        const totalDebt = liabilities.reduce((sum, l) => sum + l.current_balance, 0)
        const creditCardDebt = liabilities
            .filter(l => l.category?.toLowerCase() === 'credit_card')
            .reduce((sum, l) => sum + l.current_balance, 0)
        const loansDebt = liabilities
            .filter(l => ['auto_loan', 'student_loan', 'personal_loan'].includes(l.category?.toLowerCase() || ''))
            .reduce((sum, l) => sum + l.current_balance, 0)
        const otherDebt = liabilities
            .filter(l => !['credit_card', 'auto_loan', 'student_loan', 'personal_loan'].includes(l.category?.toLowerCase() || ''))
            .reduce((sum, l) => sum + l.current_balance, 0)

        return {
            totalDebt,
            creditCardDebt,
            loansDebt,
            otherDebt,
            liabilityCount: liabilities.length
        }
    }, [liabilities])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Liabilities</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track your debts and pay them down</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Liability
                </Button>
            </div>

            {/* Summary Cards */}
            <LiabilitySummary
                totalDebt={metrics.totalDebt}
                creditCardDebt={metrics.creditCardDebt}
                loansDebt={metrics.loansDebt}
                otherDebt={metrics.otherDebt}
                liabilityCount={metrics.liabilityCount}
            />

            {/* Liabilities Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading liabilities...</p>
                    </div>
                </div>
            ) : liabilities.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    {liabilities.map((liability, index) => (
                        <div
                            key={liability.id}
                            className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_forwards]"
                            style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                        >
                            <LiabilityCard
                                liability={liability}
                                onUpdate={loadLiabilities}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
                        <CreditCard className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold">No liabilities yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Add your debts to track balances and watch your progress as you pay them down
                    </p>
                    <Button variant="accent" className="mt-6 gap-2" onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4" />
                        Add Your First Liability
                    </Button>
                </div>
            )}

            {/* Add Liability Dialog */}
            <LiabilityForm
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSaved={loadLiabilities}
            />
        </div>
    )
}
