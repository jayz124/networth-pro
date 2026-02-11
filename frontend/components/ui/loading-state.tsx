"use client"

import { RefreshCw, Loader2 } from "lucide-react"
import { type LucideIcon } from "lucide-react"

interface LoadingStateProps {
    message?: string
    size?: "sm" | "md" | "lg"
    className?: string
}

/**
 * Standardized loading spinner used across all pages/components.
 * Uses RefreshCw icon with animate-spin for consistency.
 */
export function LoadingState({
    message = "Loading...",
    size = "md",
    className = "",
}: LoadingStateProps) {
    const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6"
    const containerPadding = size === "sm" ? "py-4" : size === "lg" ? "py-16" : "py-8"
    const textSize = size === "sm" ? "text-xs" : "text-sm"

    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${containerPadding} ${className}`}>
            <RefreshCw className={`${iconSize} animate-spin text-muted-foreground`} />
            {message && (
                <p className={`${textSize} text-muted-foreground`}>{message}</p>
            )}
        </div>
    )
}

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}

/**
 * Standardized empty state used when no data is available.
 * Displays an icon, title, optional description, and optional action.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className = "",
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-16 text-center opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards] ${className}`}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                <Icon className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
