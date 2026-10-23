import { Check, Copy, Eye, EyeOff, UserPlus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import type { InvitationCode } from "@/features/arrivage-admin/types"

interface InvitationCodeActionsProps {
    code: InvitationCode
    revealed: boolean
    copied: boolean
    onToggleVisibility: (id: string) => void
    onCopy: (id: string, code: string) => void
    onAssociate: (code: InvitationCode) => void
}

/**
 * Trio d'actions d'un code : copier, révéler, associer. Partagé par la table
 * desktop et la carte mobile pour que les deux vues ne divergent jamais.
 */
export function InvitationCodeActions({
    code,
    revealed,
    copied,
    onToggleVisibility,
    onCopy,
    onAssociate,
}: InvitationCodeActionsProps) {
    return (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => onCopy(code.id, code.code)}
                title="Copier le code"
                aria-label="Copier le code"
            >
                {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                    <Copy className="h-3.5 w-3.5" />
                )}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => onToggleVisibility(code.id)}
                title={revealed ? "Masquer" : "Afficher"}
                aria-label={revealed ? "Masquer le code" : "Afficher le code"}
            >
                {revealed ? (
                    <EyeOff className="h-3.5 w-3.5" />
                ) : (
                    <Eye className="h-3.5 w-3.5" />
                )}
            </Button>
            {/* Un code déjà consommé n'est plus associable. */}
            {!code.used_by && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => onAssociate(code)}
                    title="Associer à un utilisateur"
                    aria-label="Associer ce code à un utilisateur"
                >
                    <UserPlus className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    )
}
