import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
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
import { useAdminAssociateCode } from "@/features/arrivage-admin/hooks/data/useAdminAssociateCode"
import {
    useProfileOptions,
    type ProfileOption,
} from "@/features/arrivage-admin/hooks/data/useProfileOptions"

/** Un profil sans email ne peut pas être abonné — filtré avant sélection. */
interface CandidateProfile extends ProfileOption {
    email: string
}

export interface AssociateDialogCode {
    id: string
    code: string
    label: string | null
    /** Reflète le masquage de la table au moment du clic — on n'affiche le code en clair ici que s'il l'était déjà là-bas. */
    revealed: boolean
}

interface AssociateUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Code disponible à associer — null tant qu'aucun code n'a été choisi. */
    code: AssociateDialogCode | null
    /** Utilisateurs déjà abonnés, à exclure de la recherche. */
    excludeUserIds: Set<string>
    /** Appelé après une association réussie — le parent ferme et rafraîchit. */
    onAssociated: () => void
}

function dialogTitle(code: AssociateDialogCode | null): string {
    if (!code) return "Associer un utilisateur"
    if (code.label) return `Associer « ${code.label} » à un utilisateur`
    if (code.revealed) return `Associer le code ${code.code} à un utilisateur`
    return "Associer ce code à un utilisateur"
}

export function AssociateUserDialog({
    open,
    onOpenChange,
    code,
    excludeUserIds,
    onAssociated,
}: AssociateUserDialogProps) {
    const { profiles, loading } = useProfileOptions()
    const { associating, associateCode } = useAdminAssociateCode()
    const [selected, setSelected] = useState<CandidateProfile | null>(null)

    const candidates = useMemo(
        () =>
            profiles.filter(
                (p): p is CandidateProfile => !!p.email && !excludeUserIds.has(p.user_id)
            ),
        [profiles, excludeUserIds]
    )

    function handleOpenChange(next: boolean) {
        if (!next && associating) return // évite de couper une requête en cours
        if (!next) setSelected(null)
        onOpenChange(next)
    }

    async function handleConfirm() {
        if (!code || !selected) return
        const ok = await associateCode(code.code, selected)
        if (ok) onAssociated()
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="gap-0 p-0 sm:max-w-lg">
                <DialogHeader className="border-b p-4">
                    <DialogTitle>{dialogTitle(code)}</DialogTitle>
                </DialogHeader>

                <Command>
                    <CommandInput placeholder="Rechercher (nom, email)..." />
                    <CommandList className="max-h-72">
                        {loading ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                Chargement…
                            </p>
                        ) : (
                            <>
                                <CommandEmpty>
                                    Aucun utilisateur disponible (déjà abonnés exclus, ou aucun résultat).
                                </CommandEmpty>
                                <CommandGroup>
                                    {candidates.map(p => {
                                        const isSelected = selected?.user_id === p.user_id
                                        return (
                                            <CommandItem
                                                key={p.user_id}
                                                value={`${p.full_name ?? ""} ${p.email}`}
                                                onSelect={() => setSelected(p)}
                                                disabled={associating}
                                                className="cursor-pointer gap-3"
                                            >
                                                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                                    {isSelected && <Check className="h-4 w-4" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium">
                                                        {p.full_name || "—"}
                                                    </div>
                                                    <div className="truncate text-2xs text-muted-foreground">
                                                        {p.email}
                                                    </div>
                                                </div>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>

                <div className="flex items-center justify-between gap-4 border-t p-4">
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {selected ? `Sélectionné : ${selected.full_name || selected.email}` : "Aucune sélection"}
                    </p>
                    <div className="flex shrink-0 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={associating}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selected || associating}
                        >
                            {associating ? "Association…" : "Associer"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
