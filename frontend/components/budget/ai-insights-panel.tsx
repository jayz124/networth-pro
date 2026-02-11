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
    TrendingDown,
    RefreshCw,
    Wand2,
    Activity,
    Trophy,
    ChevronDown,
    ChevronUp,
    CreditCard,
} from "lucide-react"
import {
    AIInsight,
    TrendAnalysis,
    fetchAIInsights,
    autoCategorizeTransactions,
    checkAIStatus,
} from "@/lib/api"

interface AIInsightsPanelProps {
    onTransactionsUpdated?: () => void
}

export function AIInsightsPanel({ onTransactionsUpdated }: AIInsightsPanelProps) {
    const [insights, setInsights] = React.useState<AIInsight[]>([])
    const [trendAnalysis, setTrendAnalysis] = React.useState<TrendAnalysis | null>(null)
    const [subscriptionSuggestions, setSubscriptionSuggestions] = React.useState<AIInsight[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isAIPowered, setIsAIPowered] = React.useState(false)
    const [providerName, setProviderName] = React.useState<string | null>(null)
    const [isCategorizing, setIsCategorizing] = React.useState(false)
    const [showTrends, setShowTrends] = React.useState(false)
    const [showSubTips, setShowSubTips] = React.useState(false)
    const [categorizeResult, setCategorizeResult] = React.useState<{
        processed: number
        updated: number
    } | null>(null)

    const loadInsights = React.useCallback(async () => {
        setIsLoading(true)
        const result = await fetchAIInsights(true)
        if (result) {
            setInsights(result.insights)
            setIsAIPowered(result.ai_powered)
            setProviderName(result.ai_provider_name || null)
            setTrendAnalysis(result.trend_analysis || null)
            setSubscriptionSuggestions(result.subscription_suggestions || [])
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
                return <AlertTriangle className="h-4 w-4 text-warning" />
            case "tip":
                return <Lightbulb className="h-4 w-4 text-info" />
            case "positive":
                return <TrendingUp className="h-4 w-4 text-success" />
            case "anomaly":
                return <Activity className="h-4 w-4 text-accent" />
            case "milestone":
                return <Trophy className="h-4 w-4 text-warning" />
            case "trend":
                return <TrendingUp className="h-4 w-4 text-success" />
            default:
                return <Sparkles className="h-4 w-4" />
        }
    }

    const getInsightColor = (type: string) => {
        switch (type) {
            case "warning":
                return "border-warning/30 bg-warning/5"
            case "tip":
                return "border-info/30 bg-info/5"
            case "positive":
                return "border-success/30 bg-success/5"
            case "anomaly":
                return "border-accent/30 bg-accent/5"
            case "milestone":
                return "border-warning/30 bg-warning/5"
            case "trend":
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
                        {isAIPowered ? `Powered by ${providerName || "AI"}` : "Rule-based analysis"}
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

                {/* Spending Trends Section */}
                {!isLoading && trendAnalysis && (
                    <div className="border-t pt-4">
                        <button
                            onClick={() => setShowTrends(!showTrends)}
                            className="flex items-center justify-between w-full text-left"
                        >
                            <div className="flex items-center gap-2">
                                {trendAnalysis.trend === "improving" ? (
                                    <TrendingUp className="h-4 w-4 text-success" />
                                ) : trendAnalysis.trend === "declining" ? (
                                    <TrendingDown className="h-4 w-4 text-destructive" />
                                ) : (
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium text-sm">Spending Trends</span>
                                <Badge variant="outline" className="text-xs">
                                    {trendAnalysis.trend}
                                </Badge>
                            </div>
                            {showTrends ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                        {showTrends && (
                            <div className="mt-3 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    {trendAnalysis.trend_description}
                                </p>
                                {trendAnalysis.key_observations?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Key Observations</p>
                                        <ul className="text-sm space-y-1">
                                            {trendAnalysis.key_observations.map((obs, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-muted-foreground mt-1">•</span>
                                                    <span>{obs}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {trendAnalysis.recommendations?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                                        <ul className="text-sm space-y-1">
                                            {trendAnalysis.recommendations.map((rec, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <Lightbulb className="h-3 w-3 text-info mt-1 shrink-0" />
                                                    <span>{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {trendAnalysis.next_month_prediction && (
                                    <div className="p-2 rounded-lg bg-muted/50 text-sm">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Next Month Prediction</p>
                                        <div className="flex gap-4">
                                            <span className="text-success">Income: ${trendAnalysis.next_month_prediction.income?.toLocaleString()}</span>
                                            <span className="text-destructive">Expenses: ${trendAnalysis.next_month_prediction.expenses?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Subscription Tips Section */}
                {!isLoading && subscriptionSuggestions.length > 0 && (
                    <div className="border-t pt-4">
                        <button
                            onClick={() => setShowSubTips(!showSubTips)}
                            className="flex items-center justify-between w-full text-left"
                        >
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-info" />
                                <span className="font-medium text-sm">Subscription Tips</span>
                                <Badge variant="outline" className="text-xs">
                                    {subscriptionSuggestions.length}
                                </Badge>
                            </div>
                            {showSubTips ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                        {showSubTips && (
                            <div className="mt-3 space-y-2">
                                {subscriptionSuggestions.map((tip, i) => (
                                    <div key={i} className="p-3 rounded-lg border border-info/30 bg-info/5">
                                        <div className="flex items-start gap-3">
                                            <Lightbulb className="h-4 w-4 text-info mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-sm">{tip.title}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">{tip.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AI Status */}
                {!isAIPowered && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        Configure an AI provider in Settings for enhanced insights
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
