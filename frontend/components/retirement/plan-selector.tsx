"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Trash2, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
    RetirementPlan,
    fetchRetirementPlans,
    deleteRetirementPlan,
    activateRetirementPlan,
} from "@/lib/api"

interface PlanSelectorProps {
    selectedPlanId: number | null
    onSelectPlan: (plan: RetirementPlan | null) => void
    onRefresh?: () => void
}

export function PlanSelector({ selectedPlanId, onSelectPlan, onRefresh }: PlanSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [plans, setPlans] = React.useState<RetirementPlan[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const [planToDelete, setPlanToDelete] = React.useState<RetirementPlan | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    const loadPlans = React.useCallback(async () => {
        setIsLoading(true)
        const data = await fetchRetirementPlans()
        setPlans(data)
        setIsLoading(false)
    }, [])

    React.useEffect(() => {
        loadPlans()
    }, [loadPlans])

    const selectedPlan = plans.find(p => p.id === selectedPlanId)

    const handleSelect = (plan: RetirementPlan) => {
        onSelectPlan(plan)
        setOpen(false)
    }

    const handleClear = () => {
        onSelectPlan(null)
        setOpen(false)
    }

    const handleDeleteClick = (e: React.MouseEvent, plan: RetirementPlan) => {
        e.stopPropagation()
        setPlanToDelete(plan)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!planToDelete) return
        setIsDeleting(true)
        const success = await deleteRetirementPlan(planToDelete.id)
        if (success) {
            if (selectedPlanId === planToDelete.id) {
                onSelectPlan(null)
            }
            await loadPlans()
            onRefresh?.()
        }
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setPlanToDelete(null)
    }

    const handleActivate = async (e: React.MouseEvent, plan: RetirementPlan) => {
        e.stopPropagation()
        await activateRetirementPlan(plan.id)
        await loadPlans()
    }

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[220px] justify-between"
                    >
                        {selectedPlan ? (
                            <span className="flex items-center gap-2 truncate">
                                {selectedPlan.is_active && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                {selectedPlan.name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select a plan...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                    <Command>
                        <CommandInput placeholder="Search plans..." />
                        <CommandList>
                            <CommandEmpty>
                                {isLoading ? "Loading..." : "No saved plans found."}
                            </CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    onSelect={handleClear}
                                    className="text-muted-foreground"
                                >
                                    <span className="flex-1">New / Unsaved</span>
                                    {!selectedPlanId && <Check className="h-4 w-4" />}
                                </CommandItem>
                                {plans.map((plan) => (
                                    <CommandItem
                                        key={plan.id}
                                        value={plan.name}
                                        onSelect={() => handleSelect(plan)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {plan.is_active && (
                                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                                            )}
                                            <span className="truncate">{plan.name}</span>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                ({plan.mode})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {selectedPlanId === plan.id && (
                                                <Check className="h-4 w-4" />
                                            )}
                                            {!plan.is_active && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={(e) => handleActivate(e, plan)}
                                                    title="Set as active"
                                                >
                                                    <Star className="h-3 w-3" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={(e) => handleDeleteClick(e, plan)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{planToDelete?.name}"? This action cannot be undone.
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
