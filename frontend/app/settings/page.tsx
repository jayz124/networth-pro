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
import { resetDatabase, exportData, importData, fetchAppSettings, updateAppSetting, AppSetting, fetchAIProviders, AIProviderInfo } from "@/lib/api"
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
    Eye,
    EyeOff,
    Sparkles,
    Home,
    ExternalLink,
} from "lucide-react"
import { useRouter } from "next/navigation"

type ToastType = "success" | "error" | "info"

interface Toast {
    id: number
    type: ToastType
    message: string
}

// Setting key for each provider's API key
const PROVIDER_KEY_MAP: Record<string, string> = {
    groq: "groq_api_key",
    openai: "openai_api_key",
    claude: "claude_api_key",
    kimi: "kimi_api_key",
    gemini: "gemini_api_key",
}

export default function SettingsPage() {
    const { settings, updateCurrency, exchangeRates, isLoadingRates, refreshExchangeRates } = useSettings()
    const router = useRouter()
    const [isResetting, setIsResetting] = React.useState(false)
    const [isExporting, setIsExporting] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // App settings
    const [appSettings, setAppSettings] = React.useState<AppSetting[]>([])
    const [isLoadingSettings, setIsLoadingSettings] = React.useState(true)

    // AI Providers
    const [providers, setProviders] = React.useState<AIProviderInfo[]>([])
    const [activeProvider, setActiveProvider] = React.useState("openai")
    const [activeModel, setActiveModel] = React.useState("")
    const [modelOverride, setModelOverride] = React.useState("")
    const [isSavingProvider, setIsSavingProvider] = React.useState(false)
    const [isSavingModel, setIsSavingModel] = React.useState(false)

    // Per-provider key inputs
    const [providerKeys, setProviderKeys] = React.useState<Record<string, string>>({})
    const [showProviderKey, setShowProviderKey] = React.useState<Record<string, boolean>>({})
    const [savingProviderKey, setSavingProviderKey] = React.useState<Record<string, boolean>>({})

    // RentCast API Key
    const [rentcastKey, setRentcastKey] = React.useState("")
    const [showRentcastKey, setShowRentcastKey] = React.useState(false)
    const [isSavingRentcast, setIsSavingRentcast] = React.useState(false)

    const loadAllSettings = React.useCallback(async () => {
        setIsLoadingSettings(true)
        const [settings, providerData] = await Promise.all([
            fetchAppSettings(),
            fetchAIProviders(),
        ])
        setAppSettings(settings)

        // Load provider keys from settings
        const keys: Record<string, string> = {}
        for (const [providerId, settingKey] of Object.entries(PROVIDER_KEY_MAP)) {
            const s = settings.find(s => s.key === settingKey)
            if (s?.is_set) {
                keys[providerId] = s.value || ""
            }
        }
        setProviderKeys(keys)

        // Load RentCast key
        const rentcastSetting = settings.find(s => s.key === "rentcast_api_key")
        if (rentcastSetting?.is_set) {
            setRentcastKey(rentcastSetting.value || "")
        }

        // Load AI provider info
        if (providerData) {
            setProviders(providerData.providers)
            setActiveProvider(providerData.active_provider)
            setActiveModel(providerData.active_model || "")

            // Check if there's a model override
            const modelSetting = settings.find(s => s.key === "ai_model")
            setModelOverride(modelSetting?.value || "")
        }

        setIsLoadingSettings(false)
    }, [])

    React.useEffect(() => {
        loadAllSettings()
    }, [loadAllSettings])

    const handleSaveProviderKey = async (providerId: string) => {
        const key = providerKeys[providerId]?.trim()
        if (!key) return
        const settingKey = PROVIDER_KEY_MAP[providerId]
        if (!settingKey) return

        setSavingProviderKey(prev => ({ ...prev, [providerId]: true }))
        try {
            const result = await updateAppSetting(settingKey, key)
            if (result) {
                const providerName = providers.find(p => p.id === providerId)?.name || providerId
                showToast("success", `${providerName} API key saved!`)
                setShowProviderKey(prev => ({ ...prev, [providerId]: false }))
                await loadAllSettings()
            } else {
                showToast("error", "Failed to save API key.")
            }
        } catch {
            showToast("error", "An unexpected error occurred.")
        } finally {
            setSavingProviderKey(prev => ({ ...prev, [providerId]: false }))
        }
    }

    const handleChangeProvider = async (value: string) => {
        setIsSavingProvider(true)
        try {
            const result = await updateAppSetting("ai_provider", value)
            if (result) {
                setActiveProvider(value)
                const providerName = providers.find(p => p.id === value)?.name || value
                showToast("success", `Switched to ${providerName}`)
                await loadAllSettings()
            } else {
                showToast("error", "Failed to update provider.")
            }
        } catch {
            showToast("error", "An unexpected error occurred.")
        } finally {
            setIsSavingProvider(false)
        }
    }

    const handleSaveModelOverride = async () => {
        setIsSavingModel(true)
        try {
            const result = await updateAppSetting("ai_model", modelOverride.trim() || "")
            if (result) {
                showToast("success", modelOverride.trim() ? "Model override saved!" : "Model override cleared (using default)")
                await loadAllSettings()
            } else {
                showToast("error", "Failed to save model override.")
            }
        } catch {
            showToast("error", "An unexpected error occurred.")
        } finally {
            setIsSavingModel(false)
        }
    }

    const handleSaveRentcastKey = async () => {
        if (!rentcastKey.trim()) return
        setIsSavingRentcast(true)
        try {
            const result = await updateAppSetting("rentcast_api_key", rentcastKey.trim())
            if (result) {
                showToast("success", "RentCast API key saved successfully!")
                await loadAllSettings()
                setShowRentcastKey(false)
            } else {
                showToast("error", "Failed to save API key. Please try again.")
            }
        } catch {
            showToast("error", "An unexpected error occurred.")
        } finally {
            setIsSavingRentcast(false)
        }
    }

    const getRentcastSetting = () => appSettings.find(s => s.key === "rentcast_api_key")

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
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const getProviderNote = (providerId: string) => {
        if (providerId === "groq") return "Free tier, no credit card"
        if (providerId === "kimi") return "No PDF/image parsing"
        if (providerId === "gemini") return "Free tier available"
        return null
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
                            ${toast.type === "success" ? "bg-success text-success-foreground" : ""}
                            ${toast.type === "error" ? "bg-destructive text-destructive-foreground" : ""}
                            ${toast.type === "info" ? "bg-info text-info-foreground" : ""}
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

                {/* AI Provider */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle>AI Provider</CardTitle>
                                <CardDescription>
                                    Choose which AI powers insights, categorization, and statement parsing
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoadingSettings ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading settings...
                            </div>
                        ) : (
                            <>
                                {/* Provider Selector */}
                                <div className="grid gap-2">
                                    <Label htmlFor="ai-provider">Active Provider</Label>
                                    <div className="flex gap-2 items-center">
                                        <Select
                                            value={activeProvider}
                                            onValueChange={handleChangeProvider}
                                            disabled={isSavingProvider}
                                        >
                                            <SelectTrigger id="ai-provider" className="w-full md:w-80">
                                                <SelectValue placeholder="Select AI provider" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {providers.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        <span className="flex items-center gap-2">
                                                            <span>{p.name}</span>
                                                            {p.is_configured && (
                                                                <CheckCircle2 className="h-3 w-3 text-success" />
                                                            )}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {isSavingProvider && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                </div>

                                {/* Model Override */}
                                <div className="grid gap-2">
                                    <Label htmlFor="model-override">Model Override</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="model-override"
                                            placeholder={activeModel || "Using provider default"}
                                            value={modelOverride}
                                            onChange={(e) => setModelOverride(e.target.value)}
                                            className="w-full md:w-80 font-mono text-sm"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={handleSaveModelOverride}
                                            disabled={isSavingModel}
                                        >
                                            {isSavingModel ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Save"
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty to use the provider&apos;s default model. Current: <code className="bg-muted px-1 py-0.5 rounded">{activeModel}</code>
                                    </p>
                                </div>

                                {/* API Keys Section */}
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium">API Keys</h4>
                                    <p className="text-xs text-muted-foreground">Configure keys for each provider. Only the active provider&apos;s key is used.</p>
                                </div>

                                <div className="space-y-3">
                                    {providers.map(provider => (
                                        <div
                                            key={provider.id}
                                            className={`p-4 border rounded-lg space-y-3 ${
                                                provider.id === activeProvider ? "border-primary/50 bg-primary/5" : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-3 w-3 rounded-full ${
                                                    provider.id === activeProvider && provider.is_configured
                                                        ? "bg-success"
                                                        : provider.is_configured
                                                        ? "bg-muted-foreground/30"
                                                        : "bg-muted-foreground/10 border border-muted-foreground/20"
                                                }`} />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-sm">{provider.name}</h4>
                                                        {provider.is_configured && (
                                                            <span className="text-xs text-success bg-success/10 px-1.5 py-0.5 rounded">
                                                                Configured
                                                            </span>
                                                        )}
                                                        {!provider.is_configured && (
                                                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                Not configured
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {getProviderNote(provider.id) && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                        provider.id === "gemini" || provider.id === "groq"
                                                            ? "text-success bg-success/10"
                                                            : "text-warning bg-warning/10"
                                                    }`}>
                                                        {getProviderNote(provider.id)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        type={showProviderKey[provider.id] ? "text" : "password"}
                                                        placeholder={provider.is_configured ? "Enter new key to update" : "Enter API key..."}
                                                        value={providerKeys[provider.id] || ""}
                                                        onChange={(e) => setProviderKeys(prev => ({
                                                            ...prev,
                                                            [provider.id]: e.target.value
                                                        }))}
                                                        className="pr-10 font-mono text-sm"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                        onClick={() => setShowProviderKey(prev => ({
                                                            ...prev,
                                                            [provider.id]: !prev[provider.id]
                                                        }))}
                                                    >
                                                        {showProviderKey[provider.id] ? (
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <Button
                                                    onClick={() => handleSaveProviderKey(provider.id)}
                                                    disabled={savingProviderKey[provider.id] || !providerKeys[provider.id]?.trim()}
                                                >
                                                    {savingProviderKey[provider.id] ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Save"
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <ExternalLink className="h-3 w-3" />
                                                <a
                                                    href={provider.key_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {provider.key_url.replace("https://", "")}
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Property Valuation API */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Home className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Property Valuation</CardTitle>
                                <CardDescription>
                                    Configure API keys for real estate property valuations
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* RentCast API Key */}
                        <div className="p-4 border rounded-lg space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                                    <Home className="h-5 w-5 text-success" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium">RentCast API Key</h4>
                                    <p className="text-sm text-muted-foreground">
                                        US property valuations, rent estimates, and property data (50 free calls/month)
                                    </p>
                                </div>
                                {getRentcastSetting()?.is_set && (
                                    <div className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded">
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
                                                type={showRentcastKey ? "text" : "password"}
                                                placeholder={getRentcastSetting()?.is_set ? "Enter new key to update" : "Your RentCast API key"}
                                                value={rentcastKey}
                                                onChange={(e) => setRentcastKey(e.target.value)}
                                                className="pr-10 font-mono text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                onClick={() => setShowRentcastKey(!showRentcastKey)}
                                            >
                                                {showRentcastKey ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleSaveRentcastKey}
                                            disabled={isSavingRentcast || !rentcastKey.trim()}
                                        >
                                            {isSavingRentcast ? (
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
                                        Free tier: 50 API calls/month. Sign up at{" "}
                                        <a
                                            href="https://www.rentcast.io/api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            rentcast.io/api
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10">
                                    <Download className="h-5 w-5 text-info" />
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                                    <Upload className="h-5 w-5 text-success" />
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
                                <span className="font-mono">1.3.6</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
