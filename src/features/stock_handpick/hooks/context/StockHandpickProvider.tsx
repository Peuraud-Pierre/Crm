import type { ReactNode } from "react"
import { ReferentialHandpickProvider } from "./ReferentialHandpickContext"
import { BalleHandpickProvider } from "./BalleHandpickContext"
import { FluxHandpickProvider } from "./FluxHandpickContext"

/**
 * Compose les providers du module et sert de point d'import unique pour les
 * `use*Context` : les composants importent depuis ce fichier, jamais depuis
 * le contexte individuel, pour qu'un déplacement de domaine ne se propage pas
 * dans toute l'arborescence.
 *
 * Ordre : le référentiel (données stables, consommées par tous les autres
 * domaines) vient en premier. Les domaines métier frères — inventaire, flux,
 * historique — s'insèrent ensuite, à mesure qu'ils sont livrés.
 *
 * L'onglet actif n'est jamais dans un contexte : il vient de l'URL
 * (docs/ROUTING.md).
 */
export default function StockHandpickProvider({ children }: { children: ReactNode }) {
    return (
        <ReferentialHandpickProvider>
            <BalleHandpickProvider>
                <FluxHandpickProvider>{children}</FluxHandpickProvider>
            </BalleHandpickProvider>
        </ReferentialHandpickProvider>
    )
}

export { useReferentialHandpickContext } from "./ReferentialHandpickContext"
export { useBalleHandpickContext } from "./BalleHandpickContext"
export { useFluxHandpickContext } from "./FluxHandpickContext"
