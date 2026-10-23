import { useEffect, useState } from "react"
import { fetchLatestPublishedVersion } from "../../services/changelogService"

/**
 * Numéro de version de l'application, affiché dans la sidebar.
 *
 * Volontairement autonome : la sidebar lisait jusqu'ici le contexte
 * changelog complet, ce qui obligeait à monter un provider chargeant
 * toutes les versions, tous leurs éléments et toutes les catégories —
 * pour chaque utilisateur, à chaque ouverture — afin d'afficher une
 * chaîne de caractères. Ici, une requête d'une ligne et d'une colonne.
 *
 * Une erreur n'est pas signalée à l'utilisateur : l'absence de numéro de
 * version dans la sidebar est un détail cosmétique, un toast d'erreur au
 * démarrage n'en serait pas un.
 */
export function useAppVersion(): string | null {
    const [version, setVersion] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        fetchLatestPublishedVersion()
            .then((v) => {
                if (!cancelled) setVersion(v)
            })
            .catch((err) => {
                console.error("[useAppVersion]", err)
            })

        return () => {
            cancelled = true
        }
    }, [])

    return version
}
