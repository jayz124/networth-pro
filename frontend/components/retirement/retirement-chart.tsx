"use client"

import { ProjectionPoint } from "@/lib/retirement-logic"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Bar, BarChart, ComposedChart, Line } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useSettings } from "@/lib/settings-context"

type RetirementChartProps = {
    data: ProjectionPoint[]
    retirementAge: number
}

// Custom tooltip component for dark mode support
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
            <p className="text-sm font-semibold text-foreground mb-2">Age {label}</p>
            <div className="space-y-1.5">
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="text-xs font-medium font-mono text-foreground">
                            {formatter ? formatter(entry.value) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Custom legend component for better styling
const CustomLegend = ({ payload }: any) => {
    if (!payload) return null

    return (
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 px-4">
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    )
}

export function RetirementChart({ data, retirementAge }: RetirementChartProps) {
    const { formatCompactCurrency } = useSettings()
    const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated')

    // Check if run out of money
    const runOutPoint = data.find(p => p.netWorth < 0);
    const runOutAge = runOutPoint ? runOutPoint.age : null;

    // Prepare chart data
    const chartData = data.map(point => ({
        age: point.age,
        netWorth: point.netWorth,
        liquidAssets: point.liquidAssets,
        realEstate: point.realEstateValue,
        liabilities: -point.totalLiabilities, // Negative for visualization
        shortfall: point.shortfall > 0 ? -point.shortfall : 0,
    }))

    return (
        <Card className="h-[500px] flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Net Worth Projection</CardTitle>
                        <CardDescription>
                            {runOutAge
                                ? <span className="text-destructive font-semibold">Projected to run out of money at age {runOutAge}</span>
                                : <span className="text-success font-semibold">Assets sustain through life expectancy</span>
                            }
                        </CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant={viewMode === 'aggregated' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('aggregated')}
                        >
                            Aggregated
                        </Button>
                        <Button
                            variant={viewMode === 'detailed' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('detailed')}
                        >
                            Detailed
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 30, right: 30, left: 0, bottom: 10 }}
                    >
                        <defs>
                            <linearGradient id="liabilitiesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="realEstateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="liquidAssetsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis
                            dataKey="age"
                            tickLine={false}
                            axisLine={false}
                            className="text-xs"
                            tick={{ className: "fill-muted-foreground" }}
                            tickFormatter={(val) => `${val}`}
                            interval="preserveStartEnd"
                            minTickGap={30}
                            dy={8}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            className="text-xs"
                            tick={{ className: "fill-muted-foreground" }}
                            tickFormatter={formatCompactCurrency}
                            width={80}
                            dx={-5}
                        />
                        <Tooltip
                            content={<CustomTooltip formatter={formatCompactCurrency} />}
                            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Legend content={<CustomLegend />} />
                        <ReferenceLine
                            x={retirementAge}
                            stroke="#10b981"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{
                                value: "Retire",
                                position: "insideTopRight",
                                fill: "#10b981",
                                fontSize: 11,
                                fontWeight: 600,
                                dy: -15
                            }}
                        />

                        {viewMode === 'aggregated' ? (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="liabilities"
                                    stackId="1"
                                    stroke="#ef4444"
                                    strokeWidth={1.5}
                                    fill="url(#liabilitiesGradient)"
                                    name="Liabilities"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="realEstate"
                                    stackId="2"
                                    stroke="#8b5cf6"
                                    strokeWidth={1.5}
                                    fill="url(#realEstateGradient)"
                                    name="Real Estate"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="liquidAssets"
                                    stackId="2"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    fill="url(#liquidAssetsGradient)"
                                    name="Liquid Assets"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="netWorth"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={false}
                                    name="Net Worth"
                                    style={{ filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.4))' }}
                                />
                                {runOutAge && (
                                    <Area
                                        type="monotone"
                                        dataKey="shortfall"
                                        stroke="#dc2626"
                                        fill="#dc2626"
                                        fillOpacity={0.4}
                                        name="Shortfall"
                                    />
                                )}
                            </>
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="netWorth"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={false}
                                name="Net Worth"
                                style={{ filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.4))' }}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// Asset Breakdown by Type Chart
export function AssetBreakdownChart({ data }: { data: ProjectionPoint[] }) {
    const { formatCompactCurrency } = useSettings()
    const chartData = data.map(point => ({
        age: point.age,
        primaryHome: point.primaryHomeValue,
        investmentProperty: point.investmentPropertyValue,
        otherAssets: point.otherAssetsValue,
        taxable: point.taxableStocks + point.taxableBonds + point.taxableCash,
        deferred: point.deferredStocks + point.deferredBonds + point.deferredCash,
        roth: point.rothStocks + point.rothBonds + point.rothCash,
    }))

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Asset Breakdown by Type</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} dy={8} />
                        <YAxis tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} tickFormatter={formatCompactCurrency} width={70} dx={-5} />
                        <Tooltip content={<CustomTooltip formatter={formatCompactCurrency} />} />
                        <Legend content={<CustomLegend />} />
                        <Area type="monotone" dataKey="primaryHome" stackId="1" stroke="#8b5cf6" strokeWidth={1.5} fill="#8b5cf6" fillOpacity={0.5} name="Primary Home" />
                        <Area type="monotone" dataKey="investmentProperty" stackId="1" stroke="#a855f7" strokeWidth={1.5} fill="#a855f7" fillOpacity={0.5} name="Investment Property" />
                        <Area type="monotone" dataKey="otherAssets" stackId="1" stroke="#c084fc" strokeWidth={1.5} fill="#c084fc" fillOpacity={0.5} name="Other Assets" />
                        <Area type="monotone" dataKey="taxable" stackId="1" stroke="#3b82f6" strokeWidth={1.5} fill="#3b82f6" fillOpacity={0.5} name="Taxable" />
                        <Area type="monotone" dataKey="deferred" stackId="1" stroke="#0ea5e9" strokeWidth={1.5} fill="#0ea5e9" fillOpacity={0.5} name="Tax-Deferred" />
                        <Area type="monotone" dataKey="roth" stackId="1" stroke="#06b6d4" strokeWidth={1.5} fill="#06b6d4" fillOpacity={0.5} name="Roth" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// Asset Allocation Over Time (Stocks/Bonds/Cash)
export function AssetAllocationChart({ data }: { data: ProjectionPoint[] }) {
    const { formatCompactCurrency } = useSettings()
    const [viewMode, setViewMode] = useState<'values' | 'percentage'>('values')

    const chartData = data.map(point => {
        const totalStocks = point.taxableStocks + point.deferredStocks + point.rothStocks
        const totalBonds = point.taxableBonds + point.deferredBonds + point.rothBonds
        const totalCash = point.taxableCash + point.deferredCash + point.rothCash
        const total = totalStocks + totalBonds + totalCash

        return {
            age: point.age,
            stocks: viewMode === 'values' ? totalStocks : total > 0 ? (totalStocks / total) * 100 : 0,
            bonds: viewMode === 'values' ? totalBonds : total > 0 ? (totalBonds / total) * 100 : 0,
            cash: viewMode === 'values' ? totalCash : total > 0 ? (totalCash / total) * 100 : 0,
        }
    })

    const formatValue = (value: number) => viewMode === 'values' ? formatCompactCurrency(value) : `${value.toFixed(1)}%`

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Asset Allocation Over Time</CardTitle>
                    <div className="flex gap-1">
                        <Button variant={viewMode === 'values' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('values')}>
                            Values
                        </Button>
                        <Button variant={viewMode === 'percentage' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('percentage')}>
                            Percentage
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} dy={8} />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ className: "fill-muted-foreground text-[11px]" }}
                            tickFormatter={viewMode === 'values' ? formatCompactCurrency : (v) => `${v.toFixed(0)}%`}
                            width={70}
                            dx={-5}
                        />
                        <Tooltip content={<CustomTooltip formatter={formatValue} />} />
                        <Legend content={<CustomLegend />} />
                        <Area type="monotone" dataKey="stocks" stackId="1" stroke="#10b981" strokeWidth={1.5} fill="#10b981" fillOpacity={0.5} name="Stocks" />
                        <Area type="monotone" dataKey="bonds" stackId="1" stroke="#3b82f6" strokeWidth={1.5} fill="#3b82f6" fillOpacity={0.5} name="Bonds" />
                        <Area type="monotone" dataKey="cash" stackId="1" stroke="#94a3b8" strokeWidth={1.5} fill="#94a3b8" fillOpacity={0.5} name="Cash" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// Income Composition Chart
