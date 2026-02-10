"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RetirementConfig } from "@/lib/retirement-logic"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Wallet, CreditCard, ArrowLeftRight, Gift, TrendingUp, Receipt, AlertTriangle, HelpCircle } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSettings } from "@/lib/settings-context"

type ConfigSidebarProps = {
    config: RetirementConfig;
    onChange: (config: RetirementConfig) => void;
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
}: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    help?: string;
}) {
    const { settings } = useSettings()
    return (
        <div className="grid gap-1.5">
            <Label className="flex items-center text-sm">
                {label}
                {help && <HelpTip content={help} />}
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
    label: string;
    value: number;
    onChange: (val: number) => void;
    help?: string;
    min?: number;
    max?: number;
    step?: number;
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

export function ConfigSidebar({ config, onChange }: ConfigSidebarProps) {
    const { settings } = useSettings()

    // Helper to update nested config
    const updateConfig = <K extends keyof RetirementConfig>(key: K, value: RetirementConfig[K]) => {
        onChange({ ...config, [key]: value });
    }

    // Helper to update taxable account
    const updateTaxable = (field: keyof typeof config.taxableAccount, value: number) => {
        onChange({
            ...config,
            taxableAccount: { ...config.taxableAccount, [field]: value }
        });
    }

    // Helper to update tax-deferred account
    const updateDeferred = (field: keyof typeof config.taxDeferredAccount, value: number) => {
        onChange({
            ...config,
            taxDeferredAccount: { ...config.taxDeferredAccount, [field]: value }
        });
    }

    // Helper to update Roth account
    const updateRoth = (field: keyof typeof config.rothAccount, value: number) => {
        onChange({
            ...config,
            rothAccount: { ...config.rothAccount, [field]: value }
        });
    }

    // Helper to update mortgage
    const updateMortgage = (field: keyof typeof config.mortgage, value: number) => {
        onChange({
            ...config,
            mortgage: { ...config.mortgage, [field]: value }
        });
    }

    // Helper to update other loan
    const updateOtherLoan = (field: keyof typeof config.otherLoan, value: number | string) => {
        onChange({
            ...config,
            otherLoan: { ...config.otherLoan, [field]: value }
        });
    }

    // Helper to update inheritance
    const updateInheritance = (field: keyof typeof config.inheritance, value: number | string) => {
        onChange({
            ...config,
            inheritance: { ...config.inheritance, [field]: value }
        });
    }

    // Helper to update tax strategy
    const updateTaxStrategy = (field: keyof typeof config.taxStrategy, value: string) => {
        onChange({
            ...config,
            taxStrategy: { ...config.taxStrategy, [field]: value }
        });
    }

    // Helper to update stress test
    const updateStressTest = (field: keyof typeof config.stressTest, value: number | boolean) => {
        onChange({
            ...config,
            stressTest: { ...config.stressTest, [field]: value }
        });
    }

    // Calculate net cash flow
    const netCashFlow = config.annualIncome - config.annualSpending;
    const totalSavings = config.savingsToTaxable + config.savingsTo401k + config.savingsToRoth;
    const isFullyAllocated = Math.abs(netCashFlow - totalSavings) < 100;

    // Calculate unrealized gains
    const stockGainPercent = config.taxableAccount.stocks > 0
        ? ((config.taxableAccount.stocks - config.taxableAccount.stockCostBasis) / config.taxableAccount.stockCostBasis * 100).toFixed(0)
        : "0";
    const bondGainPercent = config.taxableAccount.bonds > 0
        ? ((config.taxableAccount.bonds - config.taxableAccount.bondCostBasis) / config.taxableAccount.bondCostBasis * 100).toFixed(0)
        : "0";

    return (
        <Card className="h-full overflow-y-auto">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pb-8">
                <Accordion type="multiple" defaultValue={["personal", "assets"]} className="w-full space-y-2">

                    {/* ========== PERSONAL INFORMATION ========== */}
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
                                    <HelpTip content="The age at which you plan to retire and stop working income" />
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

                    {/* ========== ASSETS ========== */}
                    <AccordionItem value="assets" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                <span className="font-medium">Assets</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-2 pb-4">
                            {/* Taxable Account */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Taxable Account</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Stocks"
                                        value={config.taxableAccount.stocks}
                                        onChange={(v) => updateTaxable("stocks", v)}
                                        help="Value of stocks in your taxable brokerage account"
                                    />
                                    <CurrencyInput
                                        label="Bonds"
                                        value={config.taxableAccount.bonds}
                                        onChange={(v) => updateTaxable("bonds", v)}
                                        help="Value of bonds in your taxable brokerage account"
                                    />
                                    <CurrencyInput
                                        label="Cash"
                                        value={config.taxableAccount.cash}
                                        onChange={(v) => updateTaxable("cash", v)}
                                        help="Cash, money market, or savings in taxable accounts"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div>
                                        <CurrencyInput
                                            label="Stock Cost Basis"
                                            value={config.taxableAccount.stockCostBasis}
                                            onChange={(v) => updateTaxable("stockCostBasis", v)}
                                            help="What you originally paid for your stocks (for tax calculations)"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Unrealized Gain: {stockGainPercent}%</p>
                                    </div>
                                    <div>
                                        <CurrencyInput
                                            label="Bond Cost Basis"
                                            value={config.taxableAccount.bondCostBasis}
                                            onChange={(v) => updateTaxable("bondCostBasis", v)}
                                            help="What you originally paid for your bonds"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Unrealized Gain: {bondGainPercent}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tax-Deferred Account */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Tax-Deferred (401k/IRA)</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Stocks"
                                        value={config.taxDeferredAccount.stocks}
                                        onChange={(v) => updateDeferred("stocks", v)}
                                        help="Stocks in your 401k, Traditional IRA, or similar accounts"
                                    />
                                    <CurrencyInput
                                        label="Bonds"
                                        value={config.taxDeferredAccount.bonds}
                                        onChange={(v) => updateDeferred("bonds", v)}
                                        help="Bonds in tax-deferred accounts"
                                    />
                                    <CurrencyInput
                                        label="Cash"
                                        value={config.taxDeferredAccount.cash}
                                        onChange={(v) => updateDeferred("cash", v)}
                                        help="Cash or stable value funds in tax-deferred accounts"
                                    />
                                </div>
                            </div>

                            {/* Tax-Free (Roth) Account */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Tax-Free (Roth)</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Stocks"
                                        value={config.rothAccount.stocks}
                                        onChange={(v) => updateRoth("stocks", v)}
                                        help="Stocks in your Roth IRA or Roth 401k"
                                    />
                                    <CurrencyInput
                                        label="Bonds"
                                        value={config.rothAccount.bonds}
                                        onChange={(v) => updateRoth("bonds", v)}
                                        help="Bonds in Roth accounts"
                                    />
                                    <CurrencyInput
                                        label="Cash"
                                        value={config.rothAccount.cash}
                                        onChange={(v) => updateRoth("cash", v)}
                                        help="Cash in Roth accounts"
                                    />
                                </div>
                            </div>

                            {/* Real Estate & Other */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Real Estate & Other</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Primary Home"
                                        value={config.primaryHome}
                                        onChange={(v) => updateConfig("primaryHome", v)}
                                        help="Current market value of your primary residence"
                                    />
                                    <CurrencyInput
                                        label="Investment Property"
                                        value={config.investmentProperty}
                                        onChange={(v) => updateConfig("investmentProperty", v)}
                                        help="Value of rental or investment real estate"
                                    />
                                    <CurrencyInput
                                        label="Other Assets"
                                        value={config.otherAssets}
                                        onChange={(v) => updateConfig("otherAssets", v)}
                                        help="Vehicles, collectibles, business equity, etc."
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== LIABILITIES ========== */}
                    <AccordionItem value="liabilities" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-red-500" />
                                <span className="font-medium">Liabilities</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-2 pb-4">
                            {/* Mortgage */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Mortgage</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Balance"
                                        value={config.mortgage.balance}
                                        onChange={(v) => updateMortgage("balance", v)}
                                        help="Remaining balance on your mortgage"
                                    />
                                    <PercentInput
                                        label="Interest Rate"
                                        value={config.mortgage.interestRate}
                                        onChange={(v) => updateMortgage("interestRate", v)}
                                        help="Annual interest rate on your mortgage"
                                    />
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Remaining Term: {config.mortgage.remainingYears} years
                                            <HelpTip content="Years left on your mortgage" />
                                        </Label>
                                        <Slider
                                            value={[config.mortgage.remainingYears]}
                                            min={1} max={30} step={1}
                                            onValueChange={(vals) => updateMortgage("remainingYears", vals[0])}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Other Loans */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Other Loans / Margin</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Balance"
                                        value={config.otherLoan.balance}
                                        onChange={(v) => updateOtherLoan("balance", v)}
                                        help="Balance of other loans, credit cards, or margin debt"
                                    />
                                    <PercentInput
                                        label="Interest Rate"
                                        value={config.otherLoan.interestRate}
                                        onChange={(v) => updateOtherLoan("interestRate", v)}
                                        help="Average interest rate on other debt"
                                    />
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Payback Strategy
                                            <HelpTip content="How you plan to pay off this debt" />
                                        </Label>
                                        <Select
                                            value={config.otherLoan.paybackStrategy}
                                            onValueChange={(v) => updateOtherLoan("paybackStrategy", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="interest_only">Interest Only (Forever)</SelectItem>
                                                <SelectItem value="pay_at_retirement">Pay Off at Retirement</SelectItem>
                                                <SelectItem value="amortized">Amortized Loan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== CASH FLOW ========== */}
                    <AccordionItem value="cashflow" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">Cash Flow</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-2 pb-4">
                            {/* Pre-Retirement Budget */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Pre-Retirement Budget</h4>
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

                                {/* Net Cash Flow Display */}
                                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Net Cash Flow</span>
                                        <span className={`font-semibold ${netCashFlow >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {netCashFlow >= 0 ? '+' : ''}{settings.currency.symbol}{formatCurrency(netCashFlow)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Allocate this surplus to your savings accounts below:
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${isFullyAllocated ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                        {isFullyAllocated ? 'Fully Allocated' : 'Not Fully Allocated'}
                                    </span>
                                </div>

                                {/* Savings Allocation */}
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="To Taxable"
                                        value={config.savingsToTaxable}
                                        onChange={(v) => updateConfig("savingsToTaxable", v)}
                                        help="Annual contributions to taxable brokerage"
                                    />
                                    <CurrencyInput
                                        label="To 401k/IRA"
                                        value={config.savingsTo401k}
                                        onChange={(v) => updateConfig("savingsTo401k", v)}
                                        help="Annual contributions to tax-deferred accounts"
                                    />
                                    <CurrencyInput
                                        label="To Roth"
                                        value={config.savingsToRoth}
                                        onChange={(v) => updateConfig("savingsToRoth", v)}
                                        help="Annual contributions to Roth accounts"
                                    />
                                </div>
                            </div>

                            {/* Post-Retirement Spending */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Post-Retirement Spending</h4>
                                <p className="text-xs text-muted-foreground">
                                    Retirement spending typically follows two phases: active "Go-Go" years with higher spending, followed by "Slow-Go" years with reduced activity.
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <CurrencyInput
                                            label="Go-Go Years Spending"
                                            value={config.goGoSpending}
                                            onChange={(v) => updateConfig("goGoSpending", v)}
                                            help="Annual spending during active retirement (travel, hobbies)"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Active retirement (travel, hobbies)</p>
                                    </div>
                                    <div>
                                        <CurrencyInput
                                            label="Slow-Go Years Spending"
                                            value={config.slowGoSpending}
                                            onChange={(v) => updateConfig("slowGoSpending", v)}
                                            help="Annual spending during reduced activity phase"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Reduced activity phase</p>
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
                                        <p className="text-xs text-muted-foreground">When Go-Go becomes Slow-Go</p>
                                    </div>
                                </div>
                            </div>

                            {/* Pension / Social Security */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Pension / Social Security</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Start Age: {config.pensionStartAge}
                                            <HelpTip content="Age when you start receiving pension or Social Security" />
                                        </Label>
                                        <Slider
                                            value={[config.pensionStartAge]}
                                            min={62} max={75} step={1}
                                            onValueChange={(vals) => updateConfig("pensionStartAge", vals[0])}
                                        />
                                    </div>
                                    <CurrencyInput
                                        label="Annual Amount"
                                        value={config.pensionAmount}
                                        onChange={(v) => updateConfig("pensionAmount", v)}
                                        help="Expected annual pension or Social Security income (in today's dollars)"
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== INHERITANCE FLOWS ========== */}
                    <AccordionItem value="inheritance" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Gift className="h-4 w-4 text-purple-500" />
                                <span className="font-medium">Inheritance Flows</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pt-2 pb-4">
                            {/* Receive Inheritance */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Receive Inheritance</h4>
                                <p className="text-xs text-muted-foreground">
                                    Expected inheritance in today's dollars. Will be inflation-adjusted automatically.
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Amount"
                                        value={config.inheritance.receiveAmount}
                                        onChange={(v) => updateInheritance("receiveAmount", v)}
                                        help="Expected inheritance amount"
                                    />
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Age Received: {config.inheritance.receiveAge || "Not set"}
                                            <HelpTip content="Age when you expect to receive the inheritance" />
                                        </Label>
                                        <Slider
                                            value={[config.inheritance.receiveAge]}
                                            min={config.currentAge} max={config.lifeExpectancy} step={1}
                                            onValueChange={(vals) => updateInheritance("receiveAge", vals[0])}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Asset Type
                                            <HelpTip content="What form the inheritance will take" />
                                        </Label>
                                        <Select
                                            value={config.inheritance.receiveAssetType}
                                            onValueChange={(v) => updateInheritance("receiveAssetType", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="liquid">Liquid Portfolio</SelectItem>
                                                <SelectItem value="property">Investment Property</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Give Gift */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Give Gift to Children</h4>
                                <p className="text-xs text-muted-foreground">
                                    Amount you plan to give in today's dollars.
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    <CurrencyInput
                                        label="Amount"
                                        value={config.inheritance.giveAmount}
                                        onChange={(v) => updateInheritance("giveAmount", v)}
                                        help="Amount you plan to gift"
                                    />
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Age Given: {config.inheritance.giveAge || "Not set"}
                                            <HelpTip content="Age when you plan to give the gift" />
                                        </Label>
                                        <Slider
                                            value={[config.inheritance.giveAge]}
                                            min={config.currentAge} max={config.lifeExpectancy} step={1}
                                            onValueChange={(vals) => updateInheritance("giveAge", vals[0])}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="flex items-center text-sm">
                                            Asset Type
                                            <HelpTip content="What form the gift will take" />
                                        </Label>
                                        <Select
                                            value={config.inheritance.giveAssetType}
                                            onValueChange={(v) => updateInheritance("giveAssetType", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="liquid">Liquid Portfolio</SelectItem>
                                                <SelectItem value="home">Primary Home</SelectItem>
                                                <SelectItem value="other">Other Assets</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== MARKET ASSUMPTIONS ========== */}
                    <AccordionItem value="market" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-cyan-500" />
                                <span className="font-medium">Market Assumptions</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2 pb-4">
                            <div className="grid grid-cols-2 gap-3">
                                <PercentInput
                                    label="Stock Return"
                                    value={config.stockReturn}
                                    onChange={(v) => updateConfig("stockReturn", v)}
                                    help="Expected annual return on stocks (7% is historical average)"
                                />
                                <PercentInput
                                    label="Bond Return"
                                    value={config.bondReturn}
                                    onChange={(v) => updateConfig("bondReturn", v)}
                                    help="Expected annual return on bonds"
                                />
                                <PercentInput
                                    label="Cash Return"
                                    value={config.cashReturn}
                                    onChange={(v) => updateConfig("cashReturn", v)}
                                    help="Expected return on cash and money market"
                                />
                                <PercentInput
                                    label="Inflation"
                                    value={config.inflationRate}
                                    onChange={(v) => updateConfig("inflationRate", v)}
                                    help="Expected annual inflation rate"
                                />
                                <PercentInput
                                    label="Dividend Yield"
                                    value={config.dividendYield}
                                    onChange={(v) => updateConfig("dividendYield", v)}
                                    help="Expected dividend yield on stocks"
                                />
                                <PercentInput
                                    label="Home Appreciation"
                                    value={config.homeAppreciation}
                                    onChange={(v) => updateConfig("homeAppreciation", v)}
                                    help="Expected annual home value appreciation"
                                />
                                <PercentInput
                                    label="Property Appreciation"
                                    value={config.propertyAppreciation}
                                    onChange={(v) => updateConfig("propertyAppreciation", v)}
                                    help="Expected annual investment property appreciation"
                                />
                                <PercentInput
                                    label="Rental Yield"
                                    value={config.rentalYield}
                                    onChange={(v) => updateConfig("rentalYield", v)}
                                    help="Expected annual rental income as % of property value"
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== TAX STRATEGY ========== */}
                    <AccordionItem value="tax" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-amber-500" />
                                <span className="font-medium">Tax Strategy</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="grid gap-1.5">
                                <Label className="flex items-center text-sm">
                                    Tax Region
                                    <HelpTip content="Select your country/region for accurate tax calculations including income tax brackets, capital gains, and RMD rules" />
                                </Label>
                                <Select
                                    value={config.taxStrategy.country || 'US'}
                                    onValueChange={(v) => updateTaxStrategy("country", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="US">United States (Federal)</SelectItem>
                                        <SelectItem value="US_TX">United States (Texas)</SelectItem>
                                        <SelectItem value="US_CA">United States (California)</SelectItem>
                                        <SelectItem value="US_NY">United States (New York)</SelectItem>
                                        <SelectItem value="UK">United Kingdom</SelectItem>
                                        <SelectItem value="IE">Ireland</SelectItem>
                                        <SelectItem value="AU">Australia</SelectItem>
                                        <SelectItem value="CA">Canada</SelectItem>
                                        <SelectItem value="DE">Germany</SelectItem>
                                        <SelectItem value="FR">France</SelectItem>
                                        <SelectItem value="ES">Spain</SelectItem>
                                        <SelectItem value="CH">Switzerland</SelectItem>
                                        <SelectItem value="SG">Singapore</SelectItem>
                                        <SelectItem value="AE">UAE</SelectItem>
                                        <SelectItem value="CY">Cyprus</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="flex items-center text-sm">
                                    Withdrawal Strategy
                                    <HelpTip content="Order in which to withdraw from accounts in retirement" />
                                </Label>
                                <Select
                                    value={config.taxStrategy.withdrawalStrategy}
                                    onValueChange={(v) => updateTaxStrategy("withdrawalStrategy", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="standard">Standard (Taxable → Deferred → Free)</SelectItem>
                                        <SelectItem value="tax_sensitive">Tax Sensitive (Optimized)</SelectItem>
                                        <SelectItem value="pro_rata">Pro-Rata (Proportional)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="flex items-center text-sm">
                                    Roth Conversion Strategy
                                    <HelpTip content="Strategy for converting tax-deferred to Roth" />
                                </Label>
                                <Select
                                    value={config.taxStrategy.rothConversionStrategy}
                                    onValueChange={(v) => updateTaxStrategy("rothConversionStrategy", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="fill_bracket">Fill Tax Bracket</SelectItem>
                                        <SelectItem value="fixed_amount">Fixed Annual Amount</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ========== RISK & STRESS TESTING ========== */}
                    <AccordionItem value="risk" className="border rounded-lg px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                <span className="font-medium">Risk & Stress Testing</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2 pb-4">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm border-b pb-1">Stress Test</h4>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="stressTestEnabled"
                                        checked={config.stressTest.enabled}
                                        onChange={(e) => updateStressTest("enabled", e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="stressTestEnabled" className="text-sm cursor-pointer">
                                        Enable Stress Test Scenario
                                    </Label>
                                </div>

                                {config.stressTest.enabled && (
                                    <div className="grid grid-cols-1 gap-3 pt-2">
                                        <div className="grid gap-1.5">
                                            <Label className="flex items-center text-sm">
                                                Crash Age: {config.stressTest.crashAge}
                                                <HelpTip content="Age when a market crash occurs" />
                                            </Label>
                                            <Slider
                                                value={[config.stressTest.crashAge]}
                                                min={config.currentAge} max={config.lifeExpectancy} step={1}
                                                onValueChange={(vals) => updateStressTest("crashAge", vals[0])}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="flex items-center text-sm">
                                                Market Drop: {config.stressTest.marketDropPercent}%
                                                <HelpTip content="How much the market drops in the crash" />
                                            </Label>
                                            <Slider
                                                value={[config.stressTest.marketDropPercent]}
                                                min={10} max={60} step={5}
                                                onValueChange={(vals) => updateStressTest("marketDropPercent", vals[0])}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="flex items-center text-sm">
                                                Recovery Years: {config.stressTest.recoveryYears}
                                                <HelpTip content="How many years until the market recovers" />
                                            </Label>
                                            <Slider
                                                value={[config.stressTest.recoveryYears]}
                                                min={1} max={10} step={1}
                                                onValueChange={(vals) => updateStressTest("recoveryYears", vals[0])}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="flexibleSpending"
                                                checked={config.stressTest.flexibleSpending}
                                                onChange={(e) => updateStressTest("flexibleSpending", e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <Label htmlFor="flexibleSpending" className="text-sm cursor-pointer flex items-center">
                                                Flexible Spending?
                                                <HelpTip content="Reduce spending by 20% during crash recovery" />
                                            </Label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </CardContent>
        </Card>
    )
}
