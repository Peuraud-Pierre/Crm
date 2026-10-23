import { useState } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import { Mail, Loader2 } from "lucide-react"
import { useOutlookAuth } from "../hooks/useOutlookAuth"

export function OutlookConnectionButton() {
    const {
        connection,
        isConnected,
        isConnecting,
        isLoading,
        connectToOutlook,
        disconnectOutlook,
    } = useOutlookAuth()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showForm, setShowForm] = useState(false)

    if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" />
    }

    if (isConnected && connection) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="secondary">{connection.email}</Badge>
                <Button size="sm" variant="destructive" onClick={disconnectOutlook}>
                    Déconnecter
                </Button>
            </div>
        )
    }

    if (!showForm) {
        return (
            <Button onClick={() => setShowForm(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Connecter Outlook
            </Button>
        )
    }

    return (
        <div className="flex flex-col gap-2 w-64">
            <input
                placeholder="Email Outlook"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border p-2 rounded"
            />
            <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 rounded"
            />

            <Button
                loading={isConnecting}
                onClick={() => connectToOutlook(email, password)}
            >
                {isConnecting ? "Connexion…" : "Valider"}
            </Button>
        </div>
    )
}
