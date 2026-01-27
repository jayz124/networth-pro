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
                                ? <span className="text-red-500 font-semibold">Projected to run out of money at age {runOutAge}</span>
                                : <span className="text-emerald-500 font-semibold">Assets sustain through life expectancy</span>
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
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="age"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={(val) => `${val}`}
                            interval="preserveStartEnd"
                            minTickGap={30}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={formatCompactCurrency}
                            width={70}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                            formatter={(value: any, name?: string) => [formatCompactCurrency(value), name || '']}
                            labelFormatter={(label) => `Age ${label}`}
                        />
                        <Legend />
                        <ReferenceLine x={retirementAge} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Retirement", position: "top", fill: "#10b981", fontSize: 12 }} />

                        {viewMode === 'aggregated' ? (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="liabilities"
                                    stackId="1"
                                    stroke="#ef4444"
                                    fill="#ef4444"
                                    fillOpacity={0.3}
                                    name="Liabilities"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="realEstate"
                                    stackId="2"
                                    stroke="#8b5cf6"
                                    fill="#8b5cf6"
                                    fillOpacity={0.3}
                                    name="Real Estate"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="liquidAssets"
                                    stackId="2"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.3}
                                    name="Liquid Assets"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="netWorth"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={false}
                                    name="Net Worth"
                                />
                                {runOutAge && (
                                    <Area
                                        type="monotone"
                                        dataKey="shortfall"
                                        stroke="#dc2626"
                                        fill="#dc2626"
                                        fillOpacity={0.5}
                                        name="Shortfall"
                                    />
                                )}
                            </>
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="netWorth"
                                stroke="#0ea5e9"
                                strokeWidth={2}
                                dot={false}
                                name="Net Worth"
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
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatCompactCurrency} width={60} />
                        <Tooltip formatter={(value: any) => formatCompactCurrency(value)} labelFormatter={(label) => `Age ${label}`} />
                        <Legend />
                        <Area type="monotone" dataKey="primaryHome" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Primary Home" />
                        <Area type="monotone" dataKey="investmentProperty" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} name="Investment Property" />
                        <Area type="monotone" dataKey="otherAssets" stackId="1" stroke="#c084fc" fill="#c084fc" fillOpacity={0.6} name="Other Assets" />
                        <Area type="monotone" dataKey="taxable" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Taxable" />
                        <Area type="monotone" dataKey="deferred" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} name="Tax-Deferred" />
                        <Area type="monotone" dataKey="roth" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} name="Tax-Free (Roth)" />
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
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickFormatter={viewMode === 'values' ? formatCompactCurrency : (v) => `${v.toFixed(0)}%`}
                            width={60}
                        />
                        <Tooltip
                            formatter={(value: any) => viewMode === 'values' ? formatCompactCurrency(value) : `${value.toFixed(1)}%`}
                            labelFormatter={(label) => `Age ${label}`}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="stocks" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Stocks" />
                        <Area type="monotone" dataKey="bonds" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Bonds" />
                        <Area type="monotone" dataKey="cash" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.6} name="Cash" />
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
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatCompactCurrency} width={60} />
                        <Tooltip formatter={(value: any) => formatCompactCurrency(value)} labelFormatter={(label) => `Age ${label}`} />
                        <Legend />
                        <ReferenceLine x={retirementAge} stroke="#10b981" strokeDasharray="3 3" />
                        <Bar dataKey="savings" stackId="income" fill="#10b981" name="Savings (Inflow)" />
                        <Bar dataKey="pension" stackId="income" fill="#8b5cf6" name="Pension" />
                        <Bar dataKey="rental" stackId="income" fill="#f59e0b" name="Rental Income" />
                        <Bar dataKey="dividends" stackId="income" fill="#3b82f6" name="Dividends" />
                        <Bar dataKey="drawdown" stackId="income" fill="#06b6d4" name="Portfolio Drawdown" />
                        <Bar dataKey="tax" stackId="expense" fill="#ef4444" name="Tax Paid" />
                        <Bar dataKey="mortgage" stackId="expense" fill="#f97316" name="Mortgage Payment" />
                    </BarChart>
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
                <CardDescription className="text-xs">Annual breakdown of Interest (Cost) vs Principal (Equity)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatCompactCurrency} width={60} />
                        <Tooltip formatter={(value: any) => formatCompactCurrency(value)} labelFormatter={(label) => `Age ${label}`} />
                        <Legend />
                        <Bar dataKey="mortgageInterest" stackId="mortgage" fill="#ef4444" name="Mortgage Interest (Cost)" />
                        <Bar dataKey="mortgagePrincipal" stackId="mortgage" fill="#10b981" name="Mortgage Principal (Equity)" />
                        <Bar dataKey="loanInterest" stackId="loan" fill="#f97316" name="Loan Interest (Cost)" />
                        <Bar dataKey="loanPrincipal" stackId="loan" fill="#06b6d4" name="Loan Principal" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
