import { useMemo, useState } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/shared/ui/organisms/command"
import {
    groupByCategory,
    matchesPermissionSearch,
} from "../../utils/groupByCategory"
import type { Permission } from "../../types"
import { categoryLabel } from "./categoryLabels"

interface PermissionPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Nom de l'entité cible (rôle, service ou utilisateur) — pour le titre. */
    entityName: string
    /** Permissions proposables (déjà filtrées des permissions détenues). */
    availablePerms: Permission[]
    /** Renvoie true si l'ajout a réussi — la modale se ferme alors. */
    onConfirm: (selected: Permission[]) => Promise<boolean>
}

/**
 * Modale d'ajout de permissions : palette Command (recherche en tête),
 * groupement par catégorie, multi-sélection. Gère son propre état
 * (recherche/sélection/sauvegarde) — le parent ne fournit que la liste
 * disponible et le callback de confirmation.
 */
export function PermissionPickerDialog({
    open,
    onOpenChange,
    entityName,
    availablePerms,
    onConfirm,
}: PermissionPickerDialogProps) {
    const [search, setSearch] = useState("")
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set()
    )
    const [saving, setSaving] = useState(false)

    // Filtrage maison (label/code/catégorie) : cmdk ne connaît que la valeur
    // d'item, on garde la même sémantique de recherche que le catalogue.
    const grouped = useMemo(
        () =>
            groupByCategory(
                availablePerms.filter((p) =>
                    matchesPermissionSearch(p, search)
                )
            ),
        [availablePerms, search]
    )
    const totalAvailable = grouped.reduce((sum, g) => sum + g.perms.length, 0)

    function reset() {
        setSearch("")
        setSelectedIds(new Set())
        setSaving(false)
    }

    function handleOpenChange(next: boolean) {
        if (!next) reset()
        onOpenChange(next)
    }

    function toggleSelected(permissionId: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(permissionId)) next.delete(permissionId)
            else next.add(permissionId)
            return next
        })
    }

    async function handleConfirm() {
        const selected = availablePerms.filter((p) => selectedIds.has(p.id))
        if (selected.length === 0) return
        setSaving(true)
        const ok = await onConfirm(selected)
        if (ok) {
            handleOpenChange(false)
        } else {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="gap-0 p-0 sm:max-w-2xl">
                <DialogHeader className="border-b p-4">
                    <DialogTitle>
                        Ajouter des permissions — {entityName}
                    </DialogTitle>
                </DialogHeader>

                <Command shouldFilter={false}>
                    <CommandInput
                        value={search}
                        onValueChange={setSearch}
                        placeholder="Rechercher (label, code, catégorie)..."
                    />
                    <CommandList className="max-h-96">
                        {totalAvailable === 0 && (
                            <CommandEmpty>
                                Aucune permission disponible (ou aucun
                                résultat).
                            </CommandEmpty>
                        )}
                        {grouped.map((g) => (
                            <CommandGroup
                                key={g.label}
                                heading={`${categoryLabel(g.label)} (${g.perms.length})`}
                            >
                                {g.perms.map((p) => (
                                    <CommandItem
                                        key={p.id}
                                        value={p.id}
                                        onSelect={() => toggleSelected(p.id)}
                                        disabled={saving}
                                        className="cursor-pointer gap-3"
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(p.id)}
                                            tabIndex={-1}
                                            aria-hidden
                                            className="pointer-events-none shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {p.label}
                                            </div>
                                            <div className="truncate font-mono text-2xs text-muted-foreground">
                                                {p.code}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>

                <div className="flex items-center justify-between border-t p-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                            Sélection : {selectedIds.size}
                        </p>
                        {selectedIds.size > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                                disabled={saving}
                            >
                                Vider
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={saving}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0 || saving}
                        >
                            {saving ? "Ajout..." : "Ajouter"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
