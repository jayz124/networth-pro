"use client"

import { Home, LineChart, Wallet, Settings, Building2, CreditCard, Umbrella } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Portfolio", href: "/portfolio", icon: LineChart },
    { name: "Assets", href: "/assets", icon: Wallet },
    { name: "Liabilities", href: "/liabilities", icon: CreditCard },
    { name: "Real Estate", href: "/real-estate", icon: Building2 },
    { name: "Retirement", href: "/retirement", icon: Umbrella },
    { name: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-full w-64 flex-col bg-card/50 text-card-foreground">
            {/* Logo Section */}
            <div className="flex h-16 items-center border-b border-border/50 px-6">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-success">
                        <span className="text-sm font-bold text-accent-foreground">N</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-bold tracking-tight">Networth</span>
                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Pro</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-6">
                <nav className="grid items-start gap-1 px-3">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-accent/10 text-accent"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {/* Active indicator bar */}
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                                )}
                                <item.icon className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    isActive ? "text-accent" : "group-hover:scale-110"
                                )} />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Bottom Section - Theme Toggle */}
            <div className="border-t border-border/50 p-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Theme</span>
                    <ThemeToggle />
                </div>
            </div>
        </div>
    )
}
