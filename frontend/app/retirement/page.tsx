"use client"

import * as React from "react"
import { calculateProjection, DEFAULT_CONFIG, RetirementConfig } from "@/lib/retirement-logic"
import { ConfigSidebar } from "@/components/retirement/config-sidebar"
import {
    RetirementChart,
    AssetBreakdownChart,
    AssetAllocationChart,
    IncomeCompositionChart,
    DebtServiceChart
} from "@/components/retirement/retirement-chart"
import { RetirementSummary } from "@/components/retirement/retirement-summary"
import { MonteCarloDialog } from "@/components/retirement/monte-carlo-dialog"
import { CashFlowExplorer } from "@/components/retirement/cash-flow-explorer"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function RetirementPage() {
    // State for configuration
    const [config, setConfig] = React.useState<RetirementConfig>(DEFAULT_CONFIG)
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

    // Calculate projection whenever config changes
    const projectionData = React.useMemo(() => {
        return calculateProjection(config)
    }, [config])

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar - Collapsible */}
            <div
                className={`
                    transition-all duration-300 ease-in-out shrink-0 border-r overflow-hidden
                    ${sidebarCollapsed ? 'w-0' : 'w-80 md:w-96'}
                `}
            >
                <div className="h-full overflow-y-auto p-4 w-80 md:w-96">
                    <ConfigSidebar config={config} onChange={setConfig} />
                </div>
            </div>

            {/* Toggle Button - in its own non-collapsing container */}
            <div className="shrink-0 flex items-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-6 rounded-l-none border border-l-0 bg-background -ml-px"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                    {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Retirement Planner</h1>
                            <p className="text-muted-foreground">Visualize your path to financial freedom.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <MonteCarloDialog config={config} />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <RetirementSummary data={projectionData} config={config} />

                    {/* Main Net Worth Projection Chart */}
                    <RetirementChart
                        data={projectionData}
                        retirementAge={config.retirementAge}
                    />

                    {/* Asset Charts Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <AssetBreakdownChart data={projectionData} />
                        <AssetAllocationChart data={projectionData} />
                    </div>

                    {/* Income Composition Chart */}
                    <IncomeCompositionChart
                        data={projectionData}
                        retirementAge={config.retirementAge}
                    />

                    {/* Debt Service Analysis (only shown if there's debt) */}
                    <DebtServiceChart data={projectionData} />

                    {/* Cash Flow Explorer */}
                    <CashFlowExplorer
                        data={projectionData}
                        retirementAge={config.retirementAge}
                    />
                </div>
            </div>
        </div>
    )
}
