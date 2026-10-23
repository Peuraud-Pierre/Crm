import { Badge } from "@/shared/ui/atoms/badge"
import { Card } from "@/shared/ui/atoms/card"
import { CODE_MASK } from "@/features/arrivage-admin/constants"
import { InvitationCodeActions } from "@/features/arrivage-admin/components/subscribers/InvitationCodeActions"
import { formatDate } from "@/features/arrivage-admin/utils/format"
import type { InvitationCode } from "@/features/arrivage-admin/types"

interface InvitationCodeCardProps {
    code: InvitationCode
    revealed: boolean
    copied: boolean
    onToggleVisibility: (id: string) => void
    onCopy: (id: string, code: string) => void
    onAssociate: (code: InvitationCode) => void
}

/** Vue mobile d'un code d'invitation (< md). */
export function InvitationCodeCard({
    code,
    revealed,
    copied,
    onToggleVisibility,
    onCopy,
    onAssociate,
}: InvitationCodeCardProps) {
    return (
        <Card className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-mono text-sm tracking-widest">
                    {revealed ? code.code : CODE_MASK}
                </p>
                <Badge variant={code.used_by ? "secondary" : "default"}>
                    {code.used_by ? "Utilisé" : "Disponible"}
                </Badge>
            </div>

            <div className="space-y-0.5 text-sm text-muted-foreground">
                <p className="truncate">{code.label ?? "Sans label"}</p>
                <p>
                    {code.used_at
                        ? `Utilisé le ${formatDate(code.used_at)}`
                        : `Créé le ${formatDate(code.created_at)}`}
                </p>
            </div>

            <div className="flex justify-end">
                <InvitationCodeActions
                    code={code}
                    revealed={revealed}
                    copied={copied}
                    onToggleVisibility={onToggleVisibility}
                    onCopy={onCopy}
                    onAssociate={onAssociate}
                />
            </div>
        </Card>
    )
}
