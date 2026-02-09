"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Upload,
    FileText,
    AlertCircle,
    CheckCircle2,
    Loader2,
    X,
    FileSpreadsheet,
    Image,
    Download,
    Sparkles,
} from "lucide-react"
import {
    parseStatement,
    importTransactions,
    getSupportedFormats,
    aiReviewTransactions,
    ParsedTransaction,
    BudgetCategory,
    SupportedFormatsResponse,
    ImportTransactionData,
} from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

interface StatementUploadProps {
    categories: BudgetCategory[]
    onImportComplete: () => void
}

type UploadState = "idle" | "uploading" | "parsed" | "importing" | "complete" | "error"

export function StatementUpload({ categories, onImportComplete }: StatementUploadProps) {
    const { formatCurrency } = useSettings()
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const [state, setState] = React.useState<UploadState>("idle")
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
    const [parsedTransactions, setParsedTransactions] = React.useState<ParsedTransaction[]>([])
    const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(new Set())
    const [categoryOverrides, setCategoryOverrides] = React.useState<Record<number, number>>({})
    const [errors, setErrors] = React.useState<string[]>([])
    const [warnings, setWarnings] = React.useState<string[]>([])
    const [bankDetected, setBankDetected] = React.useState<string | null>(null)
    const [supportedFormats, setSupportedFormats] = React.useState<SupportedFormatsResponse | null>(null)
    const [importResult, setImportResult] = React.useState<{ count: number } | null>(null)
    const [aiEnhanced, setAiEnhanced] = React.useState(false)
    const [aiReviewing, setAiReviewing] = React.useState(false)

    // Load supported formats
    React.useEffect(() => {
        getSupportedFormats().then(setSupportedFormats)
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            handleUpload(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) {
            setSelectedFile(file)
            handleUpload(file)
        }
    }

    const handleUpload = async (file: File) => {
        setState("uploading")
        setErrors([])
        setWarnings([])
        setParsedTransactions([])
        setSelectedIndices(new Set())
        setCategoryOverrides({})
        setBankDetected(null)

        const result = await parseStatement(file)

        if (!result || !result.success || result.transactions.length === 0) {
            setState("error")
            setErrors(result?.errors || ["Failed to parse statement"])
            setWarnings(result?.warnings || [])
            return
        }

        setParsedTransactions(result.transactions)
        setSelectedIndices(new Set(result.transactions.map((_, i) => i)))
        setBankDetected(result.bank_detected || null)
        setWarnings(result.warnings)
        setAiEnhanced(result.ai_enhanced || false)
        setState("parsed")
    }

    const handleAIReview = async () => {
        if (aiReviewing || parsedTransactions.length === 0) return

        setAiReviewing(true)
        const result = await aiReviewTransactions(parsedTransactions)

        if (result?.success && result.transactions) {
            setParsedTransactions(result.transactions)
            setAiEnhanced(true)
        } else if (result?.error) {
            setWarnings(prev => [...prev, result.error!])
        }

        setAiReviewing(false)
    }

    const handleToggleTransaction = (index: number) => {
        const newSelected = new Set(selectedIndices)
        if (newSelected.has(index)) {
            newSelected.delete(index)
        } else {
            newSelected.add(index)
        }
        setSelectedIndices(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedIndices.size === parsedTransactions.length) {
            setSelectedIndices(new Set())
        } else {
            setSelectedIndices(new Set(parsedTransactions.map((_, i) => i)))
        }
    }

    const handleCategoryChange = (index: number, categoryId: string) => {
        setCategoryOverrides({
            ...categoryOverrides,
            [index]: parseInt(categoryId),
        })
    }

    const handleImport = async () => {
        setState("importing")

        const transactionsToImport: ImportTransactionData[] = parsedTransactions
            .filter((_, i) => selectedIndices.has(i))
            .map((txn, i) => {
                const originalIndex = parsedTransactions.findIndex(t => t === txn)
                return {
                    date: txn.date,
                    description: txn.description,
                    amount: txn.amount,
                    category_id: categoryOverrides[originalIndex] ?? txn.suggested_category_id,
                    merchant: txn.merchant,
                    notes: `Imported from ${selectedFile?.name || 'statement'}`,
                }
            })

        const result = await importTransactions(transactionsToImport)

        if (result && result.success) {
            setState("complete")
            setImportResult({ count: result.imported_count })
            onImportComplete()
        } else {
            setState("error")
            setErrors(result?.errors || ["Failed to import transactions"])
        }
    }

    const handleReset = () => {
        setState("idle")
        setSelectedFile(null)
        setParsedTransactions([])
        setSelectedIndices(new Set())
        setCategoryOverrides({})
        setErrors([])
        setWarnings([])
        setBankDetected(null)
        setImportResult(null)
        setAiEnhanced(false)
        setAiReviewing(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const getFileIcon = (filename: string) => {
        const ext = filename.toLowerCase().split('.').pop()
        if (ext === 'csv' || ext === 'ofx' || ext === 'qfx') {
            return <FileSpreadsheet className="h-8 w-8 text-green-500" />
        }
        if (ext === 'pdf') {
            return <FileText className="h-8 w-8 text-red-500" />
        }
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) {
            return <Image className="h-8 w-8 text-blue-500" />
        }
        return <FileText className="h-8 w-8 text-muted-foreground" />
    }

    // Calculate totals for selected transactions
    const selectedTotal = parsedTransactions
        .filter((_, i) => selectedIndices.has(i))
        .reduce((sum, t) => sum + t.amount, 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Bank Statement
                </CardTitle>
                <CardDescription>
                    Upload a bank statement to automatically import transactions
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Idle State - Upload Area */}
                {state === "idle" && (
                    <div
                        className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.ofx,.qfx,.pdf,.png,.jpg,.jpeg,.gif,.webp"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm font-medium">
                            Drop a file here or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Supports CSV, OFX, QFX
                            {supportedFormats?.ai_available && ", PDF, and images"}
                        </p>
                        {!supportedFormats?.ai_available && (
                            <p className="text-xs text-yellow-600 mt-2">
                                Configure an AI provider in Settings for PDF/image support
                            </p>
                        )}
                    </div>
                )}

                {/* Uploading State */}
                {state === "uploading" && (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-sm font-medium">Parsing statement...</p>
                        {selectedFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {selectedFile.name}
                            </p>
                        )}
                    </div>
                )}

                {/* Error State */}
                {state === "error" && (
                    <div className="space-y-4">
                        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <p className="font-medium">Failed to parse statement</p>
                            </div>
                            <ul className="mt-2 text-sm text-destructive space-y-1">
                                {errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                ))}
                            </ul>
                        </div>
                        <Button onClick={handleReset} variant="outline" className="w-full">
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Parsed State - Review Transactions */}
                {state === "parsed" && parsedTransactions.length > 0 && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {selectedFile && getFileIcon(selectedFile.name)}
                                <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        {selectedFile?.name}
                                        {aiEnhanced && (
                                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                                <Sparkles className="h-3 w-3 mr-1" />
                                                AI Enhanced
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {parsedTransactions.length} transactions found
                                        {bankDetected && ` | ${bankDetected}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {supportedFormats?.ai_available && !aiEnhanced && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAIReview}
                                        disabled={aiReviewing}
                                    >
                                        {aiReviewing ? (
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-4 w-4 mr-1" />
                                        )}
                                        AI Review
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={handleReset}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Warnings */}
                        {warnings.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                    {warnings.length} warning(s): {warnings[0]}
                                    {warnings.length > 1 && ` (+${warnings.length - 1} more)`}
                                </p>
                            </div>
                        )}

                        {/* Transaction Table */}
                        <div className="border rounded-lg max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedIndices.size === parsedTransactions.length}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedTransactions.map((txn, i) => (
                                        <TableRow key={i} className={!selectedIndices.has(i) ? "opacity-50" : ""}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIndices.has(i)}
                                                    onCheckedChange={() => handleToggleTransaction(i)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-start gap-1">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate max-w-[200px]">
                                                            {txn.clean_description || txn.description}
                                                        </p>
                                                        {txn.merchant && (
                                                            <p className="text-xs text-muted-foreground">{txn.merchant}</p>
                                                        )}
                                                    </div>
                                                    {txn.ai_reviewed && (
                                                        <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0 mt-0.5" title="AI categorized" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={(categoryOverrides[i] ?? txn.suggested_category_id)?.toString() || ""}
                                                    onValueChange={(v) => handleCategoryChange(i, v)}
                                                >
                                                    <SelectTrigger className="h-8 w-[140px]">
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categories
                                                            .filter(c => txn.amount >= 0 ? c.is_income : !c.is_income)
                                                            .map((cat) => (
                                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                                    <span className="flex items-center gap-2">
                                                                        <span
                                                                            className="w-2 h-2 rounded-full"
                                                                            style={{ backgroundColor: cat.color || "#64748b" }}
                                                                        />
                                                                        {cat.name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${txn.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {formatCurrency(txn.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Import Summary */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                                <p className="text-sm font-medium">
                                    {selectedIndices.size} of {parsedTransactions.length} selected
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Net: {formatCurrency(selectedTotal)}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleReset}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={selectedIndices.size === 0}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Import {selectedIndices.size} Transactions
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Importing State */}
                {state === "importing" && (
                    <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-sm font-medium">Importing transactions...</p>
                    </div>
                )}

                {/* Complete State */}
                {state === "complete" && (
                    <div className="text-center py-8 space-y-4">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                        <div>
                            <p className="text-lg font-medium">Import Complete!</p>
                            <p className="text-sm text-muted-foreground">
                                {importResult?.count} transactions imported successfully
                            </p>
                        </div>
                        <Button onClick={handleReset}>
                            Import Another Statement
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
