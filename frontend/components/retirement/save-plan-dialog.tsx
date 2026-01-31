"use client"

import * as React from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    RetirementPlan,
    createRetirementPlan,
    updateRetirementPlan,
} from "@/lib/api"

interface SavePlanDialogProps {
    mode: string  // "pro" or "essential"
    configJson: string  // JSON-serialized config
    existingPlan?: RetirementPlan | null
    onSaved: (plan: RetirementPlan) => void
}

export function SavePlanDialog({ mode, configJson, existingPlan, onSaved }: SavePlanDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [name, setName] = React.useState(existingPlan?.name || "")
    const [description, setDescription] = React.useState(existingPlan?.description || "")
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const isUpdating = !!existingPlan

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            setName(existingPlan?.name || "")
            setDescription(existingPlan?.description || "")
            setError(null)
        }
    }, [open, existingPlan])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError("Name is required")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            let result: RetirementPlan | null
            if (isUpdating && existingPlan) {
                result = await updateRetirementPlan(existingPlan.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    mode,
                    config_json: configJson,
                })
            } else {
                result = await createRetirementPlan({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    mode,
                    config_json: configJson,
                })
            }

            if (result) {
                onSaved(result)
                setOpen(false)
            } else {
                setError("Failed to save plan. The name might already exist.")
            }
        } catch {
            setError("An error occurred while saving the plan.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Save className="h-4 w-4" />
                    {isUpdating ? "Update Plan" : "Save Plan"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {isUpdating ? "Update Retirement Plan" : "Save Retirement Plan"}
                        </DialogTitle>
                        <DialogDescription>
                            {isUpdating
                                ? "Update the current configuration to this saved plan."
                                : "Save your current retirement configuration for later use."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Conservative Plan"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (optional)</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief notes about this plan..."
                                rows={3}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">
                                {mode === "pro" ? "Pro Mode" : "Essential Mode"}
                            </span>
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !name.trim()}>
                            {isLoading ? "Saving..." : isUpdating ? "Update" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
