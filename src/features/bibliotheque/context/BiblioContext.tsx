// ── BiblioContext.tsx ─────────────────────────────────────────────────────────
// RÔLE : Contexte React de la feature Bibliothèque.
//
// Problème résolu — le "prop drilling" :
//   Sans contexte, il faudrait passer les mêmes données (thematiques, dialog, lang…)
//   en props de composant en composant sur plusieurs niveaux, ce qui devient vite
//   illisible. Le contexte rend ces données disponibles à N'IMPORTE QUEL niveau
//   de l'arbre sans passer par les niveaux intermédiaires.
//
// Fonctionnement :
//   1. BiblioProvider appelle useBiblioPage() une seule fois et stocke le résultat
//      dans le contexte.
//   2. Tout composant à l'intérieur du Provider peut lire ce contexte via
//      useBiblioContext() sans recevoir de props.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx     → monte BiblioProvider autour de BiblioPage
//   - Tous les composants de la feature → appellent useBiblioContext() pour lire
//     les données et actions (BiblioSidebar, QRCard, FormatEditDialog, etc.)

import { createContext, use, type ReactNode } from "react"
import { useBiblioPage } from "../hooks/useBiblioPage"

// ReturnType<typeof useBiblioPage> infère automatiquement le type de la valeur du contexte
// directement depuis le hook. Avantage : si useBiblioPage change (ajout d'un champ),
// le type se met à jour automatiquement — pas besoin de deux déclarations à synchroniser.
type BiblioContextValue = ReturnType<typeof useBiblioPage>

// createContext<T | null>(null) : null est la valeur par défaut (en dehors du Provider).
// On utilise null plutôt qu'une valeur fictive pour pouvoir détecter l'utilisation
// en dehors du Provider et lever une erreur explicite.
const BiblioContext = createContext<BiblioContextValue | null>(null)

// BiblioProvider : encapsule les enfants dans le contexte.
// "children" représente tout le JSX placé entre <BiblioProvider> et </BiblioProvider>.
export function BiblioProvider({ children }: { children: ReactNode }) {
    const value = useBiblioPage() // appel unique ici — pas dans chaque composant
    return <BiblioContext value={value}>{children}</BiblioContext>
}

// useBiblioContext : hook de consommation du contexte.
// Lève une erreur claire si utilisé sans Provider, plutôt qu'un crash muet.
export function useBiblioContext(): BiblioContextValue {
    const ctx = use(BiblioContext)
    if (!ctx) throw new Error("useBiblioContext doit être utilisé dans un <BiblioProvider>")
    return ctx
}
