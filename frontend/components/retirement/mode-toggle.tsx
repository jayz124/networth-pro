"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Sparkles, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { RetirementMode } from "@/lib/retirement-mode-context"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface ModeToggleProps {
    mode: RetirementMode
    onModeChange: (mode: RetirementMode) => void
    onSync?: () => void
    isSyncing?: boolean
    className?: string
}

export function ModeToggle({
    mode,
    onModeChange,
    onSync,
    isSyncing = false,
    className,
}: ModeToggleProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* Segmented Control */}
            <div className="flex rounded-lg border bg-muted p-1">
                <button
                    onClick={() => onModeChange("essential")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                        mode === "essential"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Essential
                </button>
                <button
                    onClick={() => onModeChange("pro")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                        mode === "pro"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Settings2 className="h-3.5 w-3.5" />
                    Pro
                </button>
            </div>

            {/* Sync Button - only visible in Essential mode */}
            {mode === "essential" && onSync && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSync}
                                disabled={isSyncing}
                                className="h-9"
                            >
                                <RefreshCw className={cn("h-4 w-4 mr-1.5", isSyncing && "animate-spin")} />
                                Sync
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">Sync data from Portfolio, Assets, Real Estate & Liabilities</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

// Synced field indicator badge
export function SyncedBadge({ source }: { source: string }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                        <RefreshCw className="h-2.5 w-2.5" />
                        synced
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">Auto-synced from {source}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
