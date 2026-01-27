"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RetirementConfig } from "@/lib/retirement-logic"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type ConfigSidebarProps = {
    config: RetirementConfig;
    onChange: (config: RetirementConfig) => void;
}

export function ConfigSidebar({ config, onChange }: ConfigSidebarProps) {

    const handleChange = (key: keyof RetirementConfig, value: number) => {
        onChange({ ...config, [key]: value });
    }

    return (
        <Card className="h-full overflow-y-auto">
            <CardHeader>
                <CardTitle>Plan Configuration</CardTitle>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible defaultValue="personal" className="w-full">
                    {/* Personal Section */}
                    <AccordionItem value="personal">
                        <AccordionTrigger>Personal Infomation</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label htmlFor="currentAge">Current Age: {config.currentAge}</Label>
                                <Slider
                                    value={[config.currentAge]}
                                    min={18} max={90} step={1}
                                    onValueChange={(vals) => handleChange("currentAge", vals[0])}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="retirementAge">Retirement Age: {config.retirementAge}</Label>
                                <Slider
                                    value={[config.retirementAge]}
                                    min={config.currentAge} max={100} step={1}
                                    onValueChange={(vals) => handleChange("retirementAge", vals[0])}
                                    className="accent-emerald-500"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lifeExpectancy">Life Expectancy: {config.lifeExpectancy}</Label>
                                <Slider
                                    value={[config.lifeExpectancy]}
                                    min={70} max={110} step={1}
                                    onValueChange={(vals) => handleChange("lifeExpectancy", vals[0])}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Financials Section */}
                    <AccordionItem value="financials">
                        <AccordionTrigger>Financial Profile</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>Current Net Worth</Label>
                                <Input
                                    type="number"
                                    value={config.currentNetWorth}
                                    onChange={(e) => handleChange("currentNetWorth", Number(e.target.value))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Annual Income (Net)</Label>
                                <Input
                                    type="number"
                                    value={config.annualIncome}
                                    onChange={(e) => handleChange("annualIncome", Number(e.target.value))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Annual Expenses</Label>
                                <Input
                                    type="number"
                                    value={config.annualExpenses}
                                    onChange={(e) => handleChange("annualExpenses", Number(e.target.value))}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Assumptions Section */}
                    <AccordionItem value="assumptions">
                        <AccordionTrigger>Market Assumptions</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>Annual Return: {(config.investmentReturn * 100).toFixed(1)}%</Label>
                                <Slider
                                    value={[config.investmentReturn * 100]}
                                    min={0} max={15} step={0.1}
                                    onValueChange={(vals) => handleChange("investmentReturn", vals[0] / 100)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Inflation: {(config.inflationRate * 100).toFixed(1)}%</Label>
                                <Slider
                                    value={[config.inflationRate * 100]}
                                    min={0} max={10} step={0.1}
                                    onValueChange={(vals) => handleChange("inflationRate", vals[0] / 100)}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Retirement Spending */}
                    <AccordionItem value="retirement">
                        <AccordionTrigger>Retirement Spending</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>Annual Spend (Today's $)</Label>
                                <Input
                                    type="number"
                                    value={config.retirementSpending}
                                    onChange={(e) => handleChange("retirementSpending", Number(e.target.value))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Projected: ${Math.round(config.retirementSpending * Math.pow(1 + config.inflationRate, config.retirementAge - config.currentAge)).toLocaleString()} in future dollars
                                </p>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    )
}
