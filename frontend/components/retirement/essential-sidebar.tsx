"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { EssentialConfig } from "@/lib/retirement-logic"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { User, TrendingUp, Home, Wallet, PiggyBank, Calendar, Settings, HelpCircle } from "lucide-react"
import { SyncedBadge } from "./mode-toggle"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSettings } from "@/lib/settings-context"

type EssentialSidebarProps = {
    config: EssentialConfig
    onChange: (config: EssentialConfig) => void
    syncedFields?: {
        investments: boolean
        realEstate: boolean
        debts: boolean
    }
}

// Currency input formatter
function formatCurrency(value: number): string {
    return value.toLocaleString('en-US')
}

function parseCurrency(value: string): number {
    return parseInt(value.replace(/,/g, '')) || 0
}

// Help tooltip component
function HelpTip({ content }: { content: string }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help ml-1" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p className="text-xs">{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// Currency input component
function CurrencyInput({
    label,
    value,
    onChange,
    help,
    synced,
    syncSource,
}: {
    label: string
    value: number
    onChange: (val: number) => void
    help?: string
    synced?: boolean
    syncSource?: string
}) {
    const { settings } = useSettings()
    return (
        <div className="grid gap-1.5">
            <Label className="flex items-center text-sm flex-wrap gap-1">
                {label}
                {help && <HelpTip content={help} />}
                {synced && syncSource && <SyncedBadge source={syncSource} />}
            </Label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{settings.currency.symbol}</span>
                <Input
                    type="text"
                    value={formatCurrency(value)}
                    onChange={(e) => onChange(parseCurrency(e.target.value))}
                    className="pl-7"
                />
            </div>
        </div>
    )
}

// Percentage input component
function PercentInput({
    label,
    value,
    onChange,
    help,
    min = 0,
    max = 100,
    step = 0.1,
}: {
    label: string
    value: number
    onChange: (val: number) => void
    help?: string
    min?: number
    max?: number
    step?: number
}) {
    return (
        <div className="grid gap-1.5">
            <Label className="flex items-center text-sm">
                {label}
                {help && <HelpTip content={help} />}
            </Label>
            <div className="relative">
                <Input
                    type="number"
                    value={(value * 100).toFixed(1)}
                    onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
                    min={min}
                    max={max}
                    step={step}
                    className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
        </div>
    )
}

export function EssentialSidebar({ config, onChange, syncedFields }: EssentialSidebarProps) {
    const { settings } = useSettings()

    // Helper to update config
    const updateConfig = <K extends keyof EssentialConfig>(key: K, value: EssentialConfig[K]) => {
        onChange({ ...config, [key]: value })
    }

    // Calculate annual savings
    const annualSavings = config.annualIncome - config.annualSpending

    // Calculate total investments
    const totalInvestments = config.totalStocks + config.totalBonds + config.totalCash + config.otherInvestments

    return (
        <Card className="h-full overflow-y-auto">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Essential Configuration</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Simplified planning with ~22 key inputs
                </p>
            </CardHeader>
            <CardContent className="pb-8">
                <Accordion type="multiple" defaultValue={["personal", "investments"]} className="w-full space-y-2">

                    {/* ========== SECTION 1: PERSONAL INFORMATION ========== */}
                    <AccordionItem value="personal" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <span className="font-medium">Personal Information</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid gap-2">
                                <Label className="flex items-center text-sm">
                                    Current Age: {config.currentAge}
                                    <HelpTip content="Your current age in years" />
                                </Label>
                                <Slider
                                    value={[config.currentAge]}
                                    min={18} max={80} step={1}
                                    onValueChange={(vals) => updateConfig("currentAge", vals[0])}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center text-sm">
                                    Retirement Age: {config.retirementAge}
                                    <HelpTip content="The age at which you plan to stop working" />
                                </Label>
                                <Slider
                                    value={[config.retirementAge]}
                                    min={config.currentAge + 1} max={90} step={1}
                                    onValueChange={(vals) => updateConfig("retirementAge", vals[0])}
                                    className="accent-emerald-500"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center text-sm">
                                    Life Expectancy: {config.lifeExpectancy}
                                    <HelpTip content="How long you expect to live - plan for longer to be safe" />
                                </Label>
                                <Slider
                                    value={[config.lifeExpectancy]}
                                    min={config.retirementAge + 1} max={110} step={1}
                                    onValueChange={(vals) => updateConfig("lifeExpectancy", vals[0])}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 2: CURRENT INVESTMENTS ========== */}
                    <AccordionItem value="investments" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                <span className="font-medium">Current Investments</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid grid-cols-1 gap-3">
                                <CurrencyInput
                                    label="Total Stocks"
                                    value={config.totalStocks}
                                    onChange={(v) => updateConfig("totalStocks", v)}
                                    help="Includes stocks, ETFs, and mutual funds"
                                    synced={syncedFields?.investments}
                                    syncSource="Portfolio"
                                />
                                <CurrencyInput
                                    label="Total Bonds"
                                    value={config.totalBonds}
                                    onChange={(v) => updateConfig("totalBonds", v)}
                                    help="Bond funds, treasuries, fixed income"
                                    synced={syncedFields?.investments}
                                    syncSource="Portfolio"
                                />
                                <CurrencyInput
                                    label="Total Cash"
                                    value={config.totalCash}
                                    onChange={(v) => updateConfig("totalCash", v)}
                                    help="Savings, checking, money market accounts"
                                    synced={syncedFields?.investments}
                                    syncSource="Assets"
                                />
                                <CurrencyInput
                                    label="Other Investments"
                                    value={config.otherInvestments}
                                    onChange={(v) => updateConfig("otherInvestments", v)}
                                    help="Crypto, commodities, alternatives"
                                    synced={syncedFields?.investments}
                                    syncSource="Portfolio"
                                />
                            </div>

                            {/* Total Summary */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total Investments</span>
                                    <span className="font-semibold text-emerald-500">
                                        {settings.currency.symbol}{formatCurrency(totalInvestments)}
                                    </span>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 3: REAL ESTATE & DEBT ========== */}
                    <AccordionItem value="realestate" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">Real Estate & Debt</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid grid-cols-1 gap-3">
                                <CurrencyInput
                                    label="Primary Home Value"
                                    value={config.primaryHomeValue}
                                    onChange={(v) => updateConfig("primaryHomeValue", v)}
                                    help="Current market value of your primary residence"
                                    synced={syncedFields?.realEstate}
                                    syncSource="Real Estate"
                                />
                                <CurrencyInput
                                    label="Total Mortgage Balance"
                                    value={config.totalMortgageBalance}
                                    onChange={(v) => updateConfig("totalMortgageBalance", v)}
                                    help="Remaining balance on all mortgages"
                                    synced={syncedFields?.realEstate}
                                    syncSource="Real Estate"
                                />
                                <PercentInput
                                    label="Mortgage Interest Rate"
                                    value={config.mortgageInterestRate}
                                    onChange={(v) => updateConfig("mortgageInterestRate", v)}
                                    help="Weighted average interest rate on mortgages"
                                />
                                <CurrencyInput
                                    label="Other Debts"
                                    value={config.otherDebts}
                                    onChange={(v) => updateConfig("otherDebts", v)}
                                    help="Credit cards, student loans, auto loans, etc."
                                    synced={syncedFields?.debts}
                                    syncSource="Liabilities"
                                />
                            </div>

                            {/* Home Equity Summary */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Home Equity</span>
                                    <span className={`font-semibold ${config.primaryHomeValue - config.totalMortgageBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {settings.currency.symbol}{formatCurrency(config.primaryHomeValue - config.totalMortgageBalance)}
                                    </span>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 4: ANNUAL CASH FLOW ========== */}
                    <AccordionItem value="cashflow" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-purple-500" />
                                <span className="font-medium">Annual Cash Flow</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid grid-cols-1 gap-3">
                                <CurrencyInput
                                    label="Annual Income (Net)"
                                    value={config.annualIncome}
                                    onChange={(v) => updateConfig("annualIncome", v)}
                                    help="Your take-home pay after taxes"
                                />
                                <CurrencyInput
                                    label="Annual Spending"
                                    value={config.annualSpending}
                                    onChange={(v) => updateConfig("annualSpending", v)}
                                    help="Your annual living expenses"
                                />
                            </div>

                            {/* Savings Summary */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Annual Savings</span>
                                    <span className={`font-semibold ${annualSavings >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {annualSavings >= 0 ? '+' : ''}{settings.currency.symbol}{formatCurrency(annualSavings)}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {annualSavings > 0
                                        ? `Saving ${((annualSavings / config.annualIncome) * 100).toFixed(0)}% of income`
                                        : annualSavings < 0
                                        ? "Spending more than income"
                                        : "Breaking even"}
                                </p>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 5: RETIREMENT SPENDING ========== */}
                    <AccordionItem value="retirement-spending" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <PiggyBank className="h-4 w-4 text-amber-500" />
                                <span className="font-medium">Retirement Spending</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <p className="text-xs text-muted-foreground">
                                Plan for two phases: active early retirement and quieter later years.
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <CurrencyInput
                                        label="Go-Go Years Spending"
                                        value={config.goGoSpending}
                                        onChange={(v) => updateConfig("goGoSpending", v)}
                                        help="Annual spending during active retirement (travel, hobbies)"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Active retirement phase</p>
                                </div>
                                <div>
                                    <CurrencyInput
                                        label="Slow-Go Years Spending"
                                        value={config.slowGoSpending}
                                        onChange={(v) => updateConfig("slowGoSpending", v)}
                                        help="Annual spending during reduced activity phase"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Quieter retirement phase</p>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="flex items-center text-sm">
                                        Transition Age: {config.transitionAge}
                                        <HelpTip content="Age when you transition from Go-Go to Slow-Go spending" />
                                    </Label>
                                    <Slider
                                        value={[config.transitionAge]}
                                        min={config.retirementAge} max={config.lifeExpectancy} step={1}
                                        onValueChange={(vals) => updateConfig("transitionAge", vals[0])}
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 6: PENSION / RETIREMENT INCOME ========== */}
                    <AccordionItem value="pension" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-cyan-500" />
                                <span className="font-medium">Pension / Retirement Income</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <p className="text-xs text-muted-foreground">
                                Include Social Security, state pension, or any guaranteed retirement income.
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="grid gap-1.5">
                                    <Label className="flex items-center text-sm">
                                        Start Age: {config.pensionStartAge}
                                        <HelpTip content="Age when you start receiving pension or Social Security" />
                                    </Label>
                                    <Slider
                                        value={[config.pensionStartAge]}
                                        min={config.retirementAge} max={75} step={1}
                                        onValueChange={(vals) => updateConfig("pensionStartAge", vals[0])}
                                    />
                                </div>
                                <CurrencyInput
                                    label="Annual Amount"
                                    value={config.pensionAmount}
                                    onChange={(v) => updateConfig("pensionAmount", v)}
                                    help="Expected annual pension/Social Security income (in today's dollars)"
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== SECTION 7: ASSUMPTIONS ========== */}
                    <AccordionItem value="assumptions" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">Assumptions</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid grid-cols-1 gap-3">
                                <PercentInput
                                    label="Expected Return"
                                    value={config.expectedReturn}
                                    onChange={(v) => updateConfig("expectedReturn", v)}
                                    help="Blended annual return on your portfolio (typically 5-7%)"
                                />
                                <PercentInput
                                    label="Inflation Rate"
                                    value={config.inflationRate}
                                    onChange={(v) => updateConfig("inflationRate", v)}
                                    help="Expected annual inflation (historically 2-3%)"
                                />
                                <PercentInput
                                    label="Withdrawal Tax Rate"
                                    value={config.withdrawalTaxRate}
                                    onChange={(v) => updateConfig("withdrawalTaxRate", v)}
                                    help="Estimated tax rate on retirement withdrawals"
                                />
                            </div>

                            {/* Real Return Summary */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Real Return (after inflation)</span>
                                    <span className="font-semibold text-primary">
                                        {((config.expectedReturn - config.inflationRate) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </CardContent>
        </Card>
    )
}
