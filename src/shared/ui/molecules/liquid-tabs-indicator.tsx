import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from "react"
import { cn } from "@/shared/lib/utils"

interface LiquidTabsIndicatorProps {
    /** Conteneur (ex. TabsList) dans lequel chercher l'élément `data-state="active"`. */
    containerRef: RefObject<HTMLElement | null>
    /**
     * Valeur de l'élément actif — déclenche une remesure au changement.
     * Facultatif : sans elle, le changement d'onglet est détecté par le
     * MutationObserver sur `data-state` (voir plus bas). Utile quand le
     * consommateur connaît déjà la valeur active et veut éviter l'observer.
     */
    activeValue?: string
    /**
     * Classes additionnelles (ex. `inset-y-1`, `rounded-full`) pour ajuster la
     * taille/forme de la pastille selon le contexte — surchargent les valeurs
     * par défaut via `cn` (tailwind-merge).
     */
    className?: string
}

interface IndicatorRect {
    left: number
    width: number
}

/**
 * Pastille "liquid glass" qui glisse derrière l'élément actif d'un groupe
 * d'onglets/boutons (recherche `[data-state="active"]` dans `containerRef`).
 * Positionnée en absolu, elle mesure l'élément actif via offsetLeft/offsetWidth
 * (relatifs au conteneur positionné, son offsetParent) plutôt que de dépendre
 * d'un layout figé, pour rester correcte quand les éléments changent de largeur
 * (ex. libellé masqué en mobile).
 */
export function LiquidTabsIndicator({
    containerRef,
    activeValue,
    className,
}: LiquidTabsIndicatorProps) {
    const [rect, setRect] = useState<IndicatorRect | null>(null)
    const [animationsReady, setAnimationsReady] = useState(false)
    const hasMountedRef = useRef(false)
    const selfRef = useRef<HTMLDivElement | null>(null)

    /**
     * Le conteneur ne peut PAS être lu depuis `containerRef` au montage :
     * React attache le ref d'un parent APRÈS avoir exécuté les effets de
     * layout de ses enfants, donc `containerRef.current` est encore `null`
     * quand cette pastille se mesure. On passe par le parent DOM de la
     * pastille — elle est toujours enfant direct du conteneur positionné —
     * et `containerRef` ne sert plus qu'à re-résoudre après coup.
     */
    const getContainer = useCallback(
        () => selfRef.current?.parentElement ?? containerRef.current ?? null,
        [containerRef]
    )

    const measure = useCallback(() => {
        const container = getContainer()
        if (!container) return
        const active = container.querySelector<HTMLElement>('[data-state="active"]')
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure DOM de l'élément actif, impossible à dériver au rendu
        setRect((prev) => {
            // Plus d'élément actif : la pastille doit disparaître, pas rester
            // garée sous l'onglet qui vient d'être désactivé.
            if (!active) return null
            const next = { left: active.offsetLeft, width: active.offsetWidth }
            // Un changement d'onglet déclenche trois notifications (mutation
            // sur l'ancien, sur le nouveau, puis le ResizeObserver). Sans ce
            // bail-out, chacune re-rend un élément purement décoratif.
            if (prev && prev.left === next.left && prev.width === next.width) {
                return prev
            }
            return next
        })
    }, [getContainer])

    /**
     * Mesure initiale dans le ref callback, et non dans un effet de layout :
     * c'est le seul moment du commit où le nœud existe alors que les refs
     * des ancêtres ne sont pas encore posés. Elle reste synchrone, donc
     * l'élément actif est déjà surligné à la première peinture.
     */
    const setSelfRef = useCallback(
        (node: HTMLDivElement | null) => {
            selfRef.current = node
            if (node) measure()
        },
        [measure]
    )

    useLayoutEffect(() => {
        measure()
    }, [measure])

    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- active la transition CSS uniquement après le montage initial
        setAnimationsReady(true)
    }, [])

    // Remesures suivantes (changement d'élément actif) : APRÈS peinture, pour
    // que le navigateur ait peint l'ancienne position avant que le CSS
    // `transition` n'anime vers la nouvelle. Si la mesure se faisait en layout
    // effect ici, React flusherait la nouvelle position avant la moindre
    // peinture et le glissement n'aurait jamais rien à animer.
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true
            return
        }
        measure()
    }, [activeValue, measure])

    // Détection autonome du changement d'onglet : Radix ne publie pas son
    // contexte, et remonter la valeur active jusqu'ici imposerait du
    // prop-drilling à chaque consommateur. Observer `data-state` dans le
    // sous-arbre rend le composant utilisable sans qu'on lui dise quoi que
    // ce soit — c'est ce qui permet à `<TabsList indicator>` d'être drop-in.
    useEffect(() => {
        const container = getContainer()
        if (!container) return
        let frame = 0
        const observer = new MutationObserver(() => {
            // Après peinture : le navigateur doit avoir peint l'ancienne
            // position pour que la transition CSS ait quelque chose à animer.
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(measure)
        })
        observer.observe(container, {
            attributes: true,
            attributeFilter: ["data-state"],
            subtree: true,
        })
        return () => {
            // Sans ce cancel, une frame planifiée juste avant le démontage
            // mesure encore un conteneur détaché.
            cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [getContainer, measure])

    useEffect(() => {
        const container = getContainer()
        if (!container) return
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(container)
        return () => resizeObserver.disconnect()
    }, [getContainer, measure])

    return (
        // Rendue même non mesurée (simplement invisible) : c'est son propre
        // nœud qui sert à retrouver le conteneur, un `return null` avant
        // mesure empêcherait la mesure d'avoir lieu.
        <div
            ref={setSelfRef}
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-y-0.5 left-0 z-0 rounded-sm",
                "bg-sidebar-accent/85 backdrop-blur-md",
                "border border-sidebar-accent/30 shadow-[0_2px_16px_-4px_hsl(var(--sidebar-accent)/0.55)]",
                animationsReady &&
                    "transition-[transform,width] duration-slow ease-emphasized",
                !rect && "opacity-0",
                className
            )}
            style={{
                width: rect?.width ?? 0,
                transform: `translateX(${rect?.left ?? 0}px)`,
            }}
        />
    )
}
