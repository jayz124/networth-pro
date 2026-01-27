"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectionPoint } from "@/lib/retirement-logic"
import { MonitorPlay, Target, TrendingUp, Wallet } from "lucide-react"

type RetirementSummaryProps = {
    data: ProjectionPoint[];
    retirementAge: number;
    initialNetWorth: number;
}

export function RetirementSummary({ data, retirementAge, initialNetWorth }: RetirementSummaryProps) {

    // Calculate key metrics
    const retirementPoint = data.find(p => p.age === retirementAge);
    const endPoint = data[data.length - 1];

    const worthAtRetirement = retirementPoint ? retirementPoint.netWorth : 0;
    const endOfLifeWorth = endPoint ? endPoint.netWorth : 0;

    // Calculate Runway (Age when NW < 0)
    const runOutPoint = data.find(p => p.netWorth < 0);
    const runOutAge = runOutPoint ? runOutPoint.age : "90+";

    const formatCurrency = (val: number) => {
        if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
        return `$${Math.round(val / 1000)}k`
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Wealth at Retirement</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(worthAtRetirement)}</div>
                    <p className="text-xs text-muted-foreground">
                        Projected at age {retirementAge}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">End of Life Wealth</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${endOfLifeWorth < 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {formatCurrency(endOfLifeWorth)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Projected at age {endPoint?.age || 90}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Financial Runway</CardTitle>
                    <MonitorPlay className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${runOutAge !== "90+" ? "text-orange-500" : "text-emerald-500"}`}>
                        {runOutAge === "90+" ? "Lifetime" : `Age ${runOutAge}`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {runOutAge !== "90+" ? "Assets depleted early" : "Funds last forever"}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Growth Multiplier</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {initialNetWorth > 0 ? ((worthAtRetirement / initialNetWorth).toFixed(1)) + "x" : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Wealth growth by retirement
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
