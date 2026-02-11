"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    BookOpen,
    RefreshCw,
    ExternalLink,
    Newspaper,
    TrendingUp,
    RefreshCcw,
    Scale,
    Umbrella,
    Target,
    Home,
    Sprout,
    Lightbulb,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { FinancialStory, NewsArticle, fetchFinancialStories } from "@/lib/api"

const STORY_ICON_MAP: Record<string, { icon: LucideIcon; className: string }> = {
    // By emoji
    "📈": { icon: TrendingUp, className: "text-gain" },
    "🔄": { icon: RefreshCcw, className: "text-info" },
    "⚖️": { icon: Scale, className: "text-warning" },
    "🏖️": { icon: Umbrella, className: "text-info" },
    "🎯": { icon: Target, className: "text-warning" },
    "🏠": { icon: Home, className: "text-success" },
    "🌱": { icon: Sprout, className: "text-gain" },
    "💡": { icon: Lightbulb, className: "text-info" },
    // By story type
    "growth": { icon: TrendingUp, className: "text-gain" },
    "perspective": { icon: RefreshCcw, className: "text-info" },
    "comparison": { icon: Scale, className: "text-warning" },
    "freedom": { icon: Umbrella, className: "text-info" },
    "milestone": { icon: Target, className: "text-warning" },
}

function getStoryIcon(story: FinancialStory): { icon: LucideIcon; className: string } {
    return STORY_ICON_MAP[story.emoji] || STORY_ICON_MAP[story.type] || { icon: Lightbulb, className: "text-muted-foreground" }
}

export function FinancialStoriesCard() {
    const [stories, setStories] = React.useState<FinancialStory[]>([])
    const [news, setNews] = React.useState<NewsArticle[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isAIPowered, setIsAIPowered] = React.useState(false)

    const loadStories = React.useCallback(async (refresh: boolean = false) => {
        setIsLoading(true)
        const result = await fetchFinancialStories(refresh)
        if (result) {
            setStories(result.stories)
            setNews(result.news || [])
            setIsAIPowered(result.ai_powered)
        }
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadStories()
    }, [loadStories])

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-accent" />
                        Your Financial Story
                    </CardTitle>
                    <CardDescription>
                        {isAIPowered ? "AI-generated narratives" : "Data-driven perspectives"}
                    </CardDescription>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => loadStories(true)}
                    disabled={isLoading}
                    title="Get new stories"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : stories.length === 0 && news.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No stories available yet.</p>
                        <p className="text-sm mt-1">Add financial data to unlock your story.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Stories */}
                        {stories.length > 0 && (
                            <div className="space-y-3">
                                {stories.map((story, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-lg border bg-muted/30"
                                    >
                                        <div className="flex items-start gap-3">
                                            {(() => {
                                                const { icon: Icon, className } = getStoryIcon(story)
                                                return (
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                        <Icon className={`h-4 w-4 ${className}`} />
                                                    </div>
                                                )
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-sm">{story.headline}</h4>
                                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                                    {story.narrative}
                                                </p>
                                                {story.data_points && story.data_points.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {story.data_points.map((dp, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent"
                                                            >
                                                                {dp}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* News Articles */}
                        {news.length > 0 && (
                            <div className="border-t pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Newspaper className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Relevant News</span>
                                    <span className="text-xs text-muted-foreground">Based on your portfolio</span>
                                </div>
                                <div className="space-y-2">
                                    {news.map((article, index) => (
                                        <a
                                            key={index}
                                            href={article.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-snug group-hover:text-accent transition-colors line-clamp-2">
                                                    {article.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {article.source && (
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {article.source}
                                                        </span>
                                                    )}
                                                    {article.published && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {article.published}
                                                        </span>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                        {article.theme}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isAIPowered && !isLoading && (
                    <p className="text-xs text-muted-foreground text-center pt-3">
                        Configure an AI provider in Settings for richer narratives
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
