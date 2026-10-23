import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { safeRandomUUID } from "@/shared/lib/uuid"

const generateCode = () =>
    `ARV-${safeRandomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`

interface CreateCodeDialogProps {
    creating: boolean
    /** Retourne `true` en cas de succès — la modale se ferme alors seule. */
    onCreate: (code: string, label: string) => Promise<boolean>
}

/** Génération d'un code d'invitation. Extrait du Dialog inline de la page. */
export function CreateCodeDialog({ creating, onCreate }: CreateCodeDialogProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState("")
    const [label, setLabel] = useState("")

    const handleOpenChange = (next: boolean) => {
        if (!next && creating) return // ne pas couper une création en cours
        if (next) {
            setCode(generateCode())
            setLabel("")
        }
        setOpen(next)
    }

    const handleCreate = async () => {
        if (!code) return
        if (await onCreate(code, label)) setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Générer un code</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nouveau code d'invitation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="invitation-code">Code</Label>
                        <div className="flex gap-2">
                            <Input
                                id="invitation-code"
                                value={code}
                                onChange={e =>
                                    setCode(e.target.value.toUpperCase())
                                }
                                className="font-mono"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCode(generateCode())}
                                aria-label="Régénérer le code"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="invitation-label">
                            Label (optionnel)
                        </Label>
                        <Input
                            id="invitation-label"
                            placeholder="ex : Marie Dupont - Logistique"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreate} disabled={creating || !code}>
                        {creating ? "Création…" : "Créer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
