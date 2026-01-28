"use client"

import * as React from "react"

export type RetirementMode = "essential" | "pro"

interface RetirementModeContextType {
    mode: RetirementMode
    setMode: (mode: RetirementMode) => void
    isLoaded: boolean
}

const RetirementModeContext = React.createContext<RetirementModeContextType | undefined>(undefined)

const STORAGE_KEY = "networth-pro-retirement-mode"

export function RetirementModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setModeState] = React.useState<RetirementMode>("essential")
    const [isLoaded, setIsLoaded] = React.useState(false)

    // Load mode from localStorage on mount
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored === "essential" || stored === "pro") {
                setModeState(stored)
            }
        } catch (error) {
            console.error("Failed to load retirement mode:", error)
        }
        setIsLoaded(true)
    }, [])

    // Save mode to localStorage when it changes
    const setMode = React.useCallback((newMode: RetirementMode) => {
        setModeState(newMode)
        try {
            localStorage.setItem(STORAGE_KEY, newMode)
        } catch (error) {
            console.error("Failed to save retirement mode:", error)
        }
    }, [])

    return (
        <RetirementModeContext.Provider value={{ mode, setMode, isLoaded }}>
            {children}
        </RetirementModeContext.Provider>
    )
}

export function useRetirementMode() {
    const context = React.useContext(RetirementModeContext)
    if (context === undefined) {
        throw new Error("useRetirementMode must be used within a RetirementModeProvider")
    }
    return context
}
