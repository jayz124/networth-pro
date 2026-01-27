"use client"

import * as React from "react"
import { Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountSummary } from "@/components/assets/account-summary"
import { AccountCard } from "@/components/assets/account-card"
import { AccountForm } from "@/components/assets/account-form"
import { Account, fetchAccounts } from "@/lib/api"

export default function AssetsPage() {
    const [accounts, setAccounts] = React.useState<Account[]>([])
    const [showAddDialog, setShowAddDialog] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)

    const loadAccounts = async () => {
        setIsLoading(true)
        const data = await fetchAccounts()
        setAccounts(data)
        setIsLoading(false)
    }

    React.useEffect(() => {
        loadAccounts()
    }, [])

    // Calculate summary metrics by type
    const metrics = React.useMemo(() => {
        const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0)
        const checkingBalance = accounts
            .filter(a => a.type.toLowerCase() === 'checking')
            .reduce((sum, a) => sum + a.current_balance, 0)
        const savingsBalance = accounts
            .filter(a => a.type.toLowerCase() === 'savings')
            .reduce((sum, a) => sum + a.current_balance, 0)
        const investmentBalance = accounts
            .filter(a => a.type.toLowerCase() === 'investment')
            .reduce((sum, a) => sum + a.current_balance, 0)

        return {
            totalBalance,
            checkingBalance,
            savingsBalance,
            investmentBalance,
            accountCount: accounts.length
        }
    }, [accounts])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Assets</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage your cash accounts and track balances</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Account
                </Button>
            </div>

            {/* Summary Cards */}
            <AccountSummary
                totalBalance={metrics.totalBalance}
                checkingBalance={metrics.checkingBalance}
                savingsBalance={metrics.savingsBalance}
                investmentBalance={metrics.investmentBalance}
                accountCount={metrics.accountCount}
            />

            {/* Accounts Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading accounts...</p>
                    </div>
                </div>
            ) : accounts.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    {accounts.map((account, index) => (
                        <div
                            key={account.id}
                            className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_forwards]"
                            style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                        >
                            <AccountCard
                                account={account}
                                onUpdate={loadAccounts}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
                        <Wallet className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold">No accounts yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Add your first cash account to start tracking your liquid assets
                    </p>
                    <Button variant="accent" className="mt-6 gap-2" onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4" />
                        Add Your First Account
                    </Button>
                </div>
            )}

            {/* Add Account Dialog */}
            <AccountForm
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSaved={loadAccounts}
            />
        </div>
    )
}
