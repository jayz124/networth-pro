"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AppSidebar } from "@/components/app-sidebar"

export function MobileHeader() {
    return (
        <div className="flex h-14 items-center border-b px-6 md:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="-ml-2">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle navigation</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 border-r w-64">
                    {/* Re-use sidebar content but strip the outer container style in a real app, 
               or just render AppSidebar. AppSidebar has width set class, so might need adjusting if reusable.
               For now, AppSidebar has w-64 which matches sheet width.
           */}
                    <div className="h-full">
                        <AppSidebar />
                    </div>
                </SheetContent>
            </Sheet>
            <span className="ml-4 text-lg font-bold">Networth Pro</span>
        </div>
    )
}
