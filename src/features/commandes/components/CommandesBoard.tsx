import { useMemo, useState, type ComponentProps } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { CalendarRange, ClipboardList, Container, Plus, ShoppingCart, Store } from "lucide-react"
import { BoardHeader } from "@/shared/ui/molecules/board-header"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { GESTION_THEME } from "@/features/stock"
import { COMMANDES_ROUTE, COMMANDES_PERMISSIONS } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { useBoutiqueCourante } from "@/features/commandes/hooks/ui/useBoutiqueCourante"
import { espacesAccessibles, resolveVue, VUE_PAR_DEFAUT } from "@/features/commandes/utils/commandeVues"
import { fileDeTravail } from "@/features/commandes/utils/fileDeTravail"
import { toDay } from "@/features/commandes/utils/planning"
import {
    ESPACE_DE_VUE,
    type AvancementLigne,
    type CommandeBoutique,
    type CommandeVue,
    type LivraisonBoutique,
} from "@/features/commandes/types/commande.types"
import { FileDeTravailView } from "./FileDeTravailView"
import { PlanningView } from "./PlanningView"
import { SectionTabs, type SectionTab } from "./SectionTabs"
import { CommandesTable, LivraisonsTable } from "./CommandeTables"
import { BoutiquesView } from "./BoutiquesView"
import { BoutiqueEspace } from "./BoutiqueEspace"
import { EspaceSwitch } from "./EspaceSwitch"
import { CommandeFormSheet } from "./CommandeFormSheet"
import { CommandeDetailSheet } from "./CommandeDetailSheet"
import { LivraisonFormSheet } from "./LivraisonFormSheet"
import { LivraisonBoutiqueSheet } from "./LivraisonBoutiqueSheet"

const url = (vue: CommandeVue, id?: string) => `${COMMANDES_ROUTE}${id ? `/${id}` : ""}?vue=${vue}`

type VueEntrepot = Extract<CommandeVue, "a-faire" | "planning" | "commandes" | "livraisons" | "boutiques">
type VueBoutique = Extract<CommandeVue, "accueil" | "reception" | "mes-commandes">

/** Vues dont le `detail` est une commande, une livraison, ou l'une ou l'autre. */
const DETAIL_COMMANDE = new Set<CommandeVue>(["commandes", "mes-commandes"])
const DETAIL_LIVRAISON = new Set<CommandeVue>(["livraisons"])
const DETAIL_MIXTE = new Set<CommandeVue>(["a-faire", "planning"])
/** Vues où `new` ouvre la saisie d'une commande. */
const CREATION_COMMANDE = new Set<CommandeVue>(["a-faire", "commandes", "mes-commandes"])

interface CommandesBoardProps {
    /**
     * Segment `detail` : `new`, ou l'id d'une commande (vues `commandes`,
     * `mes-commandes`), d'une livraison (`livraisons`, `reception`), de l'une
     * ou l'autre (`a-faire`, `planning`).
     */
    detail?: string
}

/**
 * Page Commandes boutiques : la circulation entrepôt → boutiques, en DEUX
 * ESPACES sur la même page.
 *
 *   Entrepôt (PC, tablette) — aujourd'hui la commande arrive par mail et
 *   l'entrepôt la saisit :
 *     À faire    — accueil : la file de travail par étape (à préparer, en
 *                  préparation, en route, à régler), chaque carte porte son
 *                  action suivante
 *     Commandes  — toutes les commandes et leur avancement
 *     Livraisons — tous les envois (partiels)
 *     Planning   — qui reçoit quoi et quand
 *     Boutiques  — les destinataires
 *   Boutique (téléphone, tablette — simulée en V1) — d'abord la RÉCEPTION :
 *     Accueil    — ce qui arrive
 *     Réception  — au scan, carton par carton, jusqu'à la validation
 *     Commandes  — suivre (et, à terme, passer) ses commandes
 *
 * URL : `/commandes/:detail?` + `?vue=`, l'espace se déduit de la vue. La vue
 * est lue, jamais corrigée par redirection.
 */
