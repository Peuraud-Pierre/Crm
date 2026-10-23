import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    sizeBounds,
    type WidgetDef,
    type WidgetSettingValue,
} from "@/shared/types/widget.types"
import { PERSIST_DEBOUNCE_MS } from "../../constants"
import { compact, place, type Rect } from "../../layout/gridEngine"
import { readStoredLayout } from "../../layout/migrateV1"
import {
    deleteUserLayout,
    fetchTemplatesFor,
    fetchUserLayout,
    saveUserLayout,
} from "../../services/dashboardLayoutService"
import {
    emptyLayout,
    type DashboardLayout,
    type LayoutBands,
    type LayoutDensity,
    type LayoutItem,
    type LayoutSource,
} from "../../types/layout.types"
import { getWidget, listAvailableWidgets } from "../../widgets/registry"
import {
    createItem,
    defaultLayout,
    duplicateItem,
    rectOf,
    sanitizeLayout,
} from "../../widgets/resolveLayout"

/**
 * Charge, résout et enregistre la disposition du dashboard.
 *
 * Résolution en cascade, du plus spécifique au plus général :
 *
 *   disposition personnelle → gabarit du rôle → gabarit du service
 *   → modules `starter` déclarés dans le registre
 *
 * Chaque niveau est lu par `readStoredLayout` (qui migre les formats
 * antérieurs) puis nettoyé par `sanitizeLayout` : un gabarit corrompu ne
 * bloque pas, il laisse simplement la main au niveau suivant.
 */
