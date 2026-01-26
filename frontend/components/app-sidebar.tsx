"use client"

import { Home, LineChart, Wallet, Settings, Building2, CreditCard } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Portfolio", href: "/portfolio", icon: LineChart },
    { name: "Assets", href: "/assets", icon: Wallet },
    { name: "Liabilities", href: "/liabilities", icon: CreditCard },
    { name: "Real Estate", href: "/real-estate", icon: Building2 },
    { name: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
            <div className="flex h-14 items-center border-b px-6">
                <span className="text-lg font-bold">Networth Pro</span>
            </div>
            <div className="flex-1 overflow-auto py-4">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                pathname === item.href
                                    ? "bg-muted text-primary"
                                    : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    )
}
