"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Calendar } from "lucide-react"
import { LoadingState } from "@/components/ui/loading-state"
import { BudgetSummary } from "@/components/budget/budget-summary"
import { TransactionForm } from "@/components/budget/transaction-form"
import { TransactionTable } from "@/components/budget/transaction-table"
import { CashFlowChart } from "@/components/budget/cash-flow-chart"
import { SpendingBreakdown } from "@/components/budget/spending-breakdown"
import { AIInsightsPanel } from "@/components/budget/ai-insights-panel"
import { SubscriptionList } from "@/components/budget/subscription-list"
import { CategoryManager } from "@/components/budget/category-manager"
import { BudgetForecast } from "@/components/budget/budget-forecast"
import { StatementUpload } from "@/components/budget/statement-upload"
import {
    Transaction,
    BudgetCategory,
    Account,
    BudgetSummary as BudgetSummaryType,
    CashFlowData,
    fetchTransactions,
    fetchBudgetCategories,
    fetchAccounts,
    fetchBudgetSummary,
    fetchCashFlow,
} from "@/lib/api"

type DateRange = "this-month" | "last-month" | "last-3-months" | "last-6-months" | "last-12-months" | "this-year"

export default function BudgetPage() {
    const [transactions, setTransactions] = React.useState<Transaction[]>([])
    const [categories, setCategories] = React.useState<BudgetCategory[]>([])
    const [accounts, setAccounts] = React.useState<Account[]>([])
    const [summary, setSummary] = React.useState<BudgetSummaryType | null>(null)
    const [cashFlowData, setCashFlowData] = React.useState<CashFlowData[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isTransactionsLoading, setIsTransactionsLoading] = React.useState(true)
    const [showAddTransaction, setShowAddTransaction] = React.useState(false)
    const [editingTransaction, setEditingTransaction] = React.useState<Transaction | undefined>()
    const [dateRange, setDateRange] = React.useState<DateRange>("this-month")

    const getDateRange = React.useCallback((range: DateRange) => {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        switch (range) {
            case "this-month":
                return {
                    start: startOfMonth.toISOString(),
                    end: now.toISOString(),
                }
            case "last-month":
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
                return {
                    start: lastMonth.toISOString(),
                    end: lastMonthEnd.toISOString(),
                }
            case "last-3-months":
                const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
                return {
                    start: threeMonthsAgo.toISOString(),
                    end: now.toISOString(),
                }
            case "last-6-months":
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
                return {
                    start: sixMonthsAgo.toISOString(),
                    end: now.toISOString(),
                }
            case "last-12-months":
                const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)
                return {
                    start: twelveMonthsAgo.toISOString(),
                    end: now.toISOString(),
                }
            case "this-year":
                const startOfYear = new Date(now.getFullYear(), 0, 1)
                return {
                    start: startOfYear.toISOString(),
                    end: now.toISOString(),
                }
            default:
                return {
                    start: startOfMonth.toISOString(),
                    end: now.toISOString(),
                }
        }
    }, [])

    const getCashFlowMonths = React.useCallback((range: DateRange): number => {
        switch (range) {
            case "this-month": return 1
            case "last-month": return 2
            case "last-3-months": return 3
            case "last-6-months": return 6
            case "last-12-months": return 12
            case "this-year": return new Date().getMonth() + 1
            default: return 6
        }
    }, [])

    const loadData = React.useCallback(async () => {
        setIsLoading(true)
        const { start, end } = getDateRange(dateRange)
        const cashFlowMonths = getCashFlowMonths(dateRange)

        const [cats, accts, sum, cashFlow] = await Promise.all([
            fetchBudgetCategories(),
            fetchAccounts(),
            fetchBudgetSummary({ start_date: start, end_date: end }),
            fetchCashFlow(cashFlowMonths),
        ])

        setCategories(cats)
        setAccounts(accts)
        setSummary(sum)
        setCashFlowData(cashFlow)
        setIsLoading(false)
    }, [dateRange, getDateRange, getCashFlowMonths])

    const loadTransactions = React.useCallback(async () => {
        setIsTransactionsLoading(true)
        const { start, end } = getDateRange(dateRange)
        const txns = await fetchTransactions({
            start_date: start,
            end_date: end,
            limit: 100,
        })
        setTransactions(txns)
        setIsTransactionsLoading(false)
    }, [dateRange, getDateRange])

    React.useEffect(() => {
        loadData()
        loadTransactions()
    }, [loadData, loadTransactions])

    const handleTransactionSaved = () => {
        loadTransactions()
        loadData()
    }

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction)
        setShowAddTransaction(true)
    }

    const handleCloseForm = (open: boolean) => {
        setShowAddTransaction(open)
        if (!open) {
            setEditingTransaction(undefined)
        }
    }

    const formatDateRangeLabel = (range: DateRange) => {
        switch (range) {
            case "this-month": return "This Month"
            case "last-month": return "Last Month"
            case "last-3-months": return "Last 3 Months"
            case "last-6-months": return "Last 6 Months"
            case "last-12-months": return "Last 12 Months"
            case "this-year": return "This Year"
            default: return "This Month"
        }
    }

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
                    <p className="text-muted-foreground">
                        Track your income, expenses, and spending patterns
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                        <SelectTrigger className="w-[160px]">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this-month">This Month</SelectItem>
                            <SelectItem value="last-month">Last Month</SelectItem>
                            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                            <SelectItem value="last-6-months">Last 6 Months</SelectItem>
                            <SelectItem value="last-12-months">Last 12 Months</SelectItem>
                            <SelectItem value="this-year">This Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setShowAddTransaction(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Transaction
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            {isLoading ? (
                <LoadingState message="Loading budget..." />
            ) : (
                <BudgetSummary
                    totalIncome={summary?.total_income || 0}
                    totalExpenses={summary?.total_expenses || 0}
                    transactionCount={summary?.transaction_count || 0}
                />
            )}

            {/* Main Content Tabs */}
            <Tabs defaultValue="transactions" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="forecast">Forecast</TabsTrigger>
                    <TabsTrigger value="insights">AI Insights</TabsTrigger>
                    <TabsTrigger value="manage">Manage</TabsTrigger>
                </TabsList>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-6">
                    <TransactionTable
                        transactions={transactions}
                        isLoading={isTransactionsLoading}
                        onEdit={handleEditTransaction}
                        onRefresh={handleTransactionSaved}
                    />
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <CashFlowChart data={cashFlowData} isLoading={isLoading} />
                        <SpendingBreakdown summary={summary} isLoading={isLoading} />
                    </div>
                </TabsContent>

                {/* Forecast Tab */}
                <TabsContent value="forecast" className="space-y-6">
                    <BudgetForecast />
                </TabsContent>

                {/* AI Insights Tab */}
                <TabsContent value="insights" className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <AIInsightsPanel onTransactionsUpdated={handleTransactionSaved} />
                        <SubscriptionList onRefreshTransactions={handleTransactionSaved} />
                    </div>
                </TabsContent>

                {/* Manage Tab */}
                <TabsContent value="manage" className="space-y-6">
                    {/* Statement Upload - Full Width */}
                    <StatementUpload
                        categories={categories}
                        onImportComplete={handleTransactionSaved}
                    />

                    {/* Category Manager and Subscriptions */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <CategoryManager summary={summary} />
                        <SubscriptionList onRefreshTransactions={handleTransactionSaved} />
                    </div>
                </TabsContent>
            </Tabs>

            {/* Transaction Form Dialog */}
            <TransactionForm
                open={showAddTransaction}
                onOpenChange={handleCloseForm}
                transaction={editingTransaction}
                categories={categories}
                accounts={accounts}
                onSaved={handleTransactionSaved}
            />
        </div>
    )
}