export default function CommandesBoard({ detail }: CommandesBoardProps) {
    const { hasPermission } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [params] = useSearchParams()
    const ctx = useCommandeContext()

    const manage = hasPermission(COMMANDES_PERMISSIONS.manage)
    const boutiquePerm = hasPermission(COMMANDES_PERMISSIONS.boutique)
    const espaces = espacesAccessibles(manage, boutiquePerm)
    const vue = resolveVue(params.get("vue"), espaces)
    const espace = ESPACE_DE_VUE[vue]

    const detailCommande = DETAIL_COMMANDE.has(vue) || DETAIL_MIXTE.has(vue)
    const detailLivraison = DETAIL_LIVRAISON.has(vue) || DETAIL_MIXTE.has(vue)
    const creeCommande = CREATION_COMMANDE.has(vue)
    const canCreate = creeCommande ? (vue === "mes-commandes" ? boutiquePerm : manage) : vue === "livraisons" && manage
    const findCommande = (id: string) => (detailCommande ? ctx.commandes.find((c) => c.id === id) ?? null : null)
    const findLivraison = (id: string) => (detailLivraison ? ctx.livraisons.find((l) => l.id === id) ?? null : null)
    const { creationOpen, viewing } = useDetailDeepLink<CommandeBoutique | LivraisonBoutique>({
        detail: detailCommande || detailLivraison ? detail : undefined,
        baseUrl: url(vue),
        canCreate,
        canUpdate: canCreate,
        canView: true,
        loaded: !ctx.loading,
        find: (id) => findCommande(id) ?? findLivraison(id),
    })
    // Les identifiants sont des UUID : une commande et une livraison ne se confondent pas.
    const commandeVue = viewing ? findCommande(viewing.id) : null
    const livraisonVue = viewing && !commandeVue ? findLivraison(viewing.id) : null

    // Côté boutique, un lien profond (réception d'une livraison, fiche d'une
    // commande) impose sa boutique.
    const imposee = espace !== "boutique" ? null
        : vue === "reception" && detail ? ctx.livraisons.find((l) => l.id === detail)?.boutique_id ?? null
            : commandeVue?.boutique_id ?? null
    const { boutique, choisir, actives } = useBoutiqueCourante(ctx.boutiques, imposee)

    // Modifier une commande n'est pas une adresse : c'est un état local.
    const [editCommande, setEditCommande] = useState<{ commande: CommandeBoutique; lignes: AvancementLigne[] } | null>(null)
    const [preparing, setPreparing] = useState(false)

    const go = (target: CommandeVue, id?: string, options?: { replace?: boolean; scan?: boolean }) =>
        navigate(url(target, id), { replace: options?.replace, state: options?.scan ? { scan: true } : undefined })
    /** Ouvre un détail sans quitter une vue mixte (À faire, Planning). */
    const ouvrir = (fallback: CommandeVue, id: string) => go(DETAIL_MIXTE.has(vue) ? vue : fallback, id)

    /** « Préparer » : la livraison est créée d'un geste et s'ouvre aussitôt. */
    const preparer = async (commande: CommandeBoutique) => {
        setPreparing(true)
        const id = await ctx.preparerCommande(commande)
        setPreparing(false)
        if (id) ouvrir("livraisons", id)
    }

    const today = toDay(new Date())
    const file = useMemo(() => fileDeTravail(ctx.commandes, ctx.livraisons, today), [ctx.commandes, ctx.livraisons, today])
    const enCours = ctx.commandes.filter((c) => c.statut === "ouverte" || c.statut === "en_cours").length
    const sections: SectionTab<VueEntrepot>[] = [
        { id: "a-faire", label: "À faire", icon: ClipboardList, count: file.a_preparer.length + file.preparation.length + file.a_regler.length },
        { id: "commandes", label: "Commandes", icon: ShoppingCart, count: enCours },
        { id: "livraisons", label: "Livraisons", icon: Container, count: file.a_regler.length, alert: true },
        { id: "planning", label: "Planning", icon: CalendarRange },
        { id: "boutiques", label: "Boutiques", icon: Store },
    ]

    // L'accueil porte déjà son bouton de saisie : pas de doublon dans l'en-tête.
    const action: ComponentProps<typeof BoardHeader>["action"] = espace !== "entrepot" || !manage || vue === "a-faire" ? undefined
        : vue === "livraisons" ? { label: "Livraison hors commande", onClick: () => go("livraisons", "new"), icon: Plus }
            : { label: "Saisir une commande", onClick: () => go("commandes", "new"), icon: Plus }

    return (
        <div className="flex flex-col gap-4 p-4">
            <BoardHeader
                title={espace === "boutique" ? "Ma boutique" : "Commandes boutiques"}
                theme={GESTION_THEME.section}
                description={ctx.loading ? "Chargement…"
                    : espace === "boutique" ? "Réception des livraisons et suivi des commandes"
                        : `${enCours} commande${enCours > 1 ? "s" : ""} en cours · ${file.en_route.length} livraison${file.en_route.length > 1 ? "s" : ""} en route`}
                // Montrée dès qu'on a un pied dans l'entrepôt : l'espace boutique y
                // apparaît, verrouillé si besoin, pour qu'on sache où est le scan.
                trailing={(espaces.length > 1 || manage) && (
                    <EspaceSwitch value={espace} accessibles={espaces} onChange={(e) => go(VUE_PAR_DEFAUT[e])} />
                )}
                action={action}
            />

            {espace === "entrepot" ? (
                <>
                    <SectionTabs tabs={sections} value={vue as VueEntrepot} onChange={(v) => go(v)} />
                    {vue === "a-faire" && (
                        <FileDeTravailView
                            onSaisir={manage ? () => go("a-faire", "new") : undefined}
                            onPreparer={(c) => (manage ? void preparer(c) : go("a-faire", c.id))}
                            onOpenCommande={(c) => go("a-faire", c.id)}
                            onOpenLivraison={(l) => go("a-faire", l.id)}
                            onReceptionner={boutiquePerm ? (l) => go("reception", l.id) : undefined}
                            busy={preparing}
                        />
                    )}
                    {vue === "planning" && (
                        <PlanningView
                            onOpenLivraison={(l) => go("planning", l.id)}
                            onOpenCommande={(c) => go("planning", c.id)}
                            onShowLivraisons={() => go("livraisons")}
                            onShowCommandes={() => go("commandes")}
                        />
                    )}
                    {vue === "commandes" && <CommandesTable onOpen={(c) => go("commandes", c.id)} onCreate={manage ? () => go("commandes", "new") : undefined} />}
                    {vue === "livraisons" && <LivraisonsTable onOpen={(l) => go("livraisons", l.id)} onCreate={manage ? () => go("livraisons", "new") : undefined} />}
                    {vue === "boutiques" && <BoutiquesView canEdit={manage} />}
                </>
            ) : (
                <BoutiqueEspace
                    vue={vue as VueBoutique}
                    detail={detail}
                    boutique={boutique}
                    actives={actives}
                    onChoisir={(id) => {
                        choisir(id)
                        // Changer de boutique quitte le détail, qui appartenait à l'autre.
                        if (detail) go(vue, undefined, { replace: true })
                    }}
                    go={go}
                    autoScan={(location.state as { scan?: boolean } | null)?.scan === true}
                    canCommander={boutiquePerm}
                />
            )}

            {/* Saisie et modification de commande — des deux espaces */}
            <CommandeFormSheet
                open={(creeCommande && creationOpen) || editCommande !== null}
                commande={editCommande?.commande ?? null}
                lignesInitiales={editCommande?.lignes.map((l) => ({ category_id: l.category_id, kg_demande: l.kg_demande }))}
                boutiqueFixe={espace === "boutique" ? boutique?.id ?? null : null}
                onClose={() => (editCommande ? setEditCommande(null) : go(vue))}
                onSaved={(id) => {
                    setEditCommande(null)
                    go(creeCommande ? vue : "commandes", id, { replace: creationOpen })
                }}
            />
            <CommandeDetailSheet
                commande={editCommande ? null : commandeVue}
                espace={espace}
                busy={preparing}
                onClose={() => go(vue)}
                onEdit={(lignes) => commandeVue && setEditCommande({ commande: commandeVue, lignes })}
                onPrepare={() => commandeVue && void preparer(commandeVue)}
                onOpenLivraison={(l) => (espace === "entrepot" ? ouvrir("livraisons", l.id) : go("reception", l.id))}
            />

            {/* Livraison hors commande (réassort) ; celle d'une commande se prépare d'un clic */}
            <LivraisonFormSheet
                open={vue === "livraisons" && creationOpen}
                commandeId={null}
                onClose={() => go(vue)}
                onCreated={(id) => go("livraisons", id, { replace: true })}
            />
            <LivraisonBoutiqueSheet
                livraison={livraisonVue}
                onClose={() => go(vue)}
                onOpenCommande={(id) => ouvrir("commandes", id)}
                onOpenReception={(l) => go("reception", l.id)}
            />
        </div>
    )
}
