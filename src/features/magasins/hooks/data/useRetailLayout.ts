import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as retailService from "@/features/magasins/services/retailLayoutService"
import * as etageService from "@/features/magasins/services/etageService"
import * as planService from "@/features/magasins/services/planMagasinService"
import * as murService from "@/features/magasins/services/murService"
import { buildLayoutPayload } from "@/features/magasins/utils/layoutPayload"
import type { Magasin, MagasinPatch } from "@/features/magasins/types/magasin.types"

type UpdateMagasin = (id: string, input: MagasinPatch, options?: { silent?: boolean }) => Promise<boolean>

/**
 * Pont vers la console retail : à quelle boutique ce magasin est rattaché, et
 * publication de son plan. Retail n'affiche que ce qui a été publié : les
 * modifications en cours restent invisibles aux boutiques jusqu'au clic.
 */
export function useRetailLayout(magasin: Magasin, update: UpdateMagasin, enabled: boolean) {
    const [shops, setShops] = useState<retailService.RetailShop[]>([])
    const [shopsError, setShopsError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        retailService
            .fetchRetailShops()
            .then((rows) => {
                if (!cancelled) setShops(rows)
            })
            .catch((err: unknown) => {
                console.error(err)
                if (!cancelled) setShopsError("Impossible de charger les boutiques retail.")
            })
        return () => {
            cancelled = true
        }
    }, [enabled])

    const link = useCallback(
        async (shopId: string | null) => {
            const previous = magasin.retail_shop_id
            if (shopId === previous) return
            setBusy(true)
            try {
                // L'ancienne boutique ne doit pas garder un plan qui n'est plus le sien.
                if (previous && magasin.retail_published_at) await retailService.unpublishLayout(previous)
                await update(magasin.id, { retail_shop_id: shopId, retail_published_at: null })
            } catch (err) {
                console.error(err)
                toast.error("Impossible de retirer le plan de l'ancienne boutique retail.")
            } finally {
                setBusy(false)
            }
        },
        [magasin, update],
    )

    const publish = useCallback(async () => {
        const shopId = magasin.retail_shop_id
        if (!shopId) return
        setBusy(true)
        try {
            // Relu en entier : le plan affiché à l'écran ne porte qu'un étage.
            const [etages, zones, emplacements, equipements, murs] = await Promise.all([
                etageService.fetchEtages(magasin.id),
                planService.fetchZones(magasin.id),
                planService.fetchEmplacements(magasin.id),
                planService.fetchEquipements(magasin.id),
                murService.fetchMurs(magasin.id),
            ])
            await retailService.publishLayout(
                shopId,
                buildLayoutPayload(magasin, etages, zones, emplacements, equipements, murs),
            )
            await update(magasin.id, { retail_published_at: new Date().toISOString() }, { silent: true })
            toast.success("Plan publié vers la boutique")
        } catch (err) {
            console.error(err)
            toast.error("La publication du plan vers retail a échoué.")
        } finally {
            setBusy(false)
        }
    }, [magasin, update])

    return { shops, shopsError, busy, link, publish }
}
