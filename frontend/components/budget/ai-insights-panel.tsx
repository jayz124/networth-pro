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
    Wand2,
} from "lucide-react"
import {
    AIInsight,
    fetchAIInsights,
    autoCategorizeTransactions,
    checkAIStatus,
} from "@/lib/api"

interface AIInsightsPanelProps {
    onTransactionsUpdated?: () => void
}

export function AIInsightsPanel({ onTransactionsUpdated }: AIInsightsPanelProps) {
    const [insights, setInsights] = React.useState<AIInsight[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isAIPowered, setIsAIPowered] = React.useState(false)
    const [isCategorizing, setIsCategorizing] = React.useState(false)
    const [categorizeResult, setCategorizeResult] = React.useState<{
        processed: number
        updated: number
    } | null>(null)

    const loadInsights = React.useCallback(async () => {
        setIsLoading(true)
        const result = await fetchAIInsights()
        if (result) {
            setInsights(result.insights)
            setIsAIPowered(result.ai_powered)
        }
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadInsights()
    }, [loadInsights])

    const handleAutoCategorize = async () => {
        setIsCategorizing(true)
        setCategorizeResult(null)
        const result = await autoCategorizeTransactions()
        if (result) {
            setCategorizeResult({
                processed: result.processed,
                updated: result.updated,
            })
            onTransactionsUpdated?.()
        }
        setIsCategorizing(false)
    }

    const getInsightIcon = (type: string) => {
        switch (type) {
            case "warning":
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case "tip":
                return <Lightbulb className="h-4 w-4 text-blue-500" />
            case "positive":
                return <TrendingUp className="h-4 w-4 text-success" />
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
                        AI Insights
                    </CardTitle>
                    <CardDescription>
                        {isAIPowered ? "Powered by OpenAI" : "Rule-based analysis"}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoCategorize}
                        disabled={isCategorizing}
                    >
                        {isCategorizing ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Wand2 className="h-4 w-4 mr-2" />
                        )}
                        Auto-Categorize
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={loadInsights}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Categorization Result */}
                {categorizeResult && (
                    <div className="p-3 rounded-lg border border-success/30 bg-success/5">
                        <p className="text-sm text-success">
                            Processed {categorizeResult.processed} transactions,
                            updated {categorizeResult.updated} categories
                        </p>
                    </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : insights.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No insights available yet.</p>
                        <p className="text-sm">Add more transactions to get personalized insights.</p>
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

                {/* AI Status */}
                {!isAIPowered && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        Set OPENAI_API_KEY for enhanced AI insights
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