export function IncomeCompositionChart({ data, retirementAge }: { data: ProjectionPoint[], retirementAge: number }) {
    const { formatCompactCurrency } = useSettings()
    const chartData = data.map(point => ({
        age: point.age,
        savings: point.savings > 0 ? point.savings : 0,
        pension: point.pensionIncome,
        rental: point.rentalIncome,
        dividends: point.dividendIncome,
        drawdown: point.portfolioDrawdown,
        tax: -point.taxPaid,
        mortgage: -point.mortgagePayment,
        loanPayment: -point.loanPayment,
        netSpendable: point.netSpendable,
    }))

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Income Composition</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} dy={8} />
                        <YAxis tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} tickFormatter={formatCompactCurrency} width={70} dx={-5} />
                        <Tooltip content={<CustomTooltip formatter={formatCompactCurrency} />} />
                        <Legend content={<CustomLegend />} />
                        <ReferenceLine x={retirementAge} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} />
                        <Bar dataKey="savings" stackId="income" fill="#10b981" radius={[2, 2, 0, 0]} name="Savings" />
                        <Bar dataKey="pension" stackId="income" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="Pension" />
                        <Bar dataKey="rental" stackId="income" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Rental" />
                        <Bar dataKey="dividends" stackId="income" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Dividends" />
                        <Bar dataKey="drawdown" stackId="income" fill="#06b6d4" radius={[2, 2, 0, 0]} name="Drawdown" />
                        <Bar dataKey="tax" stackId="expense" fill="#ef4444" radius={[0, 0, 2, 2]} name="Tax" />
                        <Bar dataKey="mortgage" stackId="expense" fill="#f97316" radius={[0, 0, 2, 2]} name="Mortgage" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// Tax Efficiency Chart (Pro Mode)
