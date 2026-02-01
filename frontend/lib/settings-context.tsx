"use client"

import * as React from "react"

export interface Currency {
    code: string
    name: string
    symbol: string
    locale: string
}

export const CURRENCIES: Currency[] = [
    { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
    { code: "EUR", name: "Euro", symbol: "\u20AC", locale: "de-DE" },
    { code: "GBP", name: "British Pound", symbol: "\u00A3", locale: "en-GB" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
    { code: "JPY", name: "Japanese Yen", symbol: "\u00A5", locale: "ja-JP" },
    { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
    { code: "CNY", name: "Chinese Yuan", symbol: "\u00A5", locale: "zh-CN" },
    { code: "INR", name: "Indian Rupee", symbol: "\u20B9", locale: "en-IN" },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
    { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", locale: "zh-HK" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ" },
    { code: "SEK", name: "Swedish Krona", symbol: "kr", locale: "sv-SE" },
    { code: "NOK", name: "Norwegian Krone", symbol: "kr", locale: "nb-NO" },
    { code: "DKK", name: "Danish Krone", symbol: "kr", locale: "da-DK" },
    { code: "AED", name: "UAE Dirham", symbol: "\u062F.\u0625", locale: "ar-AE" },
    { code: "SAR", name: "Saudi Riyal", symbol: "\u0631.\u0633", locale: "ar-SA" },
    { code: "KRW", name: "South Korean Won", symbol: "\u20A9", locale: "ko-KR" },
    { code: "BRL", name: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
    { code: "MXN", name: "Mexican Peso", symbol: "$", locale: "es-MX" },
    { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA" },
    { code: "THB", name: "Thai Baht", symbol: "\u0E3F", locale: "th-TH" },
    { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", locale: "ms-MY" },
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID" },
    { code: "PHP", name: "Philippine Peso", symbol: "\u20B1", locale: "fil-PH" },
    { code: "PLN", name: "Polish Zloty", symbol: "z\u0142", locale: "pl-PL" },
    { code: "TRY", name: "Turkish Lira", symbol: "\u20BA", locale: "tr-TR" },
    { code: "RUB", name: "Russian Ruble", symbol: "\u20BD", locale: "ru-RU" },
    { code: "ILS", name: "Israeli Shekel", symbol: "\u20AA", locale: "he-IL" },
]

export interface ExchangeRates {
    base: string
    rates: Record<string, number>
    lastUpdated: string
}

export interface AppSettings {
    currency: Currency
    dateFormat: string
    numberFormat: string
}

const DEFAULT_SETTINGS: AppSettings = {
    currency: CURRENCIES[0], // USD
    dateFormat: "MM/DD/YYYY",
    numberFormat: "1,234.56",
}

interface SettingsContextType {
    settings: AppSettings
    exchangeRates: ExchangeRates | null
    isLoadingRates: boolean
    updateCurrency: (currencyCode: string) => void
    updateSettings: (newSettings: Partial<AppSettings>) => void
    formatCurrency: (valueInUSD: number) => string
    formatCompactCurrency: (valueInUSD: number) => string
    convertFromUSD: (valueInUSD: number) => number
    refreshExchangeRates: () => Promise<void>
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined)

const STORAGE_KEY = "networth-pro-settings"
const RATES_STORAGE_KEY = "networth-pro-exchange-rates"
const RATES_CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

// Fallback exchange rates (approximate, updated periodically)
const FALLBACK_RATES: ExchangeRates = {
    base: "USD",
    rates: {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CAD: 1.36,
        AUD: 1.53,
        CHF: 0.88,
        CNY: 7.24,
        INR: 83.12,
        SGD: 1.34,
    },
    lastUpdated: new Date().toISOString(),
}

// Fetch exchange rates from Frankfurter API (free, no API key required)
async function fetchExchangeRates(): Promise<ExchangeRates> {
    try {
        const currencies = CURRENCIES.map(c => c.code).filter(c => c !== "USD").join(",")
        const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currencies}`, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
        })

        if (!response.ok) {
            console.warn("Exchange rate API returned non-OK status, using fallback rates")
            return FALLBACK_RATES
        }

        const data = await response.json()
        return {
            base: "USD",
            rates: { USD: 1, ...data.rates },
            lastUpdated: new Date().toISOString(),
        }
    } catch (error) {
        // Network error, timeout, or other fetch failure - use fallback rates
        console.warn("Failed to fetch exchange rates, using fallback rates:", error)
        return FALLBACK_RATES
    }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS)
    const [exchangeRates, setExchangeRates] = React.useState<ExchangeRates | null>(null)
    const [isLoadingRates, setIsLoadingRates] = React.useState(false)
    const [isLoaded, setIsLoaded] = React.useState(false)

    // Load settings and cached rates from localStorage on mount
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                const currency = CURRENCIES.find(c => c.code === parsed.currencyCode) || CURRENCIES[0]
                setSettings({
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    currency,
                })
            }

            // Load cached exchange rates
            const cachedRates = localStorage.getItem(RATES_STORAGE_KEY)
            if (cachedRates) {
                const parsed = JSON.parse(cachedRates) as ExchangeRates
                const lastUpdated = new Date(parsed.lastUpdated).getTime()
                const now = Date.now()

                // Use cached rates if less than 1 hour old
                if (now - lastUpdated < RATES_CACHE_DURATION) {
                    setExchangeRates(parsed)
                }
            }
        } catch (error) {
            console.error("Failed to load settings:", error)
        }
        setIsLoaded(true)
    }, [])

    // Fetch exchange rates on mount and when needed
    const refreshExchangeRates = React.useCallback(async () => {
        setIsLoadingRates(true)
        try {
            const rates = await fetchExchangeRates()
            setExchangeRates(rates)
            localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates))
        } catch (error) {
            console.error("Failed to fetch exchange rates:", error)
        } finally {
            setIsLoadingRates(false)
        }
    }, [])

    // Fetch rates on initial load if not cached or expired
    React.useEffect(() => {
        if (isLoaded && !exchangeRates) {
            refreshExchangeRates()
        }
    }, [isLoaded, exchangeRates, refreshExchangeRates])

    // Save settings to localStorage when they change
    React.useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    currencyCode: settings.currency.code,
                    dateFormat: settings.dateFormat,
                    numberFormat: settings.numberFormat,
                }))
            } catch (error) {
                console.error("Failed to save settings:", error)
            }
        }
    }, [settings, isLoaded])

    const updateCurrency = React.useCallback((currencyCode: string) => {
        const currency = CURRENCIES.find(c => c.code === currencyCode)
        if (currency) {
            setSettings(prev => ({ ...prev, currency }))
        }
    }, [])

    const updateSettings = React.useCallback((newSettings: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }))
    }, [])

    // Convert USD value to selected currency
    const convertFromUSD = React.useCallback((valueInUSD: number): number => {
        if (settings.currency.code === "USD" || !exchangeRates) {
            return valueInUSD
        }
        const rate = exchangeRates.rates[settings.currency.code]
        if (!rate) {
            return valueInUSD
        }
        return valueInUSD * rate
    }, [settings.currency.code, exchangeRates])

    const formatCurrency = React.useCallback((valueInUSD: number) => {
        const convertedValue = convertFromUSD(valueInUSD)
        return new Intl.NumberFormat(settings.currency.locale, {
            style: "currency",
            currency: settings.currency.code,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(convertedValue)
    }, [settings.currency, convertFromUSD])

    const formatCompactCurrency = React.useCallback((valueInUSD: number) => {
        const convertedValue = convertFromUSD(valueInUSD)
        const absValue = Math.abs(convertedValue)
        const sign = convertedValue < 0 ? "-" : ""

        if (absValue >= 1000000) {
            return `${sign}${settings.currency.symbol}${(absValue / 1000000).toFixed(1)}M`
        }
        if (absValue >= 1000) {
            return `${sign}${settings.currency.symbol}${(absValue / 1000).toFixed(0)}K`
        }
        return `${sign}${settings.currency.symbol}${absValue.toFixed(0)}`
    }, [settings.currency, convertFromUSD])

    return (
        <SettingsContext.Provider value={{
            settings,
            exchangeRates,
            isLoadingRates,
            updateCurrency,
            updateSettings,
            formatCurrency,
            formatCompactCurrency,
            convertFromUSD,
            refreshExchangeRates,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = React.useContext(SettingsContext)
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider")
    }
    return context
}
