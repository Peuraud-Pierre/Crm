import { memo, useEffect, useRef } from "react"
import type { AuthMood } from "./authMood"
import { LOGO_LETTERS, LOGO_VIEWBOX } from "./logoLetters"
import type { PointerSprings } from "./usePointerSprings"

/*
 * Fond des écrans d'auth : le mot NOKK_PROJECT en très grand, en contour, sur
 * trois plans qui défilent à des vitesses différentes, comme un tapis de
 * tri vu en profondeur. Le dessin réutilise les tracés du logo vivant
 * (logoLetters.ts) : le fond fait écho au logo au lieu d'être un décor.
 *
 * Il répond aux mêmes humeurs que le logo :
 *   - frappe   : le contour de la lettre qui saute s'éclaire doucement sur
 *                les trois plans, en vague du premier plan vers le fond ;
 *   - attente  : les plans accélèrent (le tapis s'emballe) ;
 *   - erreur   : secousse et teinte `destructive` qui s'estompe ;
 *   - succès   : léger zoom, les contours s'éclairent ;
 *   - secret   : les plans s'estompent.
 * Le pointeur décale chaque plan selon sa profondeur (parallaxe).
 *
 * Canvas 2D plutôt que SVG : trois plans × plusieurs répétitions du mot,
 * redessinés à chaque image, c'est trop de nœuds pour le DOM. Les couleurs
 * sont lues dans les tokens du thème (`--sidebar-foreground`, `--destructive`)
 * et relues quand le thème change.
 *
 * Budget de rendu, mesuré (processeur bridé ×6, sans GPU) : c'est la
 * rastérisation du canvas qui coûte, pas le JavaScript. D'où :
 *   - dégradé et vignette en CSS, peints une fois ; le canvas ne trace que
 *     des contours sur fond transparent ;
 *   - un seul tracé par mot (les six lettres réunies dans un Path2D), les
 *     lettres éclairées seules redessinées à part ;
 *   - résolution plafonnée à 1 px CSS : des traits fins à 7–18 % d'opacité
 *     ne gagnent rien à être rendus en ×2 ou ×3 ;
 *   - 30 images/s : le tapis avance de 6 à 18 px/s, le logo reste à 60 ;
 *   - qualité adaptative : si les images arrivent trop lentement (mesuré
 *     sur l'intervalle réel, le tracé des pixels ayant lieu hors du JS), la
 *     résolution baisse par paliers.
 *
 * Mouvement réduit : une seule image fixe, redessinée au redimensionnement
 * et au changement de thème.
 */

type Hsl = [number, number, number]

interface Layer {
    /** Hauteur du mot, en fraction de la hauteur de l'écran. */
    size: number
    /** Ligne médiane du plan, en fraction de la hauteur (portrait / paysage). */
    y: [number, number]
    /** 0 = fond, 1 = premier plan : parallaxe, opacité, ordre de l'allumage. */
    depth: number
    alpha: number
    /** Défilement, en px/s. */
    speed: number
}

// Du fond vers l'avant. En portrait, la feuille du formulaire couvre le bas
// de l'écran : les plans remontent dans la zone visible au-dessus d'elle.
const LAYERS: Layer[] = [
    { size: 1.15, y: [0.42, 0.62], depth: 0.25, alpha: 0.07, speed: 6 },
    { size: 0.7, y: [0.12, 0.2], depth: 0.55, alpha: 0.11, speed: 11 },
    { size: 0.42, y: [0.34, 0.92], depth: 1, alpha: 0.18, speed: 18 },
]

/*
 * Lueur de frappe. Jamais un flash : chaque lettre de chaque plan a son
 * niveau de lueur, qui monte et redescend en douceur (enveloppe lissée),
 * avec un plafond bas. Une frappe rapide entretient la lueur au lieu de la
 * faire clignoter : pas d'à-coups lumineux, même en tapant vite
 * (WCAG 2.3.1, seuil des trois flashs par seconde).
 */
/** Décalage de l'allumage entre deux plans : la vague part de l'avant. */
const GLOW_STAGGER_MS = 110
/** Temps de montée et de retombée de la lueur (s), et son plafond d'opacité. */
const GLOW_RISE_S = 0.35
const GLOW_FALL_S = 0.8
/** Surcroît d'opacité du contour éclairé, et voile de remplissage à peine
 *  perceptible : on éclaire le trait, jamais une grande surface (sur le
 *  plan du fond, une lettre fait plus que la hauteur de l'écran). */
const GLOW_STROKE_ALPHA = 0.35
const GLOW_FILL_ALPHA = 0.035
/** Au plus un allumage par intervalle : taper vite n'allume pas plus souvent. */
const GLOW_MIN_INTERVAL_MS = 450
const SHAKE_MS = 550
const ERROR_FADE_MS = 1100
const SUCCESS_FADE_MS = 2200

const [VB_X, VB_Y, VB_W, VB_H] = LOGO_VIEWBOX.split(" ").map(Number)