export function TaxEfficiencyChart({ data, retirementAge }: { data: ProjectionPoint[], retirementAge: number }) {
    const { formatCompactCurrency } = useSettings()

    // Filter out year 0 (initial state with no flows)
    const chartData = data.filter(p => p.age > data[0]?.age).map(point => {
        const totalCashFlow = (point.income || 0) + (point.pensionIncome || 0) + (point.rentalIncome || 0) +
            (point.dividendIncome || 0) + (point.portfolioDrawdown || 0)
        const tax = point.taxPaid || 0
        const netCashFlow = totalCashFlow - tax

        return {
            age: point.age,
            grossIncome: totalCashFlow,
            tax: tax,
            netIncome: netCashFlow,
            effectiveRate: totalCashFlow > 0 ? (tax / totalCashFlow) * 100 : 0,
            isRetired: point.isRetired,
        }
    })

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Tax Efficiency by Year</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Gross income, taxes paid, and post-tax cash flow
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <defs>
                            <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="grossIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} dy={8} />
                        <YAxis tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} tickFormatter={formatCompactCurrency} width={70} dx={-5} />
                        <Tooltip content={<CustomTooltip formatter={formatCompactCurrency} />} />
                        <Legend content={<CustomLegend />} />
                        <ReferenceLine x={retirementAge} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} />

                        {/* Gross Income (Base) */}
                        <Area
                            type="monotone"
                            dataKey="grossIncome"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#grossIncomeGradient)"
                            name="Gross Income"
                        />

                        {/* Tax Paid */}
                        <Area
                            type="monotone"
                            dataKey="tax"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="url(#taxGradient)"
                            name="Tax Paid"
                        />

                        {/* Net Income (Post-Tax) - Dashed line */}
                        <Line
                            type="monotone"
                            dataKey="netIncome"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Net Income"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

// Debt Service Analysis Chart
export function DebtServiceChart({ data }: { data: ProjectionPoint[] }) {
    const { formatCompactCurrency } = useSettings()
    const chartData = data.filter(p => p.mortgagePayment > 0 || p.loanPayment > 0).map(point => ({
        age: point.age,
        mortgageInterest: point.mortgageInterest,
        mortgagePrincipal: point.mortgagePrincipal,
        loanInterest: point.loanInterest,
        loanPrincipal: point.loanPrincipal,
    }))

    if (chartData.length === 0) {
        return null
    }

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Debt Service Analysis</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Annual breakdown of Interest (Cost) vs Principal (Equity)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} dy={8} />
                        <YAxis tickLine={false} axisLine={false} tick={{ className: "fill-muted-foreground text-[11px]" }} tickFormatter={formatCompactCurrency} width={70} dx={-5} />
                        <Tooltip content={<CustomTooltip formatter={formatCompactCurrency} />} />
                        <Legend content={<CustomLegend />} />
                        <Bar dataKey="mortgageInterest" stackId="mortgage" fill="#ef4444" radius={[2, 2, 0, 0]} name="Mortgage Interest" />
                        <Bar dataKey="mortgagePrincipal" stackId="mortgage" fill="#10b981" radius={[2, 2, 0, 0]} name="Mortgage Principal" />
                        <Bar dataKey="loanInterest" stackId="loan" fill="#f97316" radius={[2, 2, 0, 0]} name="Loan Interest" />
                        <Bar dataKey="loanPrincipal" stackId="loan" fill="#06b6d4" radius={[2, 2, 0, 0]} name="Loan Principal" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