export function useDashboardLayout() {
    const { user, hasPermission, permissionsLoaded } = useAuth()
    const userId = user?.user_id
    const roleId = user?.role_id ?? null
    const serviceId = user?.service_id ?? null

    const [layout, setLayout] = useState<DashboardLayout>(emptyLayout)
    const [source, setSource] = useState<LayoutSource>("default")
    const [loading, setLoading] = useState(true)

    const requestIdRef = useRef(0)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingRef = useRef<DashboardLayout | null>(null)

    /**
     * La disposition courante, doublée dans une ref.
     *
     * Les gestionnaires ci-dessous en ont besoin pour calculer la
     * suivante. S'ils la lisaient depuis l'état, ils dépendraient de
     * `layout` et **changeraient d'identité à chaque geste** — or ils
     * descendent jusqu'à chaque carte du canevas, où cette instabilité
     * empêche toute mémoïsation. En passant par une ref, ils deviennent
     * stables pour la vie du composant.
     *
     * La ref est écrite au même endroit que l'état, jamais pendant le
     * rendu : les deux ne peuvent pas diverger.
     */
    const layoutRef = useRef<DashboardLayout>(layout)

    /** Écrit l'état et sa doublure. Seul point de mutation. */
    const applyLayout = useCallback((next: DashboardLayout) => {
        layoutRef.current = next
        setLayout(next)
    }, [])

    /** Modules que cet utilisateur a le droit de voir. */
    const availableWidgets: WidgetDef[] = useMemo(
        () => (permissionsLoaded ? listAvailableWidgets(hasPermission) : []),
        [permissionsLoaded, hasPermission]
    )

    const load = useCallback(async () => {
        if (!userId) return

        const requestId = ++requestIdRef.current
        try {
            const [rawUserLayout, templates] = await Promise.all([
                fetchUserLayout(userId),
                fetchTemplatesFor(roleId, serviceId),
            ])
            if (requestIdRef.current !== requestId) return

            const personal = readStoredLayout(rawUserLayout)
            if (personal) {
                applyLayout(sanitizeLayout(personal, availableWidgets))
                setSource("user")
                return
            }

            // Le rôle prime sur le service : il décrit le métier de la
            // personne, le service son rattachement.
            const roleTemplate = templates.find((t) => t.role_id === roleId)
            const roleLayout =
                roleTemplate && readStoredLayout(roleTemplate.layout)
            if (roleLayout) {
                applyLayout(sanitizeLayout(roleLayout, availableWidgets))
                setSource("role")
                return
            }

            const serviceTemplate = templates.find(
                (t) => t.service_id === serviceId
            )
            const serviceLayout =
                serviceTemplate && readStoredLayout(serviceTemplate.layout)
            if (serviceLayout) {
                applyLayout(sanitizeLayout(serviceLayout, availableWidgets))
                setSource("service")
                return
            }

            applyLayout(
                sanitizeLayout(defaultLayout(availableWidgets), availableWidgets)
            )
            setSource("default")
        } catch (err) {
            console.error("[useDashboardLayout] load:", err)
            toast.error("Erreur lors du chargement de votre tableau de bord")
            // Repli local : mieux vaut la page par défaut qu'un écran vide.
            applyLayout(defaultLayout(availableWidgets))
            setSource("default")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [userId, roleId, serviceId, availableWidgets, applyLayout])

    useEffect(() => {
        // On attend les permissions : les charger après coup ferait
        // disparaître puis réapparaître les modules gatés.
        if (!userId || !permissionsLoaded) return
        void load()
    }, [userId, permissionsLoaded, load])

    /**
     * Écrit la disposition courante, au plus une fois par salve.
     *
     * Un déplacement traverse plusieurs cases et un redimensionnement
     * plusieurs colonnes : enregistrer à chaque étape produirait une
     * rafale d'écritures pour un seul geste. On garde donc la dernière
     * valeur et on l'écrit quand la main s'arrête.
     */
    const flush = useCallback(async () => {
        const next = pendingRef.current
        if (!next || !userId) return

        pendingRef.current = null
        try {
            await saveUserLayout(userId, next)
            setSource("user")
        } catch (err) {
            console.error("[useDashboardLayout] persist:", err)
            toast.error("Erreur lors de l'enregistrement de la disposition")
        }
    }, [userId])

    const commit = useCallback(
        (next: DashboardLayout) => {
            applyLayout(next)
            pendingRef.current = next

            if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current)
            }
            saveTimerRef.current = setTimeout(() => {
                saveTimerRef.current = null
                void flush()
            }, PERSIST_DEBOUNCE_MS)
        },
        [flush, applyLayout]
    )

    /**
     * Vide la file d'écriture immédiatement, sans attendre le debounce.
     * Sans effet s'il n'y a rien en attente.
     */
    const flushNow = useCallback(() => {
        if (saveTimerRef.current === null) return

        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        void flush()
    }, [flush])

    // Quitter la page ne doit pas perdre le dernier geste.
    useEffect(() => flushNow, [flushNow])

    /**
     * Fermer l'onglet non plus.
     *
     * Le nettoyage ci-dessus couvre les changements de page, mais React
     * ne démonte rien quand l'onglet se ferme ou que l'application passe
     * en arrière-plan : un geste suivi d'une fermeture dans les 600 ms du
     * debounce n'était jamais enregistré.
     *
     * `visibilitychange` et non `beforeunload` : ce dernier n'est plus
     * déclenché de façon fiable sur mobile, où une application mise en
     * arrière-plan peut être supprimée sans autre préavis. `hidden` est
     * le dernier instant garanti pour écrire.
     */
    useEffect(() => {
        function onHidden() {
            if (document.visibilityState === "hidden") flushNow()
        }

        document.addEventListener("visibilitychange", onHidden)
        return () => document.removeEventListener("visibilitychange", onHidden)
    }, [flushNow])

    const setItems = useCallback(
        (items: LayoutItem[]) => commit({ ...layoutRef.current, items }),
        [commit]
    )

    /**
     * Applique un geste sur un module. Le moteur borne, pousse et compacte ;
     * ce hook ne fait que lui passer la main et enregistrer le résultat.
     */
    const placeItem = useCallback(
        (instanceId: string, rect: Rect) => {
            const items = layoutRef.current.items
            const item = items.find((i) => i.instanceId === instanceId)
            const widget = item && getWidget(item.widgetId)
            if (!widget) return

            const next = place(items, instanceId, rect, sizeBounds(widget))

            // Un geste qui ne déplace rien ne s'enregistre pas. Saisir une
            // carte, la bouger de sept pixels et la relâcher dans sa propre
            // case produit une disposition identique — la commiter marquait
            // quand même la page comme personnalisée et déclenchait une
            // écriture en base. Le cas n'a rien de théorique : c'est ce que
            // fait tout clic un peu appuyé sur la poignée.
            if (sameGeometry(items, next)) return

            setItems(next)
        },
        [setItems]
    )

    const addWidget = useCallback(
        (widget: WidgetDef) => {
            const items = layoutRef.current.items
            setItems([...items, createItem(widget, items)])
        },
        [setItems]
    )

    const duplicate = useCallback(
        (instanceId: string) => {
            const items = layoutRef.current.items
            const source = items.find((i) => i.instanceId === instanceId)
            if (!source) return

            setItems([...items, duplicateItem(source, items)])
        },
        [setItems]
    )

    const removeWidget = useCallback(
        (instanceId: string) => {
            // Compactage sans épingle : le trou laissé par un retrait
            // n'a été voulu par personne, contrairement à celui qu'un
            // geste peut délibérément créer.
            setItems(
                compact(
                    layoutRef.current.items.filter(
                        (i) => i.instanceId !== instanceId
                    )
                )
            )
        },
        [setItems]
    )

    const setItemSettings = useCallback(
        (instanceId: string, patch: Record<string, WidgetSettingValue>) => {
            const items = layoutRef.current.items
            const item = items.find((i) => i.instanceId === instanceId)
            if (!item) return

            setItems(
                items.map((i) =>
                    i.instanceId === instanceId
                        ? { ...i, settings: { ...i.settings, ...patch } }
                        : i
                )
            )
        },
        [setItems]
    )

    const setBand = useCallback(
        (band: keyof LayoutBands, open: boolean) => {
            const current = layoutRef.current
            commit({
                ...current,
                bands: { ...current.bands, [band]: open },
            })
        },
        [commit]
    )

    const setDensity = useCallback(
        (density: LayoutDensity) =>
            commit({ ...layoutRef.current, density }),
        [commit]
    )

    /**
     * Efface la disposition personnelle : l'utilisateur repasse sous le
     * gabarit de son rôle, et continuera d'en suivre les évolutions.
     */
    const reset = useCallback(async () => {
        if (!userId) return

        // On annule l'écriture en attente au lieu de la vider : elle
        // porte la disposition qu'on est précisément en train d'effacer.
        if (saveTimerRef.current !== null) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
        }
        pendingRef.current = null

        try {
            await deleteUserLayout(userId)
            await load()
            toast.success("Tableau de bord réinitialisé")
        } catch (err) {
            console.error("[useDashboardLayout] reset:", err)
            toast.error("Erreur lors de la réinitialisation")
        }
    }, [userId, load])

    return {
        layout,
        source,
        loading,
        availableWidgets,
        placeItem,
        addWidget,
        duplicate,
        removeWidget,
        setItemSettings,
        setBand,
        setDensity,
        reset,
        rectOf,
    }
}

/**
 * Deux dispositions occupent-elles exactement les mêmes cases ?
 *
 * Ne compare que la géométrie : les réglages ont leur propre chemin
 * d'enregistrement, et un geste ne les touche jamais.
 */
function sameGeometry(a: LayoutItem[], b: LayoutItem[]): boolean {
    if (a.length !== b.length) return false

    return a.every((item, index) => {
        const other = b[index]
        return (
            other !== undefined &&
            item.instanceId === other.instanceId &&
            item.x === other.x &&
            item.y === other.y &&
            item.w === other.w &&
            item.h === other.h
        )
    })
}
