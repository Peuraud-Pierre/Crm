import { useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { ARRIVAGE_ADMIN_PERMISSIONS } from "@/features/arrivage-admin/constants"
import {
    AssociateUserDialog,
    type AssociateDialogCode,
} from "@/features/arrivage-admin/components/subscribers/AssociateUserDialog"
import { InvitationCodesPanel } from "@/features/arrivage-admin/components/subscribers/InvitationCodesPanel"
import { SubscribersPanel } from "@/features/arrivage-admin/components/subscribers/SubscribersPanel"
import { useInvitationCodes } from "@/features/arrivage-admin/hooks/data/useInvitationCodes"
import { useNewsletterSend } from "@/features/arrivage-admin/hooks/data/useNewsletterSend"
import { useSubscribers } from "@/features/arrivage-admin/hooks/data/useSubscribers"
import type { InvitationCode } from "@/features/arrivage-admin/types"

/**
 * Onglet « Abonnés » : les abonnements d'abord (la donnée métier), les codes
 * d'invitation ensuite (le moyen d'en créer).
 */
export function SubscribersTab() {
    const { user, hasPermission } = useAuth()
    const canSend = hasPermission(ARRIVAGE_ADMIN_PERMISSIONS.send)

    const {
        subscribers,
        loading: loadingSubs,
        refetch: refetchSubs,
        toggleArrivage,
        toggleCrmStat,
    } = useSubscribers()
    const {
        codes,
        loading: loadingCodes,
        creating,
        refetch: refetchCodes,
        createCode,
    } = useInvitationCodes()
    const { sendingId, sendingAll, sendToSubscriber, sendToAll } =
        useNewsletterSend()

    const [associateDialogCode, setAssociateDialogCode] =
        useState<AssociateDialogCode | null>(null)

    const handleCreate = (code: string, label: string) => {
        if (!user) return Promise.resolve(false)
        return createCode(code, label, user.user_id)
    }

    const handleAssociate = (code: InvitationCode, revealed: boolean) =>
        setAssociateDialogCode({
            id: code.id,
            code: code.code,
            label: code.label,
            revealed,
        })

    return (
        <div className="space-y-6">
            <SubscribersPanel
                subscribers={subscribers}
                loading={loadingSubs}
                canSend={canSend}
                sendingId={sendingId}
                sendingAll={sendingAll}
                onRefresh={refetchSubs}
                onResend={sendToSubscriber}
                onSendAll={sendToAll}
                onToggleArrivage={toggleArrivage}
                onToggleCrmStat={toggleCrmStat}
            />

            <InvitationCodesPanel
                codes={codes}
                loading={loadingCodes}
                creating={creating}
                onRefresh={refetchCodes}
                onCreate={handleCreate}
                onAssociate={handleAssociate}
            />

            <AssociateUserDialog
                open={!!associateDialogCode}
                code={associateDialogCode}
                excludeUserIds={new Set(subscribers.map(s => s.user_id))}
                onOpenChange={open => !open && setAssociateDialogCode(null)}
                onAssociated={() => {
                    setAssociateDialogCode(null)
                    // Une association consomme le code et crée l'abonnement :
                    // les deux listes changent.
                    refetchCodes()
                    refetchSubs()
                }}
            />
        </div>
    )
}
