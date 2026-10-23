import { useEffect } from "react"
import { useNavigate, useParams } from "react-router"
import { Store } from "lucide-react"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    MAGASIN_PERMISSIONS,
    MAGASIN_SECTIONS,
    MAGASINS_ROUTE_BASE,
    type MagasinSection,
} from "@/features/magasins/constants"
import { useMagasins } from "@/features/magasins/hooks/data/useMagasins"
import { MagasinsBoard } from "@/features/magasins/components/list/MagasinsBoard"
import { MagasinDetail } from "@/features/magasins/components/detail/MagasinDetail"

const isSection = (value: string | undefined): value is MagasinSection =>
    (MAGASIN_SECTIONS as readonly string[]).includes(value ?? "")

/**
 * Module Magasins. L'URL est la source de vérité (docs/ROUTING.md) :
 *   /magasins                      → liste des magasins
 *   /magasins/<id>                 → redirige vers /magasins/<id>/plan
 *   /magasins/<id>/plan            → onglet Plan
 *   /magasins/<id>/emplacements    → onglet Emplacements
 *
 * Comme dans `TabbedModuleRoute`, la seule correction d'URL (section absente
 * ou inconnue) est faite ici, en `replace`, et jamais dans un onglet.
 */
export default function Magasins() {
    const { magasinId, section } = useParams()
    const navigate = useNavigate()
    const { hasPermission } = useAuth()
    const data = useMagasins()

    const permissions = {
        create: hasPermission(MAGASIN_PERMISSIONS.create),
        update: hasPermission(MAGASIN_PERMISSIONS.update),
        delete: hasPermission(MAGASIN_PERMISSIONS.delete),
    }

    useEffect(() => {
        if (magasinId && !isSection(section)) {
            navigate(`${MAGASINS_ROUTE_BASE}/${magasinId}/${MAGASIN_SECTIONS[0]}`, { replace: true })
        }
    }, [magasinId, section, navigate])

    const open = (id: string) => navigate(`${MAGASINS_ROUTE_BASE}/${id}/${MAGASIN_SECTIONS[0]}`)
    const back = () => navigate(MAGASINS_ROUTE_BASE)

    if (!magasinId) {
        return <MagasinsBoard data={data} canCreate={permissions.create} onOpen={open} />
    }

    if (data.loading || !isSection(section)) {
        return (
            <div className="p-4">
                <Skeleton aria-hidden className="h-96 w-full rounded-2xl" />
            </div>
        )
    }

    const magasin = data.magasins.find((m) => m.id === magasinId)
    if (!magasin) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={Store}
                    title="Magasin introuvable"
                    description="Il a peut-être été supprimé, ou vous n'y avez pas accès."
                    action={{ label: "Retour aux magasins", onClick: back }}
                />
            </div>
        )
    }

    return (
        <MagasinDetail
            key={magasin.id}
            magasin={magasin}
            section={section}
            data={data}
            permissions={permissions}
            onSectionChange={(next) => navigate(`${MAGASINS_ROUTE_BASE}/${magasin.id}/${next}`)}
            onBack={back}
        />
    )
}
