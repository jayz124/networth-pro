"use client"

import * as React from "react"
import { Plus } from "lucide-react"
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
import { createPortfolio } from "@/lib/api"

type CreatePortfolioDialogProps = {
    onCreated: () => void
    trigger?: React.ReactNode
}

export function CreatePortfolioDialog({ onCreated, trigger }: CreatePortfolioDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")

    const handleSubmit = async () => {
        if (!name.trim()) return

        setIsLoading(true)
        const result = await createPortfolio({
            name: name.trim(),
            description: description.trim() || undefined,
        })
        setIsLoading(false)

        if (result) {
            setOpen(false)
            setName("")
            setDescription("")
            onCreated()
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Portfolio
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Portfolio</DialogTitle>
                    <DialogDescription>
                        Create a new portfolio to organize your investments.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="portfolio-name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="portfolio-name"
                            placeholder="Personal Stocks"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="portfolio-desc" className="text-right">
                            Description
                        </Label>
                        <Input
                            id="portfolio-desc"
                            placeholder="Optional description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
                        {isLoading ? "Creating..." : "Create Portfolio"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
