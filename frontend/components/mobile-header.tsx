"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export function MobileHeader() {
    return (
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-4 md:hidden">
            <div className="flex items-center">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="-ml-2">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 border-r w-64">
                        <div className="h-full">
                            <AppSidebar />
                        </div>
                    </SheetContent>
                </Sheet>
                <div className="ml-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-success">
                        <span className="text-xs font-bold text-accent-foreground">N</span>
                    </div>
                    <span className="text-base font-bold tracking-tight">Networth</span>
                </div>
            </div>
            <ThemeToggle />
        </div>
    )
}
