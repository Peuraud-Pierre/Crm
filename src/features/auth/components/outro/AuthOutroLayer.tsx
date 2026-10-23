import { LazyMotion, domAnimation, useMotionValue } from "framer-motion"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { greeting, readFirstName } from "@/features/auth/utils/rememberedAccount"
import { EASE } from "@/shared/lib/motion"
import { cn } from "@/shared/lib/utils"
import { AuthBackdrop } from "../shell/AuthBackdrop"
import { LivingLogo } from "../shell/LivingLogo"
import { OUTRO_MAX_MS, OUTRO_MIN_MS, authOutro, useAuthOutro, type OutroState } from "./outroStore"

/** Trajet du point de relais au centre de l'écran (ms). */
const CENTER_MS = 650
/** Vol du centre jusqu'au bouton menu (ms). */
const FLIGHT_MS = 950
/** La surface de marque commence à s'effacer un peu après le décollage :
 *  on voit le logo partir avant de voir l'accueil. */
const FADE_DELAY_MS = 180
const FADE_MS = 550
/** Largeur du logo à son arrivée sur le bouton menu (px), juste avant de s'y fondre. */
const LANDED_WIDTH_PX = 30
/** Largeur du logo au centre : une part de l'écran, plafonnée. */
const CENTER_SHARE = { phone: 0.62, wide: 0.34 }
const CENTER_MAX_PX = 420
/** Délai entre « accueil prêt » et le décollage : le premier rendu de la
 *  page occupe le fil principal, on le laisse passer avant de voler. */
const READY_SETTLE_MS = 200
/** Écart vertical du logo au-dessus du centre, pour laisser place à la salutation. */
const CENTER_LIFT_PX = 24

const EMPHASIZED = `cubic-bezier(${EASE.emphasized.join(", ")})`

/**
 * Surcouche de l'outro de connexion, montée hors du routeur (App.tsx) pour
 * survivre au passage de l'écran de connexion à l'application. Voir
 * outroStore.ts pour la coordination d'ensemble.
 *
 * Tout le mouvement passe par la Web Animations API sur `transform`,
 * `opacity` et `color` : il reste fluide pendant que l'accueil se charge
 * et occupe le fil principal.
 */
export function AuthOutroLayer() {
    const outro = useAuthOutro()
    if (outro.phase !== "holding" && outro.phase !== "landing") return null
    return (
        <LazyMotion features={domAnimation}>
            <OutroScene outro={outro} />
        </LazyMotion>
    )
}

/** Sans mesure du logo (cas limite), il part du centre. */
function fallbackRect(): DOMRect {
    const width = Math.min(window.innerWidth * 0.6, 320)
    const height = width / 3.77
    return new DOMRect((window.innerWidth - width) / 2, (window.innerHeight - height) / 2, width, height)
}

