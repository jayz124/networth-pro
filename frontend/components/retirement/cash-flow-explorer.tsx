"use client"

import { useState, useMemo } from "react"
import { ProjectionPoint } from "@/lib/retirement-logic"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { useSettings } from "@/lib/settings-context"

type CashFlowExplorerProps = {
    data: ProjectionPoint[]
    retirementAge: number
}

export function CashFlowExplorer({ data, retirementAge }: CashFlowExplorerProps) {
    const { formatCurrency } = useSettings()
    const [selectedAge, setSelectedAge] = useState(data[0]?.age || 35)

    const selectedPoint = useMemo(() => {
        return data.find(p => p.age === selectedAge) || data[0]
    }, [data, selectedAge])

    const minAge = data[0]?.age || 35
    const maxAge = data[data.length - 1]?.age || 85

    const isRetired = selectedAge >= retirementAge
    const phase = isRetired ? "Retirement (Drawdown)" : "Working (Accumulation)"

    // Calculate inflows and outflows for the selected age
    const inflows = [
        { label: "Employment Income", value: selectedPoint?.income || 0, show: !isRetired },
        { label: "Pension/SS", value: selectedPoint?.pensionIncome || 0, show: isRetired },
        { label: "Dividends", value: selectedPoint?.dividendIncome || 0, show: true },
        { label: "Rental Income", value: selectedPoint?.rentalIncome || 0, show: selectedPoint?.rentalIncome > 0 },
        { label: "Portfolio Drawdown", value: selectedPoint?.portfolioDrawdown || 0, show: isRetired },
    ].filter(item => item.show && item.value > 0)

    const outflows = [
        { label: "Living Expenses", value: selectedPoint?.spending || 0, show: true },
        { label: "Tax Paid", value: selectedPoint?.taxPaid || 0, show: true },
        { label: "Mortgage Payment", value: selectedPoint?.mortgagePayment || 0, show: selectedPoint?.mortgagePayment > 0 },
        { label: "Loan Payment", value: selectedPoint?.loanPayment || 0, show: selectedPoint?.loanPayment > 0 },
    ].filter(item => item.show && item.value > 0)

    const totalInflow = inflows.reduce((sum, item) => sum + item.value, 0)
    const totalOutflow = outflows.reduce((sum, item) => sum + item.value, 0)
    const netCashFlow = totalInflow - totalOutflow

    // Calculate savings for working years
    const savings = !isRetired ? (selectedPoint?.savings || 0) : 0

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Cash Flow Explorer</CardTitle>
                        <CardDescription className="text-xs">
                            Visualize income, expenses, and savings at any age (Real Terms)
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold">Age {selectedAge}</div>
                        <div className="text-xs text-muted-foreground">{phase}</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Age Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Age {minAge}</span>
                        <span>Age {maxAge}</span>
                    </div>
                    <div className="relative">
                        <Slider
                            value={[selectedAge]}
                            min={minAge}
                            max={maxAge}
                            step={1}
                            onValueChange={(vals) => setSelectedAge(vals[0])}
                            className="w-full"
                        />
                        {/* Retirement marker */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gain"
                            style={{ left: `${((retirementAge - minAge) / (maxAge - minAge)) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-center">
                        <span className="text-xs text-gain">Retirement at {retirementAge}</span>
                    </div>
                </div>

                {/* Cash Flow Visualization */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Inflows */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gain">Inflows</h4>
                        <div className="space-y-2">
                            {inflows.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-gain/10 rounded">
                                    <span className="text-sm">{item.label}</span>
                                    <span className="font-mono text-sm font-medium text-gain">
                                        +{formatCurrency(item.value)}
                                    </span>
                                </div>
                            ))}
                            {inflows.length === 0 && (
                                <div className="p-2 text-sm text-muted-foreground">No income sources</div>
                            )}
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gain/20 rounded font-semibold">
                            <span className="text-sm">Total Inflow</span>
                            <span className="font-mono text-sm text-gain">
                                {formatCurrency(totalInflow)}
                            </span>
                        </div>
                    </div>

                    {/* Outflows */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-loss">Outflows</h4>
                        <div className="space-y-2">
                            {outflows.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-loss/10 rounded">
                                    <span className="text-sm">{item.label}</span>
                                    <span className="font-mono text-sm font-medium text-loss">
                                        -{formatCurrency(item.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center p-2 bg-loss/20 rounded font-semibold">
                            <span className="text-sm">Total Outflow</span>
                            <span className="font-mono text-sm text-loss">
                                {formatCurrency(totalOutflow)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Inflow</p>
                        <p className="font-semibold text-gain">{formatCurrency(totalInflow)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Tax Paid</p>
                        <p className="font-semibold text-loss">{formatCurrency(selectedPoint?.taxPaid || 0)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Net Income</p>
                        <p className={`font-semibold ${netCashFlow >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatCurrency(netCashFlow)}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">{isRetired ? 'Shortfall' : 'Savings'}</p>
                        <p className={`font-semibold ${isRetired ? (selectedPoint?.shortfall > 0 ? 'text-loss' : 'text-gain') : 'text-info'}`}>
                            {isRetired
                                ? (selectedPoint?.shortfall > 0 ? formatCurrency(selectedPoint.shortfall) : '$0')
                                : formatCurrency(savings)
                            }
                        </p>
                    </div>
                </div>

                {/* Net Worth at this age */}
                <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium">Net Worth at Age {selectedAge}</p>
                            <p className="text-xs text-muted-foreground">
                                Liquid: {formatCurrency(selectedPoint?.liquidAssets || 0)} |
                                Real Estate: {formatCurrency(selectedPoint?.realEstateValue || 0)} |
                                Debt: {formatCurrency(selectedPoint?.totalLiabilities || 0)}
                            </p>
                        </div>
                        <div className={`text-2xl font-bold ${(selectedPoint?.netWorth || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatCurrency(selectedPoint?.netWorth || 0)}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
