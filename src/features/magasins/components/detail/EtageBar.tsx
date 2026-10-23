import { useState } from "react"
import { Building2, Pencil, Plus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { cn } from "@/shared/lib/utils"
import type { EtagesApi } from "@/features/magasins/hooks/data/useEtages"
import type { Etage, EtageFormInput } from "@/features/magasins/types/magasin.types"

/** Nom proposé pour un niveau : « RDC », « 1er étage », « Sous-sol 2 »… */
export function defaultEtageName(niveau: number): string {
    if (niveau === 0) return "RDC"
    if (niveau > 0) return `${niveau}${niveau === 1 ? "er" : "e"} étage`
    return niveau === -1 ? "Sous-sol" : `Sous-sol ${-niveau}`
}

interface EtageBarProps {
    etages: EtagesApi
    current: Etage | null
    onSelect: (id: string) => void
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    /** Contenu d'un étage, annoncé avant sa suppression. */
    contentOf: (id: string) => { zones: number; emplacements: number; equipements: number; murs: number }
}

type Target = { etage: Etage | null; key: number }

/**
 * Sélecteur d'étage de la fiche magasin, commun aux onglets Plan et
 * Emplacements : pastilles du plus haut au plus bas niveau (comme un
 * ascenseur), ajout, renommage, changement de niveau et suppression.
 */
export function EtageBar({ etages, current, onSelect, canCreate, canUpdate, canDelete, contentOf }: EtageBarProps) {
    const [target, setTarget] = useState<Target | null>(null)
    const list = [...etages.etages].sort((a, b) => b.niveau - a.niveau)
    const nextNiveau = etages.etages.length ? Math.max(...etages.etages.map((e) => e.niveau)) + 1 : 0

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Building2 size={16} className="text-muted-foreground" aria-hidden />
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Étages">
                {list.map((e) => (
                    <button
                        key={e.id}
                        type="button"
                        role="tab"
                        aria-selected={e.id === current?.id}
                        onClick={() => onSelect(e.id)}
                        className={cn(
                            "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                            e.id === current?.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {e.nom}
                    </button>
                ))}
            </div>
            {current && canUpdate && (
                <Button variant="ghost" size="icon" onClick={() => setTarget({ etage: current, key: Date.now() })} aria-label={`Modifier l'étage ${current.nom}`}>
                    <Pencil size={14} />
                </Button>
            )}
            {canCreate && (
                <Button variant="outline" size="sm" onClick={() => setTarget({ etage: null, key: Date.now() })}>
                    <Plus size={14} /> Étage
                </Button>
            )}

            {target && (
                <EtageFormSheet
                    key={target.key}
                    etage={target.etage}
                    suggestedNiveau={nextNiveau}
                    onClose={() => setTarget(null)}
                    onSubmit={async (input) => {
                        if (target.etage) return etages.update(target.etage.id, input)
                        const created = await etages.create(input)
                        if (created) onSelect(created.id)
                        return created !== null
                    }}
                    onDelete={
                        target.etage && canDelete && etages.etages.length > 1
                            ? () => etages.remove(target.etage!.id)
                            : undefined
                    }
                    content={target.etage ? contentOf(target.etage.id) : null}
                />
            )}
        </div>
    )
}

interface EtageFormSheetProps {
    etage: Etage | null
    suggestedNiveau: number
    onClose: () => void
    onSubmit: (input: EtageFormInput) => Promise<boolean>
    onDelete?: () => Promise<boolean>
    content: { zones: number; emplacements: number; equipements: number; murs: number } | null
}

function EtageFormSheet({ etage, suggestedNiveau, onClose, onSubmit, onDelete, content }: EtageFormSheetProps) {
    const [niveau, setNiveau] = useState(String(etage?.niveau ?? suggestedNiveau))
    const [nom, setNom] = useState(() => etage?.nom ?? defaultEtageName(suggestedNiveau))
    // Tant que le nom n'a pas été retouché, il suit le niveau choisi.
    const [nomTouched, setNomTouched] = useState(Boolean(etage))
    const [saving, setSaving] = useState(false)
    const parsed = Number.parseInt(niveau, 10)
    const valid = nom.trim() !== "" && Number.isInteger(parsed)

    const parts = content
        ? [
              content.zones && `${content.zones} zone${content.zones > 1 ? "s" : ""}`,
              content.emplacements && `${content.emplacements} emplacement${content.emplacements > 1 ? "s" : ""}`,
              content.equipements && `${content.equipements} équipement${content.equipements > 1 ? "s" : ""}`,
              content.murs && `${content.murs} mur${content.murs > 1 ? "s" : ""}`,
          ].filter(Boolean)
        : []

    return (
        <FormSheet
            open
            onClose={onClose}
            icon={Building2}
            title={etage ? `Modifier ${etage.nom}` : "Nouvel étage"}
            description="Chaque étage a son plan, son contour et son plan importé ; les dimensions du magasin sont communes."
            size="md"
            onSubmit={async () => {
                if (!valid) return
                setSaving(true)
                const ok = await onSubmit({ nom: nom.trim(), niveau: parsed })
                setSaving(false)
                if (ok) onClose()
            }}
            submitDisabled={!valid}
            loading={saving}
            onDelete={onDelete ? async () => { if (await onDelete()) onClose() } : undefined}
            deleteConfirm={{
                title: `Supprimer ${etage?.nom ?? "cet étage"} ?`,
                description: parts.length
                    ? `Son plan sera supprimé avec ${parts.join(", ")}.`
                    : "Son plan, vide, sera supprimé.",
            }}
        >
            <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="etage-niveau">Niveau</Label>
                    <Input
                        id="etage-niveau"
                        type="number"
                        step={1}
                        value={niveau}
                        onChange={(e) => {
                            setNiveau(e.target.value)
                            const n = Number.parseInt(e.target.value, 10)
                            if (!nomTouched && Number.isInteger(n)) setNom(defaultEtageName(n))
                        }}
                    />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="etage-nom">Nom</Label>
                    <Input
                        id="etage-nom"
                        value={nom}
                        onChange={(e) => {
                            setNom(e.target.value)
                            setNomTouched(true)
                        }}
                        autoFocus
                    />
                </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">0 = rez-de-chaussée, 1 = 1er étage, -1 = sous-sol.</p>
        </FormSheet>
    )
}