function cssColor(name: string): string {
    return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`
}

function OutroScene({ outro }: { outro: OutroState }) {
    const { user } = useAuth()
    // Pointeur immobile : la parallaxe n'a pas sa place pendant l'outro.
    const px = useMotionValue(0)
    const py = useMotionValue(0)
    const pointer = useMemo(() => ({ x: px, y: py }), [px, py])

    const logoRef = useRef<HTMLDivElement>(null)
    const surfaceRef = useRef<HTMLDivElement>(null)
    const greetRef = useRef<HTMLParagraphElement>(null)
    const centerRef = useRef({ dx: 0, dy: 0, scale: 1, at: 0 })

    // Place du relais, figée pour toute la scène.
    const [start] = useState(() => outro.from ?? fallbackRect())
    const firstName = user?.full_name?.trim().split(/\s+/)[0] || readFirstName()
    const message = firstName ? `${greeting()} ${firstName}` : greeting()

    // 1. Du point de relais au centre, la salutation apparaît dessous.
    useLayoutEffect(() => {
        const el = logoRef.current
        const greet = greetRef.current
        if (!el || !greet) return
        const vw = window.innerWidth
        const vh = window.innerHeight
        const share = vw < 640 ? CENTER_SHARE.phone : CENTER_SHARE.wide
        const scale = Math.min(Math.max(Math.min(vw * share, CENTER_MAX_PX) / start.width, 0.6), 1.8)
        const dx = vw / 2 - (start.left + start.width / 2)
        const dy = vh / 2 - CENTER_LIFT_PX - (start.top + start.height / 2)
        centerRef.current = { dx, dy, scale, at: performance.now() }

        el.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], {
            duration: CENTER_MS,
            easing: EMPHASIZED,
            fill: "forwards",
        })
        greet.style.top = `${vh / 2 - CENTER_LIFT_PX + (start.height * scale) / 2 + 20}px`
        greet.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
            duration: 400,
            delay: 350,
            easing: EMPHASIZED,
            fill: "both",
        })
    }, [start])

    // 2. Attente : on part dès que l'accueil est prêt, jamais avant la durée
    //    minimale ni la fin du trajet au centre, au plus tard au plafond.
    useEffect(() => {
        if (outro.phase !== "holding") return
        const now = performance.now()
        const minAt = Math.max(outro.startedAt + OUTRO_MIN_MS, centerRef.current.at + CENTER_MS)
        const maxAt = outro.startedAt + OUTRO_MAX_MS
        const at = outro.ready ? Math.max(minAt, now + READY_SETTLE_MS) : maxAt
        const id = setTimeout(() => authOutro.land(), Math.max(0, Math.min(at, maxAt) - now))
        return () => clearTimeout(id)
    }, [outro.phase, outro.ready, outro.startedAt])

    // 3. Arrivée : la surface s'efface sur l'accueil, le logo vole jusqu'au
    //    bouton menu et s'y fond ; le bouton rebondit (useOutroTarget).
    useEffect(() => {
        if (outro.phase !== "landing") return
        const el = logoRef.current
        const surface = surfaceRef.current
        const greet = greetRef.current
        if (!el || !surface || !greet) return
        const { dx, dy, scale } = centerRef.current
        const target = authOutro.getTarget()
        const rect = target?.getBoundingClientRect()
        const landsOnTarget = !!rect && rect.width > 0

        greet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" })
        const fade = surface.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: FADE_MS,
            delay: FADE_DELAY_MS,
            easing: "ease-in-out",
            fill: "forwards",
        })

        let flight: Animation
        if (rect && landsOnTarget) {
            const endScale = LANDED_WIDTH_PX / start.width
            const ex = rect.left + rect.width / 2 - (start.left + start.width / 2)
            const ey = rect.top + rect.height / 2 - (start.top + start.height / 2)
            // Sa couleur passe de celle de la marque à celle de l'en-tête : il
            // arrive exactement de la teinte de l'icône qu'il va devenir.
            const brand = cssColor("--sidebar-foreground")
            const header = cssColor("--foreground")
            // L'icône s'efface le temps du vol, puis reparaît en rebondissant.
            target?.querySelector("svg")?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: FLIGHT_MS })
            flight = el.animate(
                [
                    { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, color: brand, opacity: 1 },
                    { transform: `translate(${ex}px, ${ey}px) scale(${endScale})`, color: header, opacity: 1, offset: 0.8 },
                    { transform: `translate(${ex}px, ${ey}px) scale(${endScale * 0.6})`, color: header, opacity: 0 },
                ],
                // Accélère puis freine : on voit le logo partir et se poser.
                { duration: FLIGHT_MS, easing: "ease-in-out", fill: "forwards" }
            )
        } else {
            // Pas de bouton à l'écran (l'accueil n'a pas fini de charger au
            // plafond) : le logo s'efface avec la surface.
            flight = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, delay: FADE_DELAY_MS, fill: "forwards" })
        }

        let cancelled = false
        void Promise.all([flight.finished, fade.finished])
            .then(() => {
                if (cancelled) return
                if (landsOnTarget) authOutro.notifyLanded()
                authOutro.finish()
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [outro.phase, start])

    const landing = outro.phase === "landing"

    return (
        // Bloque les clics pendant l'attente ; dès l'arrivée, l'accueil
        // dessous redevient utilisable.
        // `data-auth-outro` : phase en cours, pour les tests de bout en bout
        // (l'accueil a ses propres régions `role="status"`).
        <div data-auth-outro={outro.phase} className={cn("fixed inset-0 z-50", landing && "pointer-events-none")}>
            <div ref={surfaceRef} aria-hidden className="absolute inset-0 isolate overflow-clip bg-sidebar">
                <AuthBackdrop pointer={pointer} reduced={false} mood={landing ? "idle" : "busy"} hops={0} />
            </div>
            <div
                ref={logoRef}
                aria-hidden
                className="absolute text-sidebar-foreground will-change-transform"
                // Position mesurée au relais : forcément en pixels.
                style={{ left: start.left, top: start.top, width: start.width }}
            >
                <LivingLogo mood={landing ? "idle" : "busy"} hops={0} pointer={pointer} intro={false} reduced={false} />
            </div>
            <p
                ref={greetRef}
                role="status"
                className="absolute inset-x-0 text-center text-xl font-semibold tracking-tight text-sidebar-foreground opacity-0 sm:text-2xl"
            >
                {message}
            </p>
        </div>
    )
}
