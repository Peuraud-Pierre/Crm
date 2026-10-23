import {
    m,
    useAnimationControls,
    useTransform,
    type TargetAndTransition,
} from "framer-motion"
import { memo, useEffect, useRef } from "react"
import { EASE } from "@/shared/lib/motion"
import { cn } from "@/shared/lib/utils"
import type { AuthMood } from "./authMood"
import { LOGO_LETTERS, LOGO_VIEWBOX, type LogoLetter } from "./logoLetters"
import type { PointerSprings } from "./usePointerSprings"

/*
 * Logo NOKK_PROJECT vivant : le tracé de public/nokk_project_logo.svg découpé en
 * lettres (logoLetters.ts), chacune animée seule.
 *
 * Trois couches par lettre, pour que les mouvements se composent au lieu de
 * s'écraser :
 *   1. parallaxe (suit le pointeur, profondeur propre à chaque lettre) ;
 *   2. humeur (repos flottant, vague d'attente, secousse, saut de succès,
 *      saut à chaque frappe) ;
 *   3. tracé : à l'intro, le mot s'écrit lettre après lettre comme tracé
 *      au stylo, à sa place définitive, puis se remplit. La page apparaît
 *      ensuite autour de lui (AuthShell).
 *
 * Mouvement réduit : ni intro, ni flottement, ni parallaxe ; seules restent
 * les différences d'état utiles (opacité du mode « secret »).
 */

interface LivingLogoProps {
    mood: AuthMood
    /** Compteur de frappes : chaque incrément fait sauter la lettre suivante. */
    hops: number
    pointer: PointerSprings
    /** Joue l'intro : le mot se trace au stylo, puis se remplit. */
    intro: boolean
    reduced: boolean
    className?: string
}

/** Timing du tracé de l'intro (secondes) : départ, durée par lettre,
 *  décalage entre deux lettres, début et durée du remplissage. Le départ
 *  laisse passer le montage de la page, qui occupe les premières images. */
const DRAW = { start: 0.25, draw: 1, step: 0.11, fillAt: 0.85, fill: 0.45 } as const

/** Fin de l'intro, quand la dernière lettre est remplie (ms) : l'AuthShell
 *  cale l'apparition de la page dessus. */
export const DRAW_INTRO_MS = Math.round((DRAW.start + DRAW.fillAt + DRAW.step * 5 + DRAW.fill) * 1000)

const SETTLE = { type: "spring", stiffness: 220, damping: 16 } as const

/** Cible d'animation de chaque humeur, pour la lettre `i`. */
function moodTarget(mood: AuthMood, i: number, reduced: boolean): TargetAndTransition {
    if (reduced) {
        return { x: 0, y: 0, rotate: 0, scale: 1, opacity: mood === "secret" ? 0.6 : 1 }
    }
    switch (mood) {
        case "idle":
            return {
                x: 0,
                rotate: 0,
                scale: 1,
                opacity: 1,
                y: [0, -3.6, 0],
                transition: {
                    y: {
                        duration: 3 + i * 0.37,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.15,
                    },
                    default: SETTLE,
                },
            }
        case "secret":
            // On ne regarde pas : les lettres se tassent et s'estompent.
            return {
                x: 0,
                y: 2,
                // Chaque lettre « tourne la tête » d'un côté ou de l'autre.
                rotate: i % 2 ? 4 : -4,
                scale: 0.95,
                opacity: 0.6,
                transition: SETTLE,
            }
        case "busy":
            return {
                x: 0,
                rotate: 0,
                scale: 1,
                opacity: 1,
                y: [0, -6, 0],
                transition: {
                    y: {
                        duration: 0.7,
                        repeat: Infinity,
                        repeatDelay: 0.35,
                        ease: "easeInOut",
                        delay: i * 0.08,
                    },
                    default: SETTLE,
                },
            }
        case "error":
            return {
                y: 0,
                scale: 1,
                opacity: 1,
                x: [0, -3.5, 3.5, -2.5, 2.5, 0],
                rotate: [0, -7, 6, -3, 0],
                transition: { duration: 0.55, delay: i * 0.025, ease: "easeOut" },
            }
        case "success":
            return {
                x: 0,
                rotate: 0,
                opacity: 1,
                y: [0, -11, 0],
                scale: [1, 1.14, 1],
                transition: { duration: 0.65, delay: i * 0.06, ease: EASE.emphasized },
            }
    }
}

