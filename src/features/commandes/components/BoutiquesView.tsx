import { useState } from "react"
import { Check, MoreHorizontal, Pencil, Plus, Store, Trash2, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Switch } from "@/shared/ui/atoms/switch"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { cn } from "@/shared/lib/utils"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import type { Boutique } from "@/features/commandes/types/commande.types"

/** Code boutique : 2 à 4 caractères, majuscules (contrainte de la table). */
const formatCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
const codeValide = (code: string) => /^[A-Z0-9]{2,4}$/.test(code)

interface Saisie {
    nom: string
    code: string
    adresse: string
}

const VIDE: Saisie = { nom: "", code: "", adresse: "" }

/**
 * Les boutiques destinataires, sans rien derrière : un nom, un code court
 * (imprimé sur les étiquettes), une adresse. Une boutique qui ferme se
 * DÉSACTIVE — ses commandes et livraisons la référencent.
 *
 * Les catégories commandées sont celles du stock principal : elles se gèrent
 * dans ses réglages, pas ici.
 */
export function BoutiquesView({ canEdit }: { canEdit: boolean }) {
    const { boutiques, commandes, createBoutique } = useCommandeContext()
    const [saisie, setSaisie] = useState<Saisie>(VIDE)
    const [busy, setBusy] = useState(false)
    const pret = !!saisie.nom.trim() && codeValide(saisie.code)

    const ajouter = async () => {
        if (!pret || busy) return
        setBusy(true)
        const ok = await createBoutique({ nom: saisie.nom.trim(), code: saisie.code, adresse: saisie.adresse.trim() || null, actif: true })
        setBusy(false)
        if (ok) setSaisie(VIDE)
    }

    const triees = [...boutiques].sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"))
    const actives = boutiques.filter((b) => b.actif).length

    return (
        <section className="flex flex-col rounded-xl border border-border bg-card">
            <header className="flex flex-col gap-3 border-b border-border p-4">
                <div className="flex items-start gap-2.5">
                    <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Store size={16} aria-hidden /></span>
                    <div className="min-w-0">
                        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
                            Boutiques
                            <span className="text-xs font-normal tabular-nums text-muted-foreground">{boutiques.length}</span>
                        </h3>
                        <p className="text-xs text-muted-foreground">{actives} active{actives > 1 ? "s" : ""} · là où partent les commandes</p>
                    </div>
                </div>
                {canEdit && (
                    <form
                        className="grid grid-cols-4 gap-2 sm:grid-cols-12"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void ajouter()
                        }}
                    >
                        <Input value={saisie.nom} onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })} placeholder="Nom de la boutique" aria-label="Nom de la boutique" className="col-span-3 h-10 sm:col-span-4" />
                        <Input value={saisie.code} onChange={(e) => setSaisie({ ...saisie, code: formatCode(e.target.value) })} placeholder="Code" aria-label="Code (2 à 4 caractères)"
                            className="h-10 font-mono uppercase sm:col-span-2" />
                        <Input value={saisie.adresse} onChange={(e) => setSaisie({ ...saisie, adresse: e.target.value })} placeholder="Adresse (facultatif)" aria-label="Adresse"
                            className="col-span-4 h-10" />
                        <Button type="submit" className="col-span-4 h-10 sm:col-span-2" disabled={!pret} loading={busy}>
                            <Plus size={14} />
                            Ajouter
                        </Button>
                    </form>
                )}
            </header>

            {triees.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Ajoutez les boutiques pour pouvoir leur adresser des commandes.</p>
            ) : (
                <ul className="divide-y divide-border">
                    {triees.map((b) => (
                        <BoutiqueRow key={b.id} boutique={b} canEdit={canEdit}
                            nbCommandes={commandes.filter((c) => c.boutique_id === b.id).length} />
                    ))}
                </ul>
            )}
        </section>
    )
}

function BoutiqueRow({ boutique, canEdit, nbCommandes }: { boutique: Boutique; canEdit: boolean; nbCommandes: number }) {
    const { updateBoutique, deleteBoutique } = useCommandeContext()
    const [editing, setEditing] = useState(false)
    const [confirm, setConfirm] = useState(false)

    if (editing) {
        return (
            <li className="px-4 py-2.5">
                <BoutiqueEdit boutique={boutique} onClose={() => setEditing(false)} />
            </li>
        )
    }

    return (
        <li className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className={cn(
                "flex h-9 w-12 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold",
                boutique.actif ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}>
                {boutique.code}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("truncate text-sm font-medium", !boutique.actif && "text-muted-foreground")}>{boutique.nom}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {[boutique.adresse, `${nbCommandes} commande${nbCommandes > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                </span>
            </span>
            {canEdit ? (
                <>
                    <Switch
                        checked={boutique.actif}
                        onCheckedChange={(actif) => void updateBoutique(boutique.id, { actif })}
                        aria-label={`${boutique.nom} : ${boutique.actif ? "active" : "inactive"}`}
                        title={boutique.actif ? "Active — proposée aux commandes" : "Inactive — gardée dans l'historique"}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground" aria-label={`Actions : ${boutique.nom}`}>
                                <MoreHorizontal size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing(true)}>
                                <Pencil size={14} />
                                Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive">
                                <Trash2 size={14} />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ConfirmAction
                        open={confirm}
                        onOpenChange={setConfirm}
                        title={`Supprimer ${boutique.nom} ?`}
                        description="Impossible si elle a déjà des commandes ou des livraisons : désactivez-la plutôt, elle restera dans l'historique."
                        confirmLabel="Supprimer"
                        destructive
                        onConfirm={() => deleteBoutique(boutique.id)}
                    />
                </>
            ) : !boutique.actif && <span className="text-xs italic text-muted-foreground">Inactive</span>}
        </li>
    )
}

/** Édition sur place : Entrée enregistre, Échap annule. */
function BoutiqueEdit({ boutique, onClose }: { boutique: Boutique; onClose: () => void }) {
    const { updateBoutique } = useCommandeContext()
    const [saisie, setSaisie] = useState<Saisie>({ nom: boutique.nom, code: boutique.code, adresse: boutique.adresse ?? "" })
    const [busy, setBusy] = useState(false)
    const pret = !!saisie.nom.trim() && codeValide(saisie.code)

    const save = async () => {
        if (!pret || busy) return
        setBusy(true)
        const ok = await updateBoutique(boutique.id, { nom: saisie.nom.trim(), code: saisie.code, adresse: saisie.adresse.trim() || null })
        setBusy(false)
        if (ok) onClose()
    }

    return (
        <form
            className="grid grid-cols-4 gap-2 sm:grid-cols-12"
            onSubmit={(e) => {
                e.preventDefault()
                void save()
            }}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
            <Input autoFocus value={saisie.nom} onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })} aria-label="Nom de la boutique" className="col-span-3 h-9 sm:col-span-4" />
            <Input value={saisie.code} onChange={(e) => setSaisie({ ...saisie, code: formatCode(e.target.value) })} aria-label="Code" className="h-9 font-mono sm:col-span-2" />
            <Input value={saisie.adresse} onChange={(e) => setSaisie({ ...saisie, adresse: e.target.value })} placeholder="Adresse" aria-label="Adresse" className="col-span-4 h-9" />
            <span className="col-span-4 flex justify-end gap-1 sm:col-span-2">
                <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={!pret} loading={busy} aria-label="Enregistrer"><Check size={14} /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onClose} aria-label="Annuler"><X size={14} /></Button>
            </span>
        </form>
    )
}
