import { createContext, use, type ReactNode } from "react"
import { addDays, format, parseISO } from "date-fns"
import { useReferentialContext } from "@/features/stock"
import { useCommandes } from "@/features/commandes/hooks/data/useCommandes"
import * as service from "@/features/commandes/services/commandeService"
import type { BoutiquePayload } from "@/features/commandes/services/commandeService"
import { prochainLundi, toDay } from "@/features/commandes/utils/planning"
import type {
    Boutique,
    CartonInput,
    CommandeBoutique,
    CommandeInput,
    CommandeLigneInput,
    LivraisonBoutiqueInput,
    ReceptionInput,
} from "@/features/commandes/types/commande.types"

/**
 * État de la page Commandes boutiques : boutiques, commandes, livraisons et
 * toutes les écritures. Monté par la route `routes/Commandes.tsx`.
 *
 * Les catégories sont celles du stock principal (`ReferentialProvider`,
 * monté par le routeur) : une commande demande des kilos par catégorie.
 *
 * Chaque écriture rend un résultat, ou `null` / `false` en échec, l'erreur
 * étant déjà signalée : un formulaire ne se referme que sur un succès.
 */
function useCommandeValue() {
    const data = useCommandes()
    const { run } = data
    const { categories } = useReferentialContext()

    const ok = async (p: Promise<unknown>) => (await p) !== null
    const done = (p: Promise<void>) => p.then(() => true)

    return {
        ...data,
        boutiqueById: new Map(data.boutiques.map((b) => [b.id, b])),
        categories,
        categoryNom: (id: string) => categories.find((c) => c.id === id)?.name ?? "Catégorie inconnue",

        // Boutiques
        createBoutique: (p: BoutiquePayload) => run<Boutique>("de la boutique", "create", () => service.insertBoutique(p)),
        updateBoutique: (id: string, p: Partial<BoutiquePayload>) => ok(run("de la boutique", "update", () => service.updateBoutique(id, p))),
        deleteBoutique: (id: string) => ok(run("de la boutique", "delete", () => done(service.deleteBoutique(id)))),

        // Commandes
        createCommande: (input: CommandeInput, lignes: CommandeLigneInput[]) =>
            run("de la commande", "create", () => service.insertCommande(input, lignes)),
        saveCommande: (id: string, input: Partial<CommandeInput>, lignes: CommandeLigneInput[]) =>
            ok(run("de la commande", "update", async () => {
                await service.updateCommande(id, input)
                await service.replaceCommandeLignes(id, lignes)
                return true
            })),
        annulerCommande: (id: string) => ok(run("de la commande", "update", () => done(service.annulerCommande(id)))),
        cloturerCommande: (id: string, motif: string) =>
            ok(run("de la commande", "update", () => done(service.cloturerCommande(id, motif)))),

        // Livraisons
        createLivraison: (input: LivraisonBoutiqueInput) =>
            run("de la livraison", "create", () => service.insertLivraison(input)),
        /**
         * « Préparer » une commande, en un geste : crée sa livraison (partielle
         * si besoin) avec des dates par défaut — préparation aujourd'hui,
         * départ le lundi qui vient, arrivée le lendemain — ajustables dans la
         * fiche. Rend l'id de la livraison.
         */
        preparerCommande: (commande: CommandeBoutique) => {
            const lundi = prochainLundi(new Date())
            return run("de la livraison", "create", () => service.insertLivraison({
                commande_id: commande.id,
                boutique_id: commande.boutique_id,
                date_preparation_prevue: toDay(new Date()),
                date_expedition_prevue: lundi,
                date_livraison_prevue: format(addDays(parseISO(lundi), 1), "yyyy-MM-dd"),
                note: null,
            }))
        },
        updateLivraison: (id: string, input: Partial<Omit<LivraisonBoutiqueInput, "boutique_id">>) =>
            ok(run("de la livraison", "update", () => service.updateLivraison(id, input))),
        annulerLivraison: (id: string) => ok(run("de la livraison", "update", () => service.annulerLivraison(id))),
        deleteLivraison: (id: string) => ok(run("de la livraison", "delete", () => done(service.deleteLivraison(id)))),
        expedierLivraison: (id: string) => ok(run("de la livraison", "update", () => done(service.expedierLivraison(id)))),
        cloturerLivraison: (id: string) => ok(run("de la livraison", "update", () => done(service.cloturerLivraison(id)))),

        // Palettes et cartons
        addPalette: (livraisonId: string) => run("de la palette", "create", () => service.insertPalette(livraisonId)),
        deletePalette: (id: string) => ok(run("de la palette", "delete", () => done(service.deletePalette(id)))),
        addCartons: (cartons: CartonInput[]) => ok(run("du carton", "create", () => done(service.insertCartons(cartons)))),
        updateCarton: (id: string, p: Partial<Omit<CartonInput, "livraison_id">>) =>
            ok(run("du carton", "update", () => service.updateCarton(id, p))),
        deleteCarton: (id: string) => ok(run("du carton", "delete", () => done(service.deleteCarton(id)))),

        // Réception
        findCartonByCode: service.findCartonByCode,
        receptionnerCarton: (id: string, input: ReceptionInput) =>
            run("du carton", "update", () => service.receptionnerCarton(id, input)),
    }
}

export type CommandeContextValue = ReturnType<typeof useCommandeValue>

const CommandeContext = createContext<CommandeContextValue | null>(null)

export function CommandeProvider({ children }: { children: ReactNode }) {
    const value = useCommandeValue()
    return <CommandeContext value={value}>{children}</CommandeContext>
}

export function useCommandeContext(): CommandeContextValue {
    const ctx = use(CommandeContext)
    if (!ctx) throw new Error("useCommandeContext doit être utilisé sous <CommandeProvider>")
    return ctx
}
