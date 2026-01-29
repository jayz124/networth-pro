"use client"

import { useMemo, useState } from "react"
import { ResponsiveSankey } from "@nivo/sankey"
import { ProjectionPoint } from "@/lib/retirement-logic"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSettings } from "@/lib/settings-context"

interface CashFlowSankeyProps {
    data: ProjectionPoint[]
    retirementAge: number
}

interface SankeyNode {
    id: string
    nodeColor?: string
}

interface SankeyLink {
    source: string
    target: string
    value: number
}

interface SankeyData {
    nodes: SankeyNode[]
    links: SankeyLink[]
}

// Color palette for different flow types
const COLORS = {
    employment: "#10b981",    // Green
    dividends: "#3b82f6",     // Blue
    pension: "#8b5cf6",       // Purple
    rental: "#f59e0b",        // Amber
    drawdown: "#06b6d4",      // Cyan
    incomePool: "#6366f1",    // Indigo
    taxes: "#ef4444",         // Red
    expenses: "#64748b",      // Slate
    mortgage: "#f97316",      // Orange
    margin: "#eab308",        // Yellow
    savings: "#22c55e",       // Emerald
    deficit: "#dc2626",       // Red-600
}

export function CashFlowSankey({ data, retirementAge }: CashFlowSankeyProps) {
    const { formatCurrency } = useSettings()

    // Find the first retirement year index as default
    const defaultAgeIndex = useMemo(() => {
        const retireIndex = data.findIndex(d => d.age === retirementAge)
        return retireIndex >= 0 ? retireIndex : Math.floor(data.length / 2)
    }, [data, retirementAge])

    const [selectedAgeIndex, setSelectedAgeIndex] = useState(defaultAgeIndex)

    // Get data for selected age
    const yearData = data[selectedAgeIndex]

    // Transform to Sankey data
    const sankeyData = useMemo<SankeyData>(() => {
        if (!yearData) return { nodes: [], links: [] }

        const nodes: SankeyNode[] = []
        const links: SankeyLink[] = []

        // Helper to add unique node
        const addNode = (id: string, color?: string) => {
            if (!nodes.find(n => n.id === id)) {
                nodes.push({ id, nodeColor: color })
            }
        }

        // Income sources
        const employment = yearData.income || 0
        const dividends = yearData.dividendIncome || 0
        const rental = yearData.rentalIncome || 0
        const pension = yearData.pensionIncome || 0
        const drawdown = yearData.portfolioDrawdown || 0

        // Outflows
        const tax = yearData.taxPaid || 0
        const expenses = yearData.spending || 0
        const mortgage = yearData.mortgagePayment || 0
        const margin = yearData.loanPayment || 0
        const savings = yearData.savings || 0

        // Total calculations
        const totalIn = employment + dividends + rental + pension + drawdown
        const totalOut = tax + expenses + mortgage + margin + (savings > 0 ? savings : 0)

        // Central node
        addNode("Income Pool", COLORS.incomePool)

        // Add income source nodes and links
        if (employment > 100) {
            addNode("Employment", COLORS.employment)
            links.push({ source: "Employment", target: "Income Pool", value: employment })
        }
        if (dividends > 100) {
            addNode("Dividends", COLORS.dividends)
            links.push({ source: "Dividends", target: "Income Pool", value: dividends })
        }
        if (rental > 100) {
            addNode("Rental Income", COLORS.rental)
            links.push({ source: "Rental Income", target: "Income Pool", value: rental })
        }
        if (pension > 100) {
            addNode("Pension", COLORS.pension)
            links.push({ source: "Pension", target: "Income Pool", value: pension })
        }
        if (drawdown > 100) {
            addNode("Portfolio Drawdown", COLORS.drawdown)
            links.push({ source: "Portfolio Drawdown", target: "Income Pool", value: drawdown })
        }

        // Gap handling (if total in < total out)
        const gap = totalIn - totalOut
        if (gap < -100) {
            addNode("Unfunded Gap", COLORS.deficit)
            links.push({ source: "Unfunded Gap", target: "Income Pool", value: Math.abs(gap) })
        }

        // Add outflow nodes and links
        if (tax > 100) {
            addNode("Taxes", COLORS.taxes)
            links.push({ source: "Income Pool", target: "Taxes", value: tax })
        }
        if (expenses > 100) {
            addNode("Living Expenses", COLORS.expenses)
            links.push({ source: "Income Pool", target: "Living Expenses", value: expenses })
        }
        if (mortgage > 100) {
            addNode("Mortgage", COLORS.mortgage)
            links.push({ source: "Income Pool", target: "Mortgage", value: mortgage })
        }
        if (margin > 100) {
            addNode("Loan Payments", COLORS.margin)
            links.push({ source: "Income Pool", target: "Loan Payments", value: margin })
        }
        if (savings > 100) {
            addNode("Savings", COLORS.savings)
            links.push({ source: "Income Pool", target: "Savings", value: savings })
        }

        // Surplus
        if (gap > 100) {
            addNode("Surplus", COLORS.savings)
            links.push({ source: "Income Pool", target: "Surplus", value: gap })
        }

        return { nodes, links }
    }, [yearData])

    // Color getter for nodes
    const getNodeColor = (node: SankeyNode) => node.nodeColor || "#94a3b8"

    if (!data || data.length === 0) {
        return (
            <Card className="h-[500px]">
                <CardContent className="h-full flex items-center justify-center text-muted-foreground">
                    No cash flow data available.
                </CardContent>
            </Card>
        )
    }

    if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
        return (
            <Card className="h-[500px]">
                <CardContent className="h-full flex items-center justify-center text-muted-foreground">
                    No cash flow activity for Age {yearData?.age}.
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-[550px] flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Annual Cash Flow</CardTitle>
                        <CardDescription className="text-xs">
                            Age {yearData?.age} ({yearData?.isRetired ? "Retired" : "Working"})
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedAgeIndex(Math.max(0, selectedAgeIndex - 1))}
                            disabled={selectedAgeIndex === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[60px] text-center">
                            Age {yearData?.age}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedAgeIndex(Math.min(data.length - 1, selectedAgeIndex + 1))}
                            disabled={selectedAgeIndex === data.length - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveSankey
                    data={sankeyData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    align="justify"
                    colors={getNodeColor}
                    nodeOpacity={1}
                    nodeHoverOthersOpacity={0.35}
                    nodeThickness={18}
                    nodeSpacing={24}
                    nodeBorderWidth={0}
                    nodeBorderRadius={4}
                    linkOpacity={0.6}
                    linkHoverOthersOpacity={0.1}
                    linkContract={0}
                    linkBlendMode="normal"
                    enableLinkGradient={true}
                    labelPosition="inside"
                    labelOrientation="horizontal"
                    labelPadding={16}
                    labelTextColor={{
                        from: 'color',
                        modifiers: [['darker', 1.5]]
                    }}
                    label={node => `${node.id}`}
                    nodeTooltip={({ node }) => (
                        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: node.color }}
                                />
                                <span className="font-semibold text-sm">{node.id}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Value:</span>
                                <span className="font-mono font-medium">
                                    {formatCurrency(node.value)}
                                </span>
                            </div>
                        </div>
                    )}
                    linkTooltip={({ link }) => (
                        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                            <div className="font-semibold text-sm mb-2 text-center border-b border-border pb-2">
                                {link.source.id} → {link.target.id}
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Flow:</span>
                                <span className="font-mono font-medium">
                                    {formatCurrency(link.value)}
                                </span>
                            </div>
                        </div>
                    )}
                    theme={{
                        text: {
                            fontSize: 12,
                            fontWeight: 600,
                        },
                        tooltip: {
                            container: {
                                background: 'transparent',
                                padding: 0,
                                boxShadow: 'none',
                            },
                        },
                    }}
                />
            </CardContent>
        </Card>
    )
}

export default CashFlowSankey
