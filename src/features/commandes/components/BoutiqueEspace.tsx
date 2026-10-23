import { ScanLine, ShoppingCart, Store, Truck } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import type { Boutique, CommandeBoutique, CommandeVue, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { BoutiqueSwitcher, BoutiqueTabBar, type BoutiqueTab } from "./BoutiqueBar"
import { BoutiqueCommandes } from "./BoutiqueCommandes"
import { BoutiqueHome } from "./BoutiqueHome"
import { ReceptionView } from "./ReceptionView"
import { SectionTabs } from "./SectionTabs"

type VueBoutique = Extract<CommandeVue, "accueil" | "reception" | "mes-commandes">

interface BoutiqueEspaceProps {
    vue: VueBoutique
    /** Segment `detail` : la livraison en réception (vue `reception`). */
    detail?: string
    boutique: Boutique | null
    actives: readonly Boutique[]
    onChoisir: (boutiqueId: string) => void
    /** Navigue vers une vue de l'espace, éventuellement sur un détail. */
    go: (vue: VueBoutique, id?: string, options?: { replace?: boolean; scan?: boolean }) => void
    /** Le scanner s'ouvre d'emblée (bouton « Scanner » de l'accueil). */
    autoScan: boolean
    canCommander: boolean
}

/**
 * L'espace BOUTIQUE, simulé dans nokk_project en V1, pensé pour le téléphone
 * et la tablette : une colonne centrée, de gros boutons, des onglets en bas
 * de l'écran à portée de pouce. Tout y est vu depuis UNE boutique, choisie
 * en tête (en V2, elle viendra du compte).
 */
export function BoutiqueEspace({ vue, detail, boutique, actives, onChoisir, go, autoScan, canCommander }: BoutiqueEspaceProps) {
    const { livraisons } = useCommandeContext()
    const attendues = boutique
        ? livraisons.filter((l) => l.boutique_id === boutique.id && (l.statut === "expediee" || l.statut === "en_reception")).length
        : 0

    const tabs: BoutiqueTab<VueBoutique>[] = [
        { id: "accueil", label: "À recevoir", icon: Truck, badge: attendues },
        { id: "reception", label: "Scanner", icon: ScanLine },
        { id: "mes-commandes", label: "Commandes", icon: ShoppingCart },
    ]
    const nouvelle = canCommander ? () => go("mes-commandes", "new") : undefined

    return (
        // `pb-24` : la barre d'onglets fixe ne recouvre jamais le bas du contenu.
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-24 md:pb-0">
            {actives.length > 0 && <BoutiqueSwitcher boutique={boutique} actives={actives} onChange={onChoisir} />}

            {actives.length === 0 ? (
                <EmptyState icon={Store} title="Aucune boutique" description="L'entrepôt doit d'abord créer les boutiques (vue « Boutiques »)." />
            ) : !boutique ? (
                <EmptyState icon={Store} title="Quelle boutique êtes-vous ?" description="Choisissez votre boutique ci-dessus : ce poste s'en souviendra." />
            ) : (
                <>
                    <SectionTabs className="hidden md:block" tabs={tabs.map((t) => ({ ...t, count: t.badge }))} value={vue} onChange={(v) => go(v)} />
                    {vue === "accueil" && (
                        <BoutiqueHome
                            boutiqueId={boutique.id}
                            onScan={() => go("reception", undefined, { scan: true })}
                            onReceive={(l: LivraisonBoutique) => go("reception", l.id)}
                            onOpenCommande={(c: CommandeBoutique) => go("mes-commandes", c.id)}
                            onShowCommandes={() => go("mes-commandes")}
                        />
                    )}
                    {vue === "reception" && (
                        <ReceptionView
                            boutiqueId={boutique.id}
                            livraisonId={detail && detail !== "new" ? detail : null}
                            onSelect={(id) => go("reception", id ?? undefined, { replace: true })}
                            autoScan={autoScan}
                        />
                    )}
                    {vue === "mes-commandes" && (
                        <BoutiqueCommandes boutiqueId={boutique.id} onOpen={(c) => go("mes-commandes", c.id)} onCreate={nouvelle} />
                    )}
                </>
            )}

            <BoutiqueTabBar tabs={tabs} value={vue} onChange={(v) => go(v)} />
        </div>
    )
}
