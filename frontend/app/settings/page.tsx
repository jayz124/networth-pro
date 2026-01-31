"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { useSettings, CURRENCIES } from "@/lib/settings-context"
import { resetDatabase, exportData, importData, fetchAppSettings, updateAppSetting, AppSetting } from "@/lib/api"
import {
    Settings,
    Globe,
    Trash2,
    Download,
    Upload,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    Database,
    FileJson,
    RefreshCw,
    Key,
    Eye,
    EyeOff,
    Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"

type ToastType = "success" | "error" | "info"

interface Toast {
    id: number
    type: ToastType
    message: string
}

export default function SettingsPage() {
    const { settings, updateCurrency, exchangeRates, isLoadingRates, refreshExchangeRates } = useSettings()
    const router = useRouter()
    const [isResetting, setIsResetting] = React.useState(false)
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // API Key Settings
    const [appSettings, setAppSettings] = React.useState<AppSetting[]>([])
    const [isLoadingSettings, setIsLoadingSettings] = React.useState(true)
    const [openaiKey, setOpenaiKey] = React.useState("")
    const [showApiKey, setShowApiKey] = React.useState(false)
    const [isSavingKey, setIsSavingKey] = React.useState(false)

    // Load app settings
    React.useEffect(() => {
        const loadSettings = async () => {
            setIsLoadingSettings(true)
            const settings = await fetchAppSettings()
            setAppSettings(settings)
            // Find OpenAI key and set current value (masked)
            const openaiSetting = settings.find(s => s.key === "openai_api_key")
            if (openaiSetting?.is_set) {
                setOpenaiKey(openaiSetting.value || "")
            }
            setIsLoadingSettings(false)
        }
        loadSettings()
    }, [])

    const handleSaveOpenAIKey = async () => {
        if (!openaiKey.trim()) return
        setIsSavingKey(true)
        try {
            const result = await updateAppSetting("openai_api_key", openaiKey.trim())
            if (result) {
                showToast("success", "OpenAI API key saved successfully!")
                // Refresh settings to get masked value
                const settings = await fetchAppSettings()
                setAppSettings(settings)
                const openaiSetting = settings.find(s => s.key === "openai_api_key")
                if (openaiSetting?.is_set) {
                    setOpenaiKey(openaiSetting.value || "")
                }
                setShowApiKey(false)
            } else {
                showToast("error", "Failed to save API key. Please try again.")
            }
        } catch {
            showToast("error", "An unexpected error occurred.")
        } finally {
            setIsSavingKey(false)
        }
    }

    const getOpenAISetting = () => appSettings.find(s => s.key === "openai_api_key")

    const showToast = (type: ToastType, message: string) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }

    const handleResetDatabase = async () => {
        setIsResetting(true)
        try {
            const result = await resetDatabase()
            if (result.success) {
                showToast("success", "Database has been reset successfully. All data has been cleared.")
                // Refresh the page to reflect changes
                setTimeout(() => {
                    router.refresh()
                }, 1500)
            } else {
                showToast("error", result.message)
            }
        } catch {
            showToast("error", "An unexpected error occurred while resetting the database.")
        } finally {
            setIsResetting(false)
        }
    }

    const handleExportData = async () => {
        setIsExporting(true)
        try {
            const blob = await exportData()
            if (blob) {
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `networth-pro-backup-${new Date().toISOString().split("T")[0]}.json`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
                showToast("success", "Data exported successfully!")
            } else {
                showToast("error", "Failed to export data. Please try again.")
            }
        } catch {
            showToast("error", "An unexpected error occurred while exporting data.")
        } finally {
            setIsExporting(false)
        }
    }

    const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const result = await importData(file)
            if (result.success) {
                showToast("success", "Data imported successfully!")
                setTimeout(() => {
                    router.refresh()
                }, 1500)
            } else {
                showToast("error", result.message)
            }
        } catch {
            showToast("error", "An unexpected error occurred while importing data.")
        } finally {
            setIsImporting(false)
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    return (
        <div className="space-y-8">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right
                            ${toast.type === "success" ? "bg-emerald-500 text-white" : ""}
                            ${toast.type === "error" ? "bg-red-500 text-white" : ""}
                            ${toast.type === "info" ? "bg-blue-500 text-white" : ""}
                        `}
                    >
                        {toast.type === "success" && <CheckCircle2 className="h-4 w-4" />}
                        {toast.type === "error" && <XCircle className="h-4 w-4" />}
                        <span className="text-sm font-medium">{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your application preferences and data
                    </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <Settings className="h-5 w-5 text-accent" />
                </div>
            </div>

            <div className="grid gap-6">
                {/* Display Preferences */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Display Preferences</CardTitle>
                                <CardDescription>
                                    Customize how numbers and currencies are displayed
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Currency Selection */}
                        <div className="grid gap-2">
                            <Label htmlFor="currency">Default Currency</Label>
                            <Select
                                value={settings.currency.code}
                                onValueChange={updateCurrency}
                            >
                                <SelectTrigger id="currency" className="w-full md:w-80">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map(currency => (
                                        <SelectItem key={currency.code} value={currency.code}>
                                            <span className="flex items-center gap-2">
                                                <span className="font-mono text-muted-foreground w-8">
                                                    {currency.code}
                                                </span>
                                                <span>{currency.name}</span>
                                                <span className="text-muted-foreground ml-auto">
                                                    {currency.symbol}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                All values are stored in USD and converted using live exchange rates.
                            </p>
                        </div>

                        {/* Exchange Rate Info */}
                        {settings.currency.code !== "USD" && (
                            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium">Current Exchange Rate</h4>
                                        {exchangeRates && exchangeRates.rates[settings.currency.code] ? (
                                            <p className="text-2xl font-bold font-mono mt-1">
                                                1 USD = {exchangeRates.rates[settings.currency.code].toFixed(4)} {settings.currency.code}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {isLoadingRates ? "Loading rates..." : "Rate unavailable"}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={refreshExchangeRates}
                                        disabled={isLoadingRates}
                                    >
                                        {isLoadingRates ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        <span className="ml-2">Refresh</span>
                                    </Button>
                                </div>
                                {exchangeRates?.lastUpdated && (
                                    <p className="text-xs text-muted-foreground">
                                        Last updated: {new Date(exchangeRates.lastUpdated).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* API Keys / Integrations */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Key className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle>AI Integrations</CardTitle>
                                <CardDescription>
                                    Configure API keys for AI-powered features
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* OpenAI API Key */}
                        <div className="p-4 border rounded-lg space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                                    <Sparkles className="h-5 w-5 text-violet-500" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium">OpenAI API Key</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Required for AI-powered transaction categorization and spending insights
                                    </p>
                                </div>
                                {getOpenAISetting()?.is_set && (
                                    <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Configured
                                    </div>
                                )}
                            </div>

                            {isLoadingSettings ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading settings...
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                type={showApiKey ? "text" : "password"}
                                                placeholder={getOpenAISetting()?.is_set ? "Enter new key to update" : "sk-..."}
                                                value={openaiKey}
                                                onChange={(e) => setOpenaiKey(e.target.value)}
                                                className="pr-10 font-mono text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                            >
                                                {showApiKey ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleSaveOpenAIKey}
                                            disabled={isSavingKey || !openaiKey.trim()}
                                        >
                                            {isSavingKey ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                "Save"
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Your API key is stored securely and only used for budget AI features.
                                        Get your key from{" "}
                                        <a
                                            href="https://platform.openai.com/api-keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            platform.openai.com
                                        </a>
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Data Management */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Data Management</CardTitle>
                                <CardDescription>
                                    Export, import, or reset your financial data
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Export Data */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                                    <Download className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <h4 className="font-medium">Export Data</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Download all your financial data as a JSON file
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleExportData}
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Exporting...
                                    </>
                                ) : (
                                    <>
                                        <FileJson className="mr-2 h-4 w-4" />
                                        Export
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Import Data */}
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                                    <Upload className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h4 className="font-medium">Import Data</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Restore data from a previously exported JSON file
                                    </p>
                                </div>
                            </div>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportData}
                                    className="hidden"
                                    id="import-file"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImporting}
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Import
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Danger Zone - Reset Database */}
                        <div className="border border-destructive/50 rounded-lg">
                            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/50 rounded-t-lg">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <span className="text-sm font-medium text-destructive">Danger Zone</span>
                            </div>
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                                        <Trash2 className="h-5 w-5 text-destructive" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium">Reset Database</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Permanently delete all data and start fresh
                                        </p>
                                    </div>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isResetting}>
                                            {isResetting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Resetting...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Reset All Data
                                                </>
                                            )}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="flex items-center gap-2">
                                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                                Are you absolutely sure?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="space-y-2">
                                                <p>
                                                    This action <strong>cannot be undone</strong>. This will permanently delete:
                                                </p>
                                                <ul className="list-disc list-inside space-y-1 text-sm">
                                                    <li>All portfolios and holdings</li>
                                                    <li>All accounts and balances</li>
                                                    <li>All liabilities</li>
                                                    <li>All real estate properties and mortgages</li>
                                                    <li>All historical net worth data</li>
                                                </ul>
                                                <p className="pt-2 font-medium">
                                                    Consider exporting your data first as a backup.
                                                </p>
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleResetDatabase}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Yes, delete everything
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* App Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">About</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Application</span>
                                <span className="font-medium text-foreground">Networth Pro</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Version</span>
                                <span className="font-mono">1.3.5</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
