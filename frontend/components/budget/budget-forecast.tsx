"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts"
import { TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { ForecastResponse, fetchBudgetForecast } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

export function BudgetForecast() {
    const { formatCurrency, formatCompactCurrency } = useSettings()
    const [forecastData, setForecastData] = React.useState<ForecastResponse | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [months, setMonths] = React.useState("6")

    const loadForecast = React.useCallback(async () => {
        setIsLoading(true)
        const data = await fetchBudgetForecast(parseInt(months))
        setForecastData(data)
        setIsLoading(false)
    }, [months])

    React.useEffect(() => {
        loadForecast()
    }, [loadForecast])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="h-[300px] flex items-center justify-center">
                            <div className="animate-pulse text-muted-foreground">Loading forecast...</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!forecastData || forecastData.forecast.length === 0) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Cash Flow Forecast
                        </CardTitle>
                        <CardDescription>
                            No recurring transactions found. Add recurring income and expenses to see your forecast.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            Mark transactions as recurring to generate forecasts.
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const forecast = forecastData.forecast
    const totalIncome = forecastData.total_projected_income
    const totalExpenses = forecastData.total_projected_expenses
    const totalNet = forecastData.total_projected_net

    // Prepare chart data
    const chartData = forecast.map((m) => ({
        month: m.month_name || m.month,
        income: m.income,
        expenses: m.expenses,
        net: m.net,
    }))

    // Get all recurring transactions for the display
    const allRecurring = forecast.flatMap((m) =>
        (m.transactions || []).map((t) => ({
            ...t,
            month: m.month,
        }))
    )

    // Deduplicate by description
    const uniqueRecurring = Array.from(
        new Map(allRecurring.map((t) => [t.description, t])).values()
    )

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projected Income</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(totalIncome)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Over next {months} months
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projected Expenses</CardTitle>
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(totalExpenses)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Over next {months} months
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projected Net</CardTitle>
                        {totalNet >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(totalNet)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Expected savings/deficit
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Forecast Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Cash Flow Forecast
                            </CardTitle>
                            <CardDescription>
                                Projected income and expenses based on {forecastData.recurring_count} recurring transactions and {forecastData.subscription_count} subscriptions
                            </CardDescription>
                        </div>
                        <Select value={months} onValueChange={setMonths}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3 Months</SelectItem>
                                <SelectItem value="6">6 Months</SelectItem>
                                <SelectItem value="12">12 Months</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    className="text-muted-foreground"
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    tickFormatter={formatCompactCurrency}
                                    className="text-muted-foreground"
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--background))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value, name) => [
                                        formatCurrency(typeof value === 'number' ? value : 0),
                                        typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : ''
                                    ]}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="income"
                                    stroke="#22c55e"
                                    fillOpacity={1}
                                    fill="url(#colorIncome)"
                                    name="Income"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="expenses"
                                    stroke="#ef4444"
                                    fillOpacity={1}
                                    fill="url(#colorExpenses)"
                                    name="Expenses"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Recurring Transactions List */}
            <Card>
                <CardHeader>
                    <CardTitle>Recurring Transactions</CardTitle>
                    <CardDescription>
                        {uniqueRecurring.length} recurring transactions included in forecast
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {uniqueRecurring.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No recurring transactions found. Mark transactions as recurring to see them here.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {uniqueRecurring.map((t, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between py-2 border-b last:border-0"
                                >
                                    <div className="flex items-center gap-3">
                                        {t.amount >= 0 ? (
                                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                                        )}
                                        <div>
                                            <p className="font-medium">{t.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t.category_name || "Uncategorized"} | {t.frequency}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`font-medium ${
                                            t.amount >= 0 ? "text-green-600" : "text-red-600"
                                        }`}
                                    >
                                        {formatCurrency(t.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
