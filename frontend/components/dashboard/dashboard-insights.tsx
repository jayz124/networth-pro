"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Sparkles,
    AlertTriangle,
    Lightbulb,
    TrendingUp,
    RefreshCw,
    Activity,
    Trophy,
} from "lucide-react"
import { AIInsight, fetchDashboardInsights } from "@/lib/api"

export function DashboardInsightsCard() {
    const [insights, setInsights] = React.useState<AIInsight[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isAIPowered, setIsAIPowered] = React.useState(false)
    const [providerName, setProviderName] = React.useState<string | null>(null)

    const loadInsights = React.useCallback(async () => {
        setIsLoading(true)
        const result = await fetchDashboardInsights()
        if (result) {
            setInsights(result.insights)
            setIsAIPowered(result.ai_powered)
            setProviderName(result.ai_provider_name || null)
        }
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadInsights()
    }, [loadInsights])

    const getInsightIcon = (type: string) => {
        switch (type) {
            case "warning":
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case "tip":
                return <Lightbulb className="h-4 w-4 text-blue-500" />
            case "positive":
                return <TrendingUp className="h-4 w-4 text-success" />
            case "anomaly":
                return <Activity className="h-4 w-4 text-purple-500" />
            case "milestone":
                return <Trophy className="h-4 w-4 text-amber-500" />
            case "trend":
                return <TrendingUp className="h-4 w-4 text-teal-500" />
            default:
                return <Sparkles className="h-4 w-4" />
        }
    }

    const getInsightColor = (type: string) => {
        switch (type) {
            case "warning":
                return "border-yellow-500/30 bg-yellow-500/5"
            case "tip":
                return "border-blue-500/30 bg-blue-500/5"
            case "positive":
                return "border-success/30 bg-success/5"
            case "anomaly":
                return "border-purple-500/30 bg-purple-500/5"
            case "milestone":
                return "border-amber-500/30 bg-amber-500/5"
            case "trend":
                return "border-teal-500/30 bg-teal-500/5"
            default:
                return "border-border"
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-accent" />
                        Financial Insights
                    </CardTitle>
                    <CardDescription>
                        {isAIPowered ? `Powered by ${providerName || "AI"}` : "Rule-based analysis"}
                    </CardDescription>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadInsights}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : insights.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No insights available yet.</p>
                        <p className="text-sm mt-1">Add accounts and assets to get financial insights.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {insights.map((insight, index) => (
                            <div
                                key={index}
                                className={`p-3 rounded-lg border ${getInsightColor(insight.type)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {getInsightIcon(insight.type)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm">{insight.title}</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {insight.description}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-xs">
                                        {insight.type}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isAIPowered && !isLoading && (
                    <p className="text-xs text-muted-foreground text-center pt-3">
                        Configure an AI provider in Settings for AI-powered insights
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
