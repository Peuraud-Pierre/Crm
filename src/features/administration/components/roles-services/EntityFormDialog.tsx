import type React from "react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"

/**
 * Dialog de création d'un rôle ou service (champ nom seul) — le renommage
 * d'une entité existante se fait depuis sa fiche (EntitySheet).
 */
export function EntityFormDialog({
    open,
    onOpenChange,
    trigger,
    title,
    onSubmit,
    label,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger: React.ReactNode
    title: string
    label: string
    onSubmit: (nom: string) => Promise<void>
}) {
    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const nom = ((form.get("nom") as string) ?? "").trim()
        if (!nom) return
        await onSubmit(nom)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="entity-nom">{label}</Label>
                        <Input
                            id="entity-nom"
                            name="nom"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Annuler
                        </Button>
                        <Button type="submit">Enregistrer</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
