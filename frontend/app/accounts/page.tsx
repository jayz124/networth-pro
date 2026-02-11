"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlaidLinkButton } from "@/components/plaid-link-button"
import { ShieldCheck, Info } from "lucide-react"

export default function AccountsPage() {
    return (
        <div className="container mx-auto p-6 space-y-6 max-w-5xl">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Connected Accounts</h1>
                <p className="text-muted-foreground">
                    Securely link your bank accounts for automated net worth updates.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Integration Card */}
                <Card className="border-success/20 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ShieldCheck className="w-24 h-24 text-success" />
                    </div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-success" />
                            Security First
                        </CardTitle>
                        <CardDescription>
                            We use Plaid to securely connect to your financial institutions.
                            Your credentials are never stored on our servers.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PlaidLinkButton />
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-info" />
                            Supported Institutions
                        </CardTitle>
                        <CardDescription>
                            We support thousands of banks, credit unions, and investment firms.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            <li>Chase, Wells Fargo, Bank of America</li>
                            <li>Fidelity, Vanguard, Charles Schwab</li>
                            <li>American Express, Citi, Capital One</li>
                            <li>Robinhood, Coinbase, and more</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {/* Linked Accounts List (Placeholder) */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Connections</CardTitle>
                    <CardDescription>Accounts you have actively linked to Networth Pro.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                        <ShieldCheck className="w-10 h-10 mb-3 opacity-20" />
                        <p className="font-medium">No accounts linked yet</p>
                        <p className="text-sm">Click "Connect Bank Account" to get started.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