/** Intervalle minimal entre deux images du fond (30 images/s). */
const FRAME_MS = 1000 / 30
/** Intervalle moyen (ms) au-delà duquel on dégrade : moins de ~20 images/s. */
const SLOW_INTERVAL_MS = 50
/** Images observées avant de juger (le démarrage est toujours chahuté). */
const WARMUP_FRAMES = 30
/** Paliers de résolution du canvas (fraction du px CSS), du meilleur au plus léger. */
const QUALITY_STEPS = [1, 0.6, 0.4]
/** Épaisseur des contours, en px CSS. */
const LINE_PX = 1.2

function readHsl(style: CSSStyleDeclaration, name: string, fallback: Hsl): Hsl {
    const parts = style.getPropertyValue(name).trim().split(/\s+/).map(parseFloat)
    return parts.length === 3 && parts.every(Number.isFinite) ? (parts as Hsl) : fallback
}

const hsl = ([h, s, l]: Hsl, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`
const lerp = (a: Hsl, b: Hsl, t: number): Hsl => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
]

function AuthBackdropView({
    pointer,
    reduced,
    mood,
    hops,
}: {
    pointer: PointerSprings
    reduced: boolean
    mood: AuthMood
    hops: number
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // Les valeurs animées sont stables ; l'objet qui les porte ne l'est pas
    // forcément. Le dessin ne dépend que d'elles : le relancer efface le canvas.
    const { x: pointerX, y: pointerY } = pointer
    // L'animation lit ces valeurs à chaque image : des refs, pas de rendu React.
    const stateRef = useRef({
        mood,
        hops,
        /** Frappes en attente d'atteindre chaque plan (vague avant → fond). */
        kicks: [] as { at: number; letter: number; reached: number }[],
        lastKickAt: -1e9,
        /** Cible et niveau de lueur, par plan puis par lettre. */
        glowTarget: LAYERS.map(() => LOGO_LETTERS.map(() => 0)),
        glow: LAYERS.map(() => LOGO_LETTERS.map(() => 0)),
        errorAt: -1e9,
        successAt: -1e9,
        speed: 1,
        /** Distance parcourue par le tapis, intégrée image par image pour
         *  qu'un changement de vitesse n'entraîne pas de saut. */
        travel: 0,
        dim: 1,
    })

    useEffect(() => {
        const s = stateRef.current
        if (mood === "error" && s.mood !== "error") s.errorAt = performance.now()
        if (mood === "success" && s.mood !== "success") s.successAt = performance.now()
        s.mood = mood
    }, [mood])

    useEffect(() => {
        const s = stateRef.current
        const now = performance.now()
        if (hops > s.hops && now - s.lastKickAt >= GLOW_MIN_INTERVAL_MS) {
            s.lastKickAt = now
            s.kicks.push({ at: now, letter: (hops - 1) % LOGO_LETTERS.length, reached: 0 })
        }
        s.hops = hops
    }, [hops])

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        const paths = LOGO_LETTERS.map((l) => new Path2D(l.d))
        // Le mot entier en un seul chemin : un tracé par répétition du mot.
        const word = new Path2D()
        paths.forEach((path) => word.addPath(path))
        let width = 0
        let height = 0
        let step = 0
        let resolution = Math.min(window.devicePixelRatio || 1, QUALITY_STEPS[0])
        let interval = FRAME_MS
        let frames = 0
        let palette = { fg: [225, 40, 96] as Hsl, error: [15, 100, 45] as Hsl }
        let raf = 0
        let last = performance.now()

        const readPalette = () => {
            const style = getComputedStyle(document.documentElement)
            palette = {
                fg: readHsl(style, "--sidebar-foreground", palette.fg),
                error: readHsl(style, "--destructive", palette.error),
            }
        }

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            width = rect.width
            height = rect.height
            canvas.width = Math.max(1, Math.round(width * resolution))
            canvas.height = Math.max(1, Math.round(height * resolution))
        }

        const draw = (nowMs: number, dt: number) => {
            const s = stateRef.current
            const { fg, error } = palette
            const portrait = height > width

            // Les vitesses et l'estompage suivent l'humeur en douceur.
            const targetSpeed = s.mood === "busy" ? 5 : 1
            s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 3)
            s.dim += ((s.mood === "secret" ? 0.55 : 1) - s.dim) * Math.min(1, dt * 4)
            s.travel += dt * s.speed

            const errorK = Math.max(0, 1 - (nowMs - s.errorAt) / ERROR_FADE_MS)
            const successK = Math.max(0, 1 - (nowMs - s.successAt) / SUCCESS_FADE_MS)
            const shakeT = nowMs - s.errorAt
            const shake =
                shakeT < SHAKE_MS ? Math.sin(shakeT / 22) * 10 * (1 - shakeT / SHAKE_MS) : 0
            // La vague de frappe atteint les plans un par un, de l'avant au fond.
            for (const kick of s.kicks) {
                while (
                    kick.reached < LAYERS.length &&
                    nowMs - kick.at >= kick.reached * GLOW_STAGGER_MS
                ) {
                    s.glowTarget[LAYERS.length - 1 - kick.reached][kick.letter] = 1
                    kick.reached++
                }
            }
            s.kicks = s.kicks.filter((k) => k.reached < LAYERS.length)
            const fall = Math.exp(-dt / GLOW_FALL_S)
            const rise = Math.min(1, dt / GLOW_RISE_S)
            for (let li = 0; li < LAYERS.length; li++) {
                for (let i = 0; i < LOGO_LETTERS.length; i++) {
                    s.glowTarget[li][i] *= fall
                    s.glow[li][i] += (s.glowTarget[li][i] - s.glow[li][i]) * rise
                }
            }
            const px = pointerX.get()
            const py = pointerY.get()

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            const stroke = lerp(fg, error, errorK * 0.8)
            const zoom = 1 + successK * 0.08

            LAYERS.forEach((layer, index) => {
                const h = height * layer.size
                const scale = (h / VB_H) * zoom
                const wordW = VB_W * scale + h * 0.4
                const offset =
                    -((s.travel * layer.speed) % wordW) + px * layer.depth * 40 + shake * layer.depth
                const y = height * layer.y[portrait ? 0 : 1] - h / 2 + py * layer.depth * 26
                const alpha = (layer.alpha + successK * 0.08) * s.dim
                const lit = s.glow[index].map((g) => g * s.dim)
                const anyLit = lit.some((g) => g > 0.01)
                // Le canvas compte `resolution` px par px CSS : l'échelle du
                // mot l'intègre, l'épaisseur se donne en unités du tracé.
                const k = scale * resolution
                const lineWidth = (LINE_PX * resolution) / k
                const baseStyle = hsl(stroke, alpha)

                for (let x0 = offset - wordW; x0 < width + wordW; x0 += wordW) {
                    ctx.setTransform(k, 0, 0, k, (x0 - VB_X * scale) * resolution, (y - VB_Y * scale) * resolution)
                    ctx.lineWidth = lineWidth
                    ctx.strokeStyle = baseStyle
                    ctx.stroke(word)
                    if (!anyLit) continue
                    // Lettres éclairées : voile à peine perceptible, contour
                    // plus opaque et plus épais, par-dessus le tracé du mot.
                    lit.forEach((g, i) => {
                        if (g <= 0.01) return
                        ctx.fillStyle = hsl(fg, g * GLOW_FILL_ALPHA)
                        ctx.fill(paths[i])
                        ctx.lineWidth = lineWidth * (1 + g * 0.8)
                        ctx.strokeStyle = hsl(stroke, g * GLOW_STROKE_ALPHA)
                        ctx.stroke(paths[i])
                    })
                }
            })
        }

        const loop = (nowMs: number) => {
            raf = requestAnimationFrame(loop)
            // 30 images/s : on saute les rafraîchissements intermédiaires.
            if (nowMs - last < FRAME_MS - 2) return
            const elapsed = nowMs - last
            const dt = Math.min(0.1, Math.max(0, elapsed / 1000))
            last = nowMs
            draw(nowMs, dt)
            // Machine à la peine : palier de résolution inférieur, sans retour
            // (remonter ferait osciller la qualité). Onglet en arrière-plan :
            // le navigateur suspend les images, ce long écart ne compte pas.
            if (elapsed < 1000) interval = interval * 0.92 + elapsed * 0.08
            if (++frames > WARMUP_FRAMES && interval > SLOW_INTERVAL_MS && step < QUALITY_STEPS.length - 1) {
                step++
                resolution = Math.min(resolution, QUALITY_STEPS[step])
                frames = 0
                interval = FRAME_MS
                resize()
            }
        }
        // Le temps figé de l'image unique : les plans y sont bien répartis.
        const still = () => {
            stateRef.current.travel = 12
            draw(0, 0)
        }

        readPalette()
        resize()
        if (reduced) still()
        else raf = requestAnimationFrame(loop)

        const observer = new ResizeObserver(() => {
            resize()
            if (reduced) still()
        })
        observer.observe(canvas)
        // Le thème bascule par une classe sur <html> (theme/noFlash.ts).
        const themeObserver = new MutationObserver(() => {
            readPalette()
            if (reduced) still()
        })
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] })

        return () => {
            cancelAnimationFrame(raf)
            observer.disconnect()
            themeObserver.disconnect()
        }
    }, [pointerX, pointerY, reduced])

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            {/* Surface de marque éclairée en haut à gauche : CSS, peinte une fois. */}
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-black/20" />
            <canvas ref={canvasRef} className="absolute inset-0 size-full" />
            {/* Vignette : recentre le regard sur le logo et la feuille. */}
            <div className="absolute inset-0 bg-radial from-transparent from-40% to-black/35" />
        </div>
    )
}

/** Mémoïsé : ne se re-rend que sur un changement d'humeur ou une frappe. */
export const AuthBackdrop = memo(AuthBackdropView)
