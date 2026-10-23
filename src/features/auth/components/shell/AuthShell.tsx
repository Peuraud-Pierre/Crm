import { LazyMotion, domAnimation } from "framer-motion"
import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { cn } from "@/shared/lib/utils"
import { OUTRO_EXIT_MS, authOutro, useAuthOutro } from "../outro/outroStore"
import { AuthBackdrop } from "./AuthBackdrop"
import { AuthMoodProvider, useAuthMood, type AuthMood } from "./authMood"
import { DRAW_INTRO_MS, LivingLogo } from "./LivingLogo"
import { CENTER_MOVE_S, useCenteredIntro } from "./useCenteredIntro"
import { ShellReadyContext } from "./shellReady"
import { useIntro } from "./useIntro"
import { usePointerSprings } from "./usePointerSprings"

/*
 * Détournement de l'inscription de l'Anneau (trad. Ledoux : « Un Anneau pour
 * les gouverner tous… et dans les ténèbres les lier »). Le premier vers sert
 * seul d'accroche sur téléphone.
 */
const VERSES = [
    "Un outil pour les organiser tous,",
    "un outil pour les trouver,",
    "un outil pour les amener tous",
    "et dans La Console les relier.",
] as const

/**
 * Intro : le logo s'écrit en grand au centre de l'écran, puis rejoint sa
 * place (à gauche sur grand écran, en haut sur téléphone) pendant que la
 * page s'ouvre : la feuille arrive du côté libéré, les vers suivent.
 */
const MOVE_AT_MS = DRAW_INTRO_MS + 120
const PAGE_IN_MS = MOVE_AT_MS + 150
const VERSE_START_MS = MOVE_AT_MS + 450
const VERSE_STEP_MS = 160
/**
 * Le formulaire reste inerte jusqu'à ce que la feuille soit presque entière
 * à l'écran : sans focus, le navigateur n'ouvre pas sa liste d'identifiants
 * enregistrés par-dessus l'intro.
 */
// Après la fin du glissement du logo : le déverrouillage (focus, montage
// du captcha) occupe le fil principal, il ne doit pas tomber pendant.
const FORM_READY_MS = MOVE_AT_MS + CENTER_MOVE_S * 1000

interface AuthShellProps {
    title: string
    description?: ReactNode
    /** Pictogramme d'état au-dessus du titre (email envoyé, succès…). */
    icon?: ReactNode
    children?: ReactNode
    /** Bas de la feuille : liens secondaires (retour à la connexion…). */
    footer?: ReactNode
    /**
     * Identifiant de l'étape affichée. Le changer remonte le bloc
     * titre + contenu et rejoue son entrée (connexion → code MFA).
     */
    stepKey?: string
    /** Sens de l'entrée : `back` quand on revient à l'étape précédente. */
    direction?: "forward" | "back"
    /** Écran d'attente : le logo ondule tant que dure la vérification. */
    pending?: boolean
    /** Humeur imposée par l'écran (succès d'un envoi, d'une confirmation). */
    mood?: AuthMood
}

/**
 * Cadre commun des écrans d'authentification.
 *
 * Toute la page est la surface de marque (tokens `sidebar` : vert registre
 * en clair, quasi-noir en sombre) ; le logo vivant y occupe la scène et le
 * formulaire est posé dessus sur une feuille (`card`).
 *
 * - < sm (téléphone) : logo centré dans l'espace au-dessus de la feuille,
 *   qui est collée en bas, coins supérieurs arrondis. `compact:` (hauteur
 *   501–700px) réduit le logo et masque le vers.
 * - sm → lg (tablette portrait) : logo et feuille flottante, centrés ensemble.
 * - lg et plus : scène à gauche (logo + citation), feuille à droite.
 * - `short:` (hauteur ≤ 500px, téléphone en paysage) : scène et feuille
 *   côte à côte, la feuille défile seule.
 *
 * Intro identique sur tous les formats, une fois par chargement (useIntro) :
 * le logo se trace au centre, puis glisse à sa place et la page s'ouvre
 * (useCenteredIntro).
 */
export function AuthShell({ pending = false, mood, ...props }: AuthShellProps) {
    return (
        <LazyMotion features={domAnimation}>
            <AuthMoodProvider initial={pending ? "busy" : (mood ?? "idle")}>
                <ShellFrame pending={pending} mood={mood} {...props} />
            </AuthMoodProvider>
        </LazyMotion>
    )
}