function LetterView({
    letter,
    index,
    mood,
    hopped,
    pointer,
    intro,
    reduced,
}: {
    letter: LogoLetter
    index: number
    mood: AuthMood
    /** Nombre de sauts destinés à cette lettre. */
    hopped: number
    pointer: PointerSprings
    intro: boolean
    reduced: boolean
}) {
    const controls = useAnimationControls()
    const moodRef = useRef(mood)

    // Profondeur de parallaxe : les lettres n'avancent pas d'un bloc, le mot
    // prend du relief quand le pointeur bouge.
    const depth = 0.55 + ((index * 7) % 5) * 0.18
    const px = useTransform(pointer.x, (v) => v * depth * 3.2)
    const py = useTransform(pointer.y, (v) => v * depth * 2.2)
    const pr = useTransform(pointer.x, (v) => v * depth * 3.5)

    useEffect(() => {
        moodRef.current = mood
        void controls.start(moodTarget(mood, index, reduced))
    }, [mood, index, reduced, controls])

    // Saut à la frappe : bref, puis retour à l'humeur en cours.
    useEffect(() => {
        if (hopped === 0 || reduced) return
        const current = moodRef.current
        if (current === "busy" || current === "success") return
        void controls
            .start({
                y: [current === "secret" ? 2 : 0, -7, 0],
                rotate: [0, index % 2 ? 7 : -7, 0],
                transition: { duration: 0.34, ease: "easeOut" },
            })
            .then(() => controls.start(moodTarget(moodRef.current, index, reduced)))
    }, [hopped, index, reduced, controls])

    return (
        <m.g style={reduced ? undefined : { x: px, y: py, rotate: pr }}>
            <m.g
                animate={controls}
                whileHover={reduced ? undefined : { scale: 1.08 }}
                whileTap={reduced ? undefined : { scale: 0.9 }}
            >
                <DrawnPath letter={letter} index={index} intro={intro && !reduced} />
            </m.g>
        </m.g>
    )
}

/** Mémoïsée : seule la lettre qui saute se re-rend à la frappe. */
const Letter = memo(LetterView)

function DrawnPath({ letter, index, intro }: { letter: LogoLetter; index: number; intro: boolean }) {
    return (
        <m.path
            d={letter.d}
            fill="currentColor"
            stroke="currentColor"
            // Trait assez marqué pour que le tracé de l'intro se lise.
            strokeWidth={0.5}
            strokeLinejoin="round"
            initial={intro ? { pathLength: 0, fillOpacity: 0 } : false}
            animate={{ pathLength: 1, fillOpacity: 1 }}
            transition={{
                pathLength: { duration: DRAW.draw, delay: DRAW.start + index * DRAW.step, ease: EASE.emphasized },
                fillOpacity: { duration: DRAW.fill, delay: DRAW.start + DRAW.fillAt + index * DRAW.step },
            }}
        />
    )
}

export function LivingLogo({
    mood,
    hops,
    pointer,
    intro,
    reduced,
    className,
}: LivingLogoProps) {
    const count = LOGO_LETTERS.length
    return (
        <svg
            viewBox={LOGO_VIEWBOX}
            role="img"
            aria-label="NOKK_PROJECT"
            className={cn("block h-auto w-full overflow-visible select-none", className)}
        >
            {LOGO_LETTERS.map((letter, i) => (
                <Letter
                    // Deux « E » : la position fait partie de l'identité.
                    key={`${letter.char}-${letter.box.x}`}
                    letter={letter}
                    index={i}
                    mood={mood}
                    // La frappe n°k fait sauter la lettre k modulo 6.
                    hopped={hops <= i ? 0 : Math.floor((hops - 1 - i) / count) + 1}
                    pointer={pointer}
                    intro={intro}
                    reduced={reduced}
                />
            ))}
        </svg>
    )
}
