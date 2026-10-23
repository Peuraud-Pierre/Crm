import {
    buildGenTypesUrl,
    getAccessToken,
} from "@/features/manager/services/genTypesService"
import { Button } from "@/shared/ui/atoms/button"
import { Download, Copy, Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function GenTypes() {
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [schema, setSchema] = useState("public")

    const fetchTypes = async () => {
        setLoading(true)
        setPreview(null)
        try {
            const token = await getAccessToken()
            if (!token) throw new Error("Non authentifié")

            const url = buildGenTypesUrl(schema)

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || "Erreur backend")
            }

            const content = await res.text()
            setPreview(content)
            toast.success("Types générés avec succès")
        } catch (error) {
            console.error("GenTypes error:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : "Erreur lors de la génération des types"
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = () => {
        if (!preview) return
        const blob = new Blob([preview], { type: "application/typescript" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "types.ts"
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleCopy = async () => {
        if (!preview) return
        await navigator.clipboard.writeText(preview)
        setCopied(true)
        toast.success("Copié dans le presse-papier")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold mb-2">
                    Générateur de types TypeScript
                </h2>
                <p className="text-sm text-muted-foreground">
                    Génère les interfaces TypeScript (Row, Insert, Update) à
                    partir du schéma PostgreSQL.
                </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-1 w-full sm:w-auto">
                    <label
                        htmlFor="schema-select"
                        className="text-sm font-medium"
                    >
                        Schéma
                    </label>
                    <select
                        id="schema-select"
                        value={schema}
                        onChange={(e) => setSchema(e.target.value)}
                        className="flex h-9 w-full sm:w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="public">public</option>
                        <option value="auth">auth</option>
                        <option value="storage">storage</option>
                    </select>
                </div>

                <Button
                    onClick={fetchTypes}
                    loading={loading}
                    className="w-full sm:w-auto"
                >
                    {!loading && <Download className="w-4 h-4 mr-2" />}
                    {loading ? "Génération…" : "Générer les types"}
                </Button>
            </div>

            {preview && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            types.ts
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 mr-1" />
                                ) : (
                                    <Copy className="w-4 h-4 mr-1" />
                                )}
                                {copied ? "Copié" : "Copier"}
                            </Button>
                            <Button size="sm" onClick={handleDownload}>
                                <Download className="w-4 h-4 mr-1" />
                                Télécharger
                            </Button>
                        </div>
                    </div>
                    <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted p-4 text-xs font-mono">
                        {preview}
                    </pre>
                </div>
            )}
        </div>
    )
}
