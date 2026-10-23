import { KeyRound } from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { RefreshButton } from "@/features/arrivage-admin/components/shared/RefreshButton"
import { CreateCodeDialog } from "@/features/arrivage-admin/components/subscribers/CreateCodeDialog"
import { InvitationCodeCard } from "@/features/arrivage-admin/components/subscribers/InvitationCodeCard"
import { InvitationCodeTable } from "@/features/arrivage-admin/components/subscribers/InvitationCodeTable"
import { useCodeVisibility } from "@/features/arrivage-admin/hooks/useCodeVisibility"
import type { InvitationCode } from "@/features/arrivage-admin/types"

const SKELETON_CARDS = ["kc1", "kc2", "kc3", "kc4"]

interface InvitationCodesPanelProps {
    codes: InvitationCode[]
    loading: boolean
    creating: boolean
    onRefresh: () => void
    onCreate: (code: string, label: string) => Promise<boolean>
    /** Ouvre la modale d'association, en propageant l'état de révélation. */
    onAssociate: (code: InvitationCode, revealed: boolean) => void
}

export function InvitationCodesPanel({
    codes,
    loading,
    creating,
    onRefresh,
    onCreate,
    onAssociate,
}: InvitationCodesPanelProps) {
    const { isVisible, isCopied, toggleVisibility, copy } = useCodeVisibility()

    const handleAssociate = (code: InvitationCode) =>
        onAssociate(code, isVisible(code.id))

    const isEmpty = !loading && codes.length === 0

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Codes d'invitation</CardTitle>
                    <div className="flex shrink-0 gap-2">
                        <RefreshButton
                            loading={loading}
                            onClick={onRefresh}
                            label="les codes d'invitation"
                        />
                        <CreateCodeDialog
                            creating={creating}
                            onCreate={onCreate}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0" aria-busy={loading}>
                {isEmpty ? (
                    <EmptyState
                        icon={KeyRound}
                        title="Aucun code généré"
                        description="Un code d'invitation est consommé à la création d'un abonnement, qu'il soit auto-généré par l'utilisateur ou associé ici."
                    />
                ) : (
                    <>
                        {/* Desktop : table */}
                        <div className="hidden md:block">
                            <InvitationCodeTable
                                codes={codes}
                                loading={loading}
                                isVisible={isVisible}
                                isCopied={isCopied}
                                onToggleVisibility={toggleVisibility}
                                onCopy={copy}
                                onAssociate={handleAssociate}
                            />
                        </div>

                        {/* Mobile : cartes */}
                        <div className="space-y-3 p-4 md:hidden">
                            {loading
                                ? SKELETON_CARDS.map(key => (
                                      <Skeleton
                                          key={key}
                                          className="h-32 w-full rounded-lg"
                                      />
                                  ))
                                : codes.map(c => (
                                      <InvitationCodeCard
                                          key={c.id}
                                          code={c}
                                          revealed={isVisible(c.id)}
                                          copied={isCopied(c.id)}
                                          onToggleVisibility={toggleVisibility}
                                          onCopy={copy}
                                          onAssociate={handleAssociate}
                                      />
                                  ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
