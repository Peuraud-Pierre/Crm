import { useMemo, useState } from "react"
import { ArrowLeft, LayoutGrid, Map as MapIcon, Pencil } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/atoms/alert"
import { ModuleTabs, type ModuleTabItem } from "@/shared/ui/organisms/module-tabs"
import { MAGASIN_THEME } from "@/features/magasins/theme"
import type { MagasinSection } from "@/features/magasins/constants"
import type { useMagasins } from "@/features/magasins/hooks/data/useMagasins"
import { usePlanMagasin } from "@/features/magasins/hooks/data/usePlanMagasin"
import { useFond } from "@/features/magasins/hooks/data/useFond"
import { useEtages } from "@/features/magasins/hooks/data/useEtages"
import { useRetailLayout } from "@/features/magasins/hooks/data/useRetailLayout"
import { retailConfigured } from "@/features/magasins/services/retailLayoutService"
import type { Magasin } from "@/features/magasins/types/magasin.types"
import { EtageBar } from "./EtageBar"
import { RetailPublish } from "./RetailPublish"
import { MagasinFormSheet } from "../list/MagasinFormSheet"
import { PlanTab } from "../plan/PlanTab"
import { EmplacementsTab } from "../emplacements/EmplacementsTab"

interface MagasinDetailProps {
    magasin: Magasin
    section: MagasinSection
    data: ReturnType<typeof useMagasins>
    permissions: { create: boolean; update: boolean; delete: boolean }
    onSectionChange: (section: MagasinSection) => void
    onBack: () => void
}

/**
 * Fiche d'un magasin : son plan et ses emplacements, étage par étage. Le plan
 * est chargé ici, une fois, et partagé par les deux onglets ; l'étage affiché
 * est choisi dans la barre au-dessus des onglets et vaut pour les deux.
 */
export function MagasinDetail({ magasin, section, data, permissions, onSectionChange, onBack }: MagasinDetailProps) {
    const etages = useEtages(magasin.id)
    const [etageId, setEtageId] = useState<string | null>(null)
    // Étage affiché : celui choisi, sinon le rez-de-chaussée, sinon le plus bas
    // (le choisi peut disparaître, supprimé).
    const etage =
        etages.etages.find((e) => e.id === etageId) ??
        etages.etages.find((e) => e.niveau === 0) ??
        etages.etages[0] ??
        null
    const plan = usePlanMagasin(magasin.id, etage?.id ?? null)
    const bounds = useMemo(() => ({ width: magasin.largeur, depth: magasin.profondeur }), [magasin.largeur, magasin.profondeur])
    const fond = useFond({ etage, bounds, update: etages.update })
    // Le plan importé reste en vignette ; on le passe en fond pour décalquer.
    const [showFond, setShowFond] = useState(false)
    const [editing, setEditing] = useState(false)
    const showRetail = retailConfigured && permissions.update
    const retail = useRetailLayout(magasin, data.update, showRetail)
    // Chaque ouverture remonte la sheet : son formulaire repart du magasin.
    const [formKey, setFormKey] = useState(0)
    const toggleForm = (open: boolean) => {
        if (open) setFormKey((k) => k + 1)
        setEditing(open)
    }

    const items: ModuleTabItem<MagasinSection>[] = [
        {
            id: "plan",
            label: "Plan",
            icon: <MapIcon size={20} />,
            tooltip: "Plan 2D / 3D du magasin",
            content: (
                <PlanTab
                    magasin={magasin}
                    etage={etage}
                    onContourChange={(contour) => {
                        // Les onglets ne sont rendus qu'avec un étage (voir plus bas).
                        if (etage) void etages.update(etage.id, { contour }, { silent: true })
                    }}
                    plan={plan}
                    canEdit={permissions.update}
                    canCreate={permissions.create}
                    canDelete={permissions.delete}
                    onManageEmplacements={() => onSectionChange("emplacements")}
                    fond={fond}
                    showFond={showFond}
                    onToggleFond={() => setShowFond((v) => !v)}
                />
            ),
        },
        {
            id: "emplacements",
            label: "Emplacements",
            icon: <LayoutGrid size={20} />,
            tooltip: "Zones, rayons, portants et emplacements",
            content: (
                <EmplacementsTab
                    plan={plan}
                    canCreate={permissions.create}
                    canUpdate={permissions.update}
                    canDelete={permissions.delete}
                />
            ),
        },
    ]

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onBack} aria-label="Retour à la liste des magasins">
                    <ArrowLeft size={18} />
                </Button>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className={MAGASIN_THEME.section.title}>{magasin.nom}</h1>
                        <Badge variant="secondary">{magasin.code}</Badge>
                        {!magasin.is_active && <Badge variant="outline">Inactif</Badge>}
                    </div>
                    {(magasin.adresse || magasin.ville) && (
                        <p className={MAGASIN_THEME.section.description}>
                            {[magasin.adresse, magasin.ville].filter(Boolean).join(", ")}
                        </p>
                    )}
                </div>
                {(showRetail || permissions.update) && (
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {showRetail && <RetailPublish magasin={magasin} retail={retail} />}
                        {permissions.update && (
                            <Button variant="outline" size="sm" onClick={() => toggleForm(true)}>
                                <Pencil size={14} /> Modifier
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {etages.loading ? (
                <Skeleton aria-hidden className="h-9 w-64 rounded-full" />
            ) : (
                <EtageBar
                    etages={etages}
                    current={etage}
                    onSelect={setEtageId}
                    canCreate={permissions.create}
                    canUpdate={permissions.update}
                    canDelete={permissions.delete}
                    contentOf={plan.contentOf}
                />
            )}

            {!etages.loading && !etage ? (
                // Sans étage, tout ce qui se dessine (contour, zones, caisses…)
                // n'aurait nulle part où s'enregistrer : on ne propose pas
                // d'outils qui perdraient le travail en silence.
                <Alert variant="destructive" role="alert">
                    <AlertTitle>Étages introuvables</AlertTitle>
                    <AlertDescription>
                        {etages.error ?? "Ce magasin n'a aucun étage."} La base de données n'est sans doute pas à jour :
                        appliquez la migration <code>20261008110000_magasins_etages</code> sur l'instance Supabase utilisée
                        par l'application, puis rechargez la page.
                    </AlertDescription>
                </Alert>
            ) : (
                <ModuleTabs value={section} items={items} theme={MAGASIN_THEME.tabs} onTabChange={onSectionChange} />
            )}

            <MagasinFormSheet
                key={formKey}
                open={editing}
                magasin={magasin}
                onClose={() => toggleForm(false)}
                onSubmit={(input) => data.update(magasin.id, input)}
                onDelete={
                    permissions.delete
                        ? async () => {
                              const ok = await data.remove(magasin.id)
                              if (ok) onBack()
                              return ok
                          }
                        : undefined
                }
            />
        </div>
    )
}
