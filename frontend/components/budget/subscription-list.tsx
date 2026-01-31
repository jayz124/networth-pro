"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    CreditCard,
    MoreHorizontal,
    Trash2,
    RefreshCw,
    Plus,
    Sparkles,
    Calendar,
    PauseCircle,
    PlayCircle,
} from "lucide-react"
import {
    Subscription,
    DetectedSubscription,
    fetchSubscriptions,
    deleteSubscription,
    updateSubscription,
    detectSubscriptions,
    createSubscriptionFromDetection,
} from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

interface SubscriptionListProps {
    onRefreshTransactions?: () => void
}

export function SubscriptionList({ onRefreshTransactions }: SubscriptionListProps) {
    const { formatCurrency } = useSettings()
    const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([])
    const [detectedSubs, setDetectedSubs] = React.useState<DetectedSubscription[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isDetecting, setIsDetecting] = React.useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const [subToDelete, setSubToDelete] = React.useState<Subscription | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const loadSubscriptions = React.useCallback(async () => {
        setIsLoading(true)
        const data = await fetchSubscriptions()
        setSubscriptions(data)
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadSubscriptions()
    }, [loadSubscriptions])

    const handleDetectSubscriptions = async () => {
        setIsDetecting(true)
        const result = await detectSubscriptions(6)
        if (result) {
            setDetectedSubs(result.new_suggestions)
        }
        setIsDetecting(false)
    }

    const handleAddDetected = async (detected: DetectedSubscription) => {
        const result = await createSubscriptionFromDetection({
            name: detected.name,
            amount: detected.amount,
            frequency: detected.frequency,
            category_id: detected.suggested_category_id,
        })
        if (result) {
            setDetectedSubs(prev => prev.filter(d => d.name !== detected.name))
            await loadSubscriptions()
        }
    }

    const handleToggleActive = async (sub: Subscription) => {
        await updateSubscription(sub.id, { is_active: !sub.is_active })
        await loadSubscriptions()
    }

    const handleDeleteClick = (sub: Subscription) => {
        setSubToDelete(sub)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!subToDelete) return
        setIsDeleting(true)
        const success = await deleteSubscription(subToDelete.id)
        if (success) {
            await loadSubscriptions()
        }
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setSubToDelete(null)
    }

    const formatFrequency = (freq: string) => {
        switch (freq) {
            case "monthly": return "/mo"
            case "yearly": return "/yr"
            case "weekly": return "/wk"
            case "biweekly": return "/2wk"
            default: return ""
        }
    }

    const formatNextBilling = (dateStr?: string) => {
        if (!dateStr) return null
        const date = new Date(dateStr)
        const now = new Date()
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return "Past due"
        if (diffDays === 0) return "Today"
        if (diffDays === 1) return "Tomorrow"
        if (diffDays <= 7) return `In ${diffDays} days`
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }

    const monthlyTotal = subscriptions
        .filter(s => s.is_active)
        .reduce((sum, s) => {
            if (s.frequency === "yearly") return sum + (s.amount / 12)
            if (s.frequency === "weekly") return sum + (s.amount * 4.33)
            if (s.frequency === "biweekly") return sum + (s.amount * 2.17)
            return sum + s.amount
        }, 0)

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscriptions
                        </CardTitle>
                        <CardDescription>
                            Track recurring expenses
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetectSubscriptions}
                        disabled={isDetecting}
                    >
                        {isDetecting ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Detect
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Monthly Total */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Monthly Total</span>
                        <span className="font-bold text-lg">{formatCurrency(monthlyTotal)}</span>
                    </div>

                    {/* Detected Subscriptions */}
                    {detectedSubs.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-accent" />
                                Detected Subscriptions
                            </h4>
                            {detectedSubs.map((detected, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-2 rounded-lg border border-dashed border-accent/50"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{detected.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCurrency(detected.amount)}{formatFrequency(detected.frequency)} • {detected.occurrences} occurrences
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAddDetected(detected)}
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Subscription List */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : subscriptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No subscriptions tracked yet.</p>
                            <p className="text-sm">Click Detect to find recurring expenses.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {subscriptions.map((sub) => (
                                <div
                                    key={sub.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                        sub.is_active ? "" : "opacity-50 bg-muted/50"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{sub.name}</p>
                                                {!sub.is_active && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Paused
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{sub.frequency}</span>
                                                {sub.next_billing_date && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {formatNextBilling(sub.next_billing_date)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">
                                            {formatCurrency(sub.amount)}
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {formatFrequency(sub.frequency)}
                                            </span>
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleToggleActive(sub)}>
                                                    {sub.is_active ? (
                                                        <>
                                                            <PauseCircle className="h-4 w-4 mr-2" />
                                                            Pause
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlayCircle className="h-4 w-4 mr-2" />
                                                            Resume
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteClick(sub)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{subToDelete?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
