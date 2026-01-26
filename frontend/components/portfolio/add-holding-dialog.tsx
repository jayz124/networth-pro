"use client"

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
import { Plus } from "lucide-react"

export function AddHoldingDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Holding
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Holding</DialogTitle>
                    <DialogDescription>
                        Manually track a new asset in your portfolio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ticker" className="text-right">
                            Ticker/ID
                        </Label>
                        <Input id="ticker" placeholder="AAPL" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <Input id="type" placeholder="Stock" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">
                            Quantity
                        </Label>
                        <Input id="quantity" type="number" placeholder="0.00" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="avg-price" className="text-right">
                            Avg Price
                        </Label>
                        <Input id="avg-price" type="number" placeholder="$0.00" className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit">Save Holding</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
