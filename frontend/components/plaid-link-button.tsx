"use client"

import React, { useState, useEffect, useCallback } from "react"
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { Building2, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

interface PlaidLinkButtonProps {
    onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isLinked, setIsLinked] = useState(false)

    // 1. Fetch Link Token
    useEffect(() => {
        const createLinkToken = async () => {
            try {
                // Determine API URL based on environment/proxy
                const apiUrl = "http://localhost:8000/api/plaid/create_link_token"

                const response = await fetch(apiUrl, { method: "POST" })
                const data = await response.json()
                setToken(data.link_token)
            } catch (error) {
                console.error("Error creating link token:", error)
                toast.error("Failed to initialize bank secure link.")
            }
        }
        createLinkToken()
    }, [])

    // 2. Handle Success (Public Token -> Access Token)
    const onSuccessCallback = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
        setIsLoading(true)
        try {
            // In production use proxy or environment var
            const apiUrl = "http://localhost:8000/api/plaid/exchange_public_token"

            await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ public_token }),
            })

            toast.success(`Successfully linked ${metadata.institution?.name}!`)
            setIsLinked(true)
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error("Error exchanging token:", error)
            toast.error("Failed to link account.")
        } finally {
            setIsLoading(false)
        }
    }, [onSuccess])

    const config: PlaidLinkOptions = {
        token,
        onSuccess: onSuccessCallback,
    }

    const { open, ready } = usePlaidLink(config)

    if (isLinked) {
        return (
            <Button variant="outline" disabled className="w-full sm:w-auto border-success/50 bg-success/10 text-success">
                <Check className="mr-2 h-4 w-4" />
                Account Linked
            </Button>
        )
    }

    return (
        <Button
            onClick={() => open()}
            disabled={!ready || isLoading}
            className="w-full sm:w-auto"
        >
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Building2 className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Linking..." : "Connect Bank Account"}
        </Button>
    )
}
