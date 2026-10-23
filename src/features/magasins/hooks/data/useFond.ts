import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as fondService from "@/features/magasins/services/fondService"
import type { Etage, EtagePatch, FondCalage } from "@/features/magasins/types/magasin.types"
import { defaultCalage, FondImageError, toFondImage } from "@/features/magasins/utils/fondImage"
import type { Bounds, Rect } from "@/features/magasins/utils/planGeometry"

export interface FondLayer {
    url: string
    rect: Rect
    opacity: number
}

interface UseFondOptions {
    /** Étage affiché : chaque niveau a son plan importé. `null` au chargement. */
    etage: Etage | null
    /** Cadre du magasin, pour le calage par défaut. */
    bounds: Bounds
    /** Met à jour l'étage ; `silent` évite un toast par réglage. */
    update: (id: string, patch: EtagePatch, options?: { silent?: boolean }) => Promise<boolean>
}

/**
 * Plan importé d'un étage : URL signée de l'image (vignette), envoi d'un
 * nouveau plan (PDF ou photo), calage en mètres pour le décalque, et retrait.
 */
export function useFond({ etage, bounds, update }: UseFondOptions) {
    const [url, setUrl] = useState<{ path: string; value: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const path = etage?.fond_path ?? null

    // URL signée, rafraîchie quand le fichier change. L'état garde le chemin
    // de l'URL : celle d'un ancien fichier n'est jamais servie pour le nouveau.
    useEffect(() => {
        if (!path) return
        let cancelled = false
        fondService
            .fondUrl(path)
            .then((value) => {
                if (!cancelled) setUrl({ path, value })
            })
            .catch((err) => {
                console.error(err)
                if (!cancelled) toast.error("Impossible d'afficher le plan importé.")
            })
        return () => {
            cancelled = true
        }
    }, [path])

    const imageUrl = path && url?.path === path ? url.value : null

    const layer: FondLayer | null =
        etage &&
        imageUrl &&
        etage.fond_x != null &&
        etage.fond_y != null &&
        etage.fond_largeur != null &&
        etage.fond_profondeur != null
            ? {
                  url: imageUrl,
                  rect: { x: etage.fond_x, y: etage.fond_y, w: etage.fond_largeur, h: etage.fond_profondeur },
                  opacity: etage.fond_opacite,
              }
            : null

    const upload = useCallback(
        async (file: File): Promise<boolean> => {
            if (!etage) return false
            setBusy(true)
            try {
                const image = await toFondImage(file)
                const newPath = await fondService.uploadFond(`${etage.magasin_id}/${etage.id}`, image.blob, image.extension)
                const ok = await update(
                    etage.id,
                    { fond_path: newPath, ...defaultCalage(image, bounds, etage.fond_opacite) },
                    { silent: true },
                )
                if (!ok) {
                    await fondService.removeFond(newPath).catch(() => {})
                    return false
                }
                if (etage.fond_path) await fondService.removeFond(etage.fond_path).catch(() => {})
                toast.success("Plan importé : mettez-le en fond pour le caler")
                return true
            } catch (err) {
                console.error(err)
                toast.error(err instanceof FondImageError ? err.message : "Envoi du plan impossible.")
                return false
            } finally {
                setBusy(false)
            }
        },
        [etage, bounds, update],
    )

    const setCalage = useCallback(
        async (calage: Partial<FondCalage>) => (etage ? update(etage.id, calage, { silent: true }) : false),
        [etage, update],
    )

    const remove = useCallback(async () => {
        if (!etage?.fond_path) return
        const old = etage.fond_path
        if (await update(etage.id, { fond_path: null }, { silent: true })) {
            await fondService.removeFond(old).catch(() => {})
            toast.success("Plan importé retiré")
        }
    }, [etage, update])

    return { layer, imageUrl, busy, upload, setCalage, remove, hasFond: Boolean(path) }
}

export type FondApi = ReturnType<typeof useFond>
