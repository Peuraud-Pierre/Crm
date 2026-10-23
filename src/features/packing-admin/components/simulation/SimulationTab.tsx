import { useMemo, useState } from "react"
import { FlaskConical } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { packingApiConfigured } from "@/features/packing-admin/services/packingAdminApi"
import { usePackingModelReport } from "@/features/packing-admin/hooks/data/usePackingModelReport"
import { usePackingReplay } from "@/features/packing-admin/hooks/data/usePackingReplay"
import { formatShare } from "@/features/packing-admin/utils/format"
import type { PackingGuardSettings, PackingServiceStatus } from "@/features/packing-admin/types"
import { SimulationControls } from "./SimulationControls"
import { SimulationOutcome } from "./SimulationOutcome"

interface SimulationTabProps {
    production: PackingServiceStatus | null
}

/**
 * Onglet « Simulation » — essayer un autre réglage sans rien changer.
 *
 * Ce que ça résout : le seuil d'auto-classement n'est pas un curseur qu'on tourne
 * au jugé, c'est une MESURE. Mais les trois paramètres qui le déterminent
 * (précision cible, preuves minimales, marge) sont bien des choix, et on ne peut
 * pas les choisir sans voir ce qu'ils produiraient sur l'historique réel.
 *
 * Rien n'est écrit : la simulation passe des paramètres en lecture, le service
 * rebâtit un modèle sur des lignes déjà en cache et renvoie `simulated: true`.
 * Porter un réglage en production reste une modification de la configuration du
 * service — délibérée, et hors de cette interface.
 */
export function SimulationTab({ production }: SimulationTabProps) {
    const productionGuard = production?.config.guard ?? null

    const [draft, setDraft] = useState<PackingGuardSettings | null>(null)
    const [applied, setApplied] = useState<PackingGuardSettings | null>(null)

    const guard = draft ?? productionGuard

    // Objet STABLE : recréé à chaque rendu, il relancerait la requête en boucle.
    const overrides = useMemo(
        () => (applied ? { ...applied } : undefined),
        [applied],
    )

    const simulated = usePackingModelReport(overrides)
    const replay = usePackingReplay(overrides)

    if (!packingApiConfigured()) {
        return (
            <EmptyState
                size="md"
                icon={FlaskConical}
                title="Simulation indisponible"
                description="Le service de classement n'est pas configuré dans cet environnement (PUBLIC_PACKING_API_URL). La simulation est calculée par le service, pas par le navigateur."
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    if (!guard) {
        return (
            <EmptyState
                size="sm"
                icon={FlaskConical}
                title="Réglages de production inconnus"
                description="Le service ne répond pas : impossible de savoir de quels réglages partir."
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <Card className="flex flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">Réglages à essayer</h3>
                    <p className="text-xs text-muted-foreground">
                        En production : précision cible {formatShare(productionGuard?.target_precision)},{" "}
                        {productionGuard?.min_evidence} preuve(s) minimum, marge{" "}
                        {productionGuard?.min_margin}. Rien de ce qui suit ne modifie le service.
                    </p>
                </div>
                <SimulationControls
                    value={guard}
                    production={productionGuard}
                    running={simulated.loading || replay.loading}
                    onChange={setDraft}
                    onRun={() => setApplied({ ...guard })}
                    onReset={() => {
                        setDraft(null)
                        setApplied(null)
                    }}
                />
            </Card>

            <SimulationOutcome
                production={production}
                simulatedModel={simulated.model}
                simulatedReplay={replay.replay}
                loading={simulated.loading || replay.loading}
                error={simulated.error ?? replay.error}
                hasRun={applied !== null}
            />
        </div>
    )
}