function ShellFrame({
    title,
    description,
    icon,
    children,
    footer,
    stepKey = "default",
    direction = "forward",
    pending = false,
    mood: imposedMood,
}: AuthShellProps) {
    const reduced = usePrefersReducedMotion()
    const intro = useIntro(!pending)
    const pointer = usePointerSprings(!reduced)
    const { mood, hops, setMood } = useAuthMood()
    const centeredRef = useCenteredIntro(intro && !reduced, MOVE_AT_MS)

    // Pendant l'intro, la feuille est `inert` : l'autoFocus de React ne peut
    // pas y poser le curseur, donc ni clavier ni suggestions d'autoremplissage
    // ne surgissent devant l'animation. À la fin, on rend le focus au champ
    // marqué `data-autofocus` (celui que l'écran voulait focaliser).
    // En mouvement réduit, l'intro ne se joue pas : rien à attendre.
    const sheetRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<HTMLDivElement>(null)

    // Outro de connexion (outroStore.ts) : le logo est mesuré au moment du
    // relais, et la feuille et les vers quittent l'écran avant que la
    // surcouche ne reprenne le logo.
    const outro = useAuthOutro()
    useEffect(() => {
        authOutro.registerLogo(centeredRef.current)
        return () => authOutro.registerLogo(null)
    }, [centeredRef])
    const exitRef = useRef<Animation[]>([])
    useEffect(() => {
        if (outro.phase === "idle") {
            // Outro interrompue alors que l'écran est encore là : il revient.
            exitRef.current.forEach((a) => a.cancel())
            exitRef.current = []
            return
        }
        if (outro.phase !== "exiting") return
        // La feuille part du côté opposé au logo : vers la droite quand ils
        // sont côte à côte (lg, téléphone en paysage), vers le bas sinon.
        const sideBySide = window.matchMedia("(min-width: 1024px), (max-height: 500px)").matches
        const sheet = sheetRef.current?.animate(
            [
                { opacity: 1, transform: "none" },
                { opacity: 0, transform: sideBySide ? "translateX(40px)" : "translateY(40px)" },
            ],
            { duration: OUTRO_EXIT_MS - 40, easing: "ease-in", fill: "forwards" }
        )
        const verses = sceneRef.current
            ?.querySelector("blockquote")
            ?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" })
        exitRef.current = [sheet, verses].filter((a): a is Animation => !!a)
    }, [outro.phase])
    const [formLocked, setFormLocked] = useState(intro && !reduced)
    useEffect(() => {
        if (!formLocked) return
        const id = setTimeout(() => setFormLocked(false), FORM_READY_MS)
        return () => clearTimeout(id)
    }, [formLocked])
    const wasLockedRef = useRef(formLocked)
    useEffect(() => {
        // Après le rendu qui a retiré `inert` : le champ est focalisable.
        if (wasLockedRef.current && !formLocked) {
            sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
        }
        wasLockedRef.current = formLocked
    }, [formLocked])

    // L'écran impose son humeur quand elle CHANGE (attente → résultat). Pas
    // au montage : l'humeur initiale est déjà posée par le fournisseur, et
    // un champ en autofocus (mot de passe → « secret ») a pu la modifier.
    const mountedRef = useRef(false)
    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true
            return
        }
        if (pending) setMood("busy")
        else if (imposedMood) setMood(imposedMood)
        else setMood("idle")
    }, [pending, imposedMood, setMood])

    return (
        // `overflow-clip` et non `hidden` : un conteneur `hidden` reste
        // défilable par script. À l'intro, l'autoFocus vise un champ de la
        // feuille encore décalée hors écran ; le navigateur faisait défiler
        // la racine pour l'atteindre, et le fond glissait avec elle.
        <div className="relative isolate min-h-dvh overflow-clip bg-sidebar text-sidebar-foreground">
            <AuthBackdrop pointer={pointer} reduced={reduced} mood={mood} hops={hops} />

            <div
                className="relative flex min-h-dvh flex-col sm:justify-center lg:grid lg:grid-cols-2 xl:grid-cols-5 short:flex-row short:items-stretch"
            >
                {/* Scène : logo vivant + citation. Le padding de sécurité
                    (encoche) et celui de mise en page vivent sur deux blocs
                    distincts : posés ensemble, l'un écraserait l'autre.
                    Au-dessus de la feuille : à l'intro, le logo part du
                    centre de l'écran et peut la survoler. */}
                <section
                    aria-hidden
                    className="safe-area-top safe-area-x relative z-10 flex min-h-0 flex-1 flex-col sm:flex-none lg:flex-1 xl:col-span-3 short:w-2/5 short:shrink-0"
                >
                    <div
                        ref={sceneRef}
                        className="flex flex-1 flex-col items-center justify-center pt-10 pb-8 text-center max-sm:compact:pt-6 max-sm:compact:pb-5 sm:pt-14 sm:pb-10 lg:items-start lg:px-10 lg:text-left xl:px-16 short:items-center short:px-2 short:py-4">
                        <div
                            ref={centeredRef}
                            className="w-56 max-w-full max-sm:compact:w-44 sm:w-80 lg:w-full lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl short:w-48"
                        >
                            <LivingLogo
                                mood={mood}
                                hops={hops}
                                pointer={pointer}
                                intro={intro}
                                reduced={reduced}
                            />
                        </div>
                        <Verses intro={intro} />
                    </div>
                </section>

                {/* Feuille : le formulaire */}
                <section className="flex flex-col sm:px-6 sm:pb-10 lg:flex-1 lg:items-center lg:justify-center lg:p-10 xl:col-span-2 short:flex-1 short:p-0">
                    <div
                        ref={sheetRef}
                        inert={formLocked}
                        className={cn(
                            "safe-area-x safe-area-bottom flex flex-col rounded-t-3xl bg-card pt-8 text-card-foreground shadow-raised dark:border dark:border-border max-sm:compact:pt-6 lg:compact:py-7",
                            "sm:mx-auto sm:w-full sm:max-w-md sm:flex-none sm:rounded-3xl sm:px-8 sm:pb-8",
                            "lg:max-w-md lg:px-10 lg:py-10",
                            "short:h-dvh short:max-w-none short:overflow-y-auto short:rounded-none short:rounded-l-3xl short:pt-5",
                            // Elle arrive du côté que le logo libère : du bas sur
                            // téléphone, de la droite quand scène et feuille
                            // sont côte à côte (lg, téléphone en paysage).
                            intro &&
                                "animate-in fade-in fill-mode-backwards duration-slower ease-emphasized slide-in-from-bottom-10 lg:slide-in-from-bottom-0 lg:slide-in-from-right-10 short:slide-in-from-bottom-0 short:slide-in-from-right-10"
                        )}
                        style={intro ? { animationDelay: `${PAGE_IN_MS}ms` } : undefined}
                    >
                        <div
                            key={stepKey}
                            className={cn(
                                "flex-1 animate-in fade-in duration-slow ease-emphasized",
                                direction === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
                            )}
                        >
                            <header className="mb-6 space-y-2 compact:mb-4 short:mb-4">
                                {icon && <div className="mb-4 short:hidden">{icon}</div>}
                                <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                                    {title}
                                </h1>
                                {description && (
                                    <p className="text-sm text-muted-foreground text-pretty">
                                        {description}
                                    </p>
                                )}
                            </header>
                            <ShellReadyContext value={!formLocked}>{children}</ShellReadyContext>
                        </div>

                        <footer className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground compact:mt-5">
                            {footer}
                            <p>Accès réservé aux équipes NOKK_PROJECT</p>
                        </footer>
                    </div>
                </section>
            </div>
        </div>
    )
}

function VersesView({ intro }: { intro: boolean }) {
    return (
        <blockquote className="mt-6 space-y-1 max-sm:compact:hidden lg:mt-12 short:hidden">
            {VERSES.map((verse, i) => (
                <p
                    key={verse}
                    className={cn(
                        i === 0
                            ? "text-lg font-semibold tracking-tight sm:text-xl lg:text-3xl"
                            : "hidden text-sidebar-foreground/70 lg:block lg:text-lg",
                        intro &&
                            "animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-slower ease-emphasized"
                    )}
                    // Délai inline : seul moyen d'échelonner une animation CSS
                    // (DESIGN_SYSTEM.md §13.6) ; remis à 0 en mouvement réduit.
                    style={intro ? { animationDelay: `${VERSE_START_MS + i * VERSE_STEP_MS}ms` } : undefined}
                >
                    {verse}
                </p>
            ))}
        </blockquote>
    )
}

/** Mémoïsés : taper dans le formulaire ne les re-rend pas. */
const Verses = memo(VersesView)
