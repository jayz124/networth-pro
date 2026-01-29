"use client"

import * as React from "react"
import {
    calculateProjection,
    DEFAULT_CONFIG,
    RetirementConfig,
    EssentialConfig,
    ESSENTIAL_DEFAULT_CONFIG,
    essentialToFullConfig,
    fullToEssentialConfig
} from "@/lib/retirement-logic"
import {
    runSimulation,
    configToSimulationInput,
    yearlyDataToProjectionPoints
} from "@/lib/retirement-pro"
import { ConfigSidebar } from "@/components/retirement/config-sidebar"
import { EssentialSidebar } from "@/components/retirement/essential-sidebar"
import { ModeToggle } from "@/components/retirement/mode-toggle"
import {
    RetirementChart,
    AssetBreakdownChart,
    AssetAllocationChart,
    IncomeCompositionChart,
    DebtServiceChart,
    TaxEfficiencyChart
} from "@/components/retirement/retirement-chart"
import { CashFlowSankey } from "@/components/retirement/cash-flow-sankey"
import { RetirementSummary } from "@/components/retirement/retirement-summary"
import { MonteCarloDialog } from "@/components/retirement/monte-carlo-dialog"
import { CashFlowExplorer } from "@/components/retirement/cash-flow-explorer"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { RetirementModeProvider, useRetirementMode, RetirementMode } from "@/lib/retirement-mode-context"
import { fetchAutoPopulateData, AutoPopulateData } from "@/lib/retirement-auto-populate"

// Inner component that uses the mode context
function RetirementPageContent() {
    const { mode, setMode, isLoaded: modeLoaded } = useRetirementMode()

    // State for configurations
    const [proConfig, setProConfig] = React.useState<RetirementConfig>(DEFAULT_CONFIG)
    const [essentialConfig, setEssentialConfig] = React.useState<EssentialConfig>(ESSENTIAL_DEFAULT_CONFIG)
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

    // Sync state
    const [isSyncing, setIsSyncing] = React.useState(false)
    const [syncedFields, setSyncedFields] = React.useState({
        investments: false,
        realEstate: false,
        debts: false,
    })

    // Track if we've done initial sync
    const [hasInitialSync, setHasInitialSync] = React.useState(false)

    // Calculate projection based on current mode
    const projectionConfig = React.useMemo(() => {
        if (mode === "essential") {
            return essentialToFullConfig(essentialConfig)
        }
        return proConfig
    }, [mode, essentialConfig, proConfig])

    // Use Pro engine for Pro mode, simple engine for Essential mode
    const projectionData = React.useMemo(() => {
        if (mode === "pro") {
            // Use the comprehensive Pro simulation engine
            try {
                const simulationInput = configToSimulationInput(projectionConfig)
                const result = runSimulation(simulationInput)
                return yearlyDataToProjectionPoints(result.yearlyData, projectionConfig)
            } catch (error) {
                console.error("Pro engine error, falling back to basic:", error)
                return calculateProjection(projectionConfig)
            }
        }
        // Use the simpler engine for Essential mode
        return calculateProjection(projectionConfig)
    }, [mode, projectionConfig])

    // Handle mode switching with config conversion
    const handleModeChange = React.useCallback((newMode: RetirementMode) => {
        if (newMode === mode) return

        if (newMode === "essential") {
            // Convert Pro config to Essential
            const converted = fullToEssentialConfig(proConfig)
            setEssentialConfig(converted)
        } else {
            // Convert Essential config to Pro
            const converted = essentialToFullConfig(essentialConfig)
            setProConfig(converted)
        }

        setMode(newMode)
    }, [mode, proConfig, essentialConfig, setMode])

    // Handle sync button click
    const handleSync = React.useCallback(async () => {
        setIsSyncing(true)
        try {
            const data = await fetchAutoPopulateData()

            // Update Essential config with synced data
            setEssentialConfig(prev => ({
                ...prev,
                totalStocks: data.totalStocks,
                totalBonds: data.totalBonds,
                totalCash: data.totalCash,
                otherInvestments: data.otherInvestments,
                primaryHomeValue: data.primaryHomeValue,
                totalMortgageBalance: data.totalMortgageBalance,
                mortgageInterestRate: data.mortgageInterestRate,
                otherDebts: data.otherDebts,
            }))

            // Update synced fields indicators
            setSyncedFields({
                investments: data.hasPortfolioData || data.hasAccountsData,
                realEstate: data.hasPropertiesData,
                debts: data.hasLiabilitiesData,
            })
        } catch (error) {
            console.error("Failed to sync data:", error)
        } finally {
            setIsSyncing(false)
        }
    }, [])

    // Auto-sync on first load in Essential mode
    React.useEffect(() => {
        if (modeLoaded && mode === "essential" && !hasInitialSync) {
            setHasInitialSync(true)
            handleSync()
        }
    }, [modeLoaded, mode, hasInitialSync, handleSync])

    // Don't render until mode is loaded from localStorage
    if (!modeLoaded) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar - Collapsible */}
            <div
                className={`
                    transition-all duration-300 ease-in-out shrink-0 border-r overflow-hidden
                    ${sidebarCollapsed ? 'w-0' : 'w-80 md:w-96'}
                `}
            >
                <div className="h-full overflow-y-auto w-80 md:w-96">
                    {/* Mode Toggle Header */}
                    <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                        <ModeToggle
                            mode={mode}
                            onModeChange={handleModeChange}
                            onSync={handleSync}
                            isSyncing={isSyncing}
                        />
                    </div>

                    {/* Conditional Sidebar Content */}
                    <div className="p-4 pt-0">
                        {mode === "essential" ? (
                            <EssentialSidebar
                                config={essentialConfig}
                                onChange={setEssentialConfig}
                                syncedFields={syncedFields}
                            />
                        ) : (
                            <ConfigSidebar
                                config={proConfig}
                                onChange={setProConfig}
                            />
                        )}
                    </div>
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
                            <p className="text-muted-foreground">
                                {mode === "essential"
                                    ? "Simplified planning with key inputs"
                                    : "Comprehensive planning with full control"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <MonteCarloDialog config={projectionConfig} />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <RetirementSummary data={projectionData} config={projectionConfig} />

                    {/* Main Net Worth Projection Chart */}
                    <RetirementChart
                        data={projectionData}
                        retirementAge={projectionConfig.retirementAge}
                    />

                    {/* Asset Charts Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <AssetBreakdownChart data={projectionData} />
                        <AssetAllocationChart data={projectionData} />
                    </div>

                    {/* Income Composition Chart */}
                    <IncomeCompositionChart
                        data={projectionData}
                        retirementAge={projectionConfig.retirementAge}
                    />

                    {/* Pro Mode Only: Tax Efficiency Chart */}
                    {mode === "pro" && (
                        <TaxEfficiencyChart
                            data={projectionData}
                            retirementAge={projectionConfig.retirementAge}
                        />
                    )}

                    {/* Debt Service Analysis (only shown if there's debt) */}
                    <DebtServiceChart data={projectionData} />

                    {/* Pro Mode Only: Cash Flow Sankey Diagram */}
                    {mode === "pro" && (
                        <CashFlowSankey
                            data={projectionData}
                            retirementAge={projectionConfig.retirementAge}
                        />
                    )}

                    {/* Cash Flow Explorer */}
                    <CashFlowExplorer
                        data={projectionData}
                        retirementAge={projectionConfig.retirementAge}
                    />
                </div>
            </div>
        </div>
    )
}

// Main page component with provider wrapper
export default function RetirementPage() {
    return (
        <RetirementModeProvider>
            <RetirementPageContent />
        </RetirementModeProvider>
    )
}
