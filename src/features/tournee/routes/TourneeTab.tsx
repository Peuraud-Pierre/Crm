/**
 * Onglet La Tournée du CRM — gamification des stats setters du mois courant.
 * Point d'entrée lazy-loadé depuis SinglePageCRM (export default requis).
 *
 * Vue 3D (Three.js) par défaut, avec bascule 2D persistée : le chunk three
 * n'est chargé que si la vue 3D est affichée (lazy import).
 */
import { lazy, Suspense, useState } from "react"
import {
    BookOpen,
    Boxes,
    Dices,
    Home,
    LayoutGrid,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Trophy,
    Zap,
} from "lucide-react"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/atoms/accordion"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useTournee } from "../hooks/data/useTournee"
import { Board } from "../components/Board"
import { ChallengesCard } from "../components/ChallengesCard"
import { Leaderboard, MovesLog } from "../components/Leaderboard"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"

const Board3D = lazy(() => import("../components/Board3D"))

const BOARD_MODE_KEY = "tournee_board_mode"

/** Barème affiché dans les règles — garder aligné avec utils/engine.ts. */
const SCORING = [
    ["RDV physique achat", "+100"],
    ["RDV physique découverte / visio achat", "+80"],
    ["RDV visio découverte", "+60"],
    ["RDV visio reassort", "+40"],
    ["Appel", "+10"],
    ["Autre interaction fiche client (message, mail…)", "+5"],
    ["Bonus RDV honoré (show)", "+50"],
    ["Tour de plateau complet (case Départ)", "+200"],
    ["Case Boost ou Caisse d'équipe", "+50"],
    ["Loyer perçu (un joueur s'arrête chez toi)", "+25"],
]

const RULE_SECTIONS = [
    {
        id: "principe",
        icon: Dices,
        title: "Comment on joue",
        content: (
            <>
                <p>
                    Personne ne joue « à la main » : c'est ton activité CRM
                    réelle qui joue pour toi. Chaque événement que tu crées
                    dans le mois (RDV, appel…) lance automatiquement les deux
                    dés et fait avancer ton pion de la somme obtenue sur le
                    parcours de 24 cases — avec des pièges aux coins, comme
                    au jeu de l'oie (le Frigo, le Labyrinthe, la Zone morte).
                </p>
                <p>
                    Les dés sont calculés à partir de l'événement lui-même :
                    impossible de tricher ou de relancer, et tout le monde
                    voit exactement le même plateau, mis à jour en direct.
                </p>
            </>
        ),
    },
    {
        id: "bareme",
        icon: Sparkles,
        title: "Le barème des points",
        content: (
            <div className="flex flex-col gap-1">
                {SCORING.map(([label, pts]) => (
                    <div
                        key={label}
                        className="flex items-baseline justify-between gap-2"
                    >
                        <span>{label}</span>
                        <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {pts}
                        </span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        id: "proprietes",
        icon: Home,
        title: "Propriétés, maisons et loyers",
        content: (
            <>
                <p>
                    Les rues et les gares peuvent être possédées : la case où
                    ton pion s'est arrêté le plus souvent dans le mois
                    t'appartient, et une petite maison à ta couleur y est
                    posée.
                </p>
                <p>
                    Quand un autre joueur s'arrête sur ta case, tu touches un
                    loyer de +25 points. Rien n'est retiré au visiteur : le
                    loyer récompense la régularité, il ne punit personne.
                </p>
                <p>
                    Les Canaux (Instagram, Ads, Referral, Site Web) sont les
                    cases d'acquisition : possédables comme les rues.
                </p>
            </>
        ),
    },
    {
        id: "frigo",
        icon: ShieldAlert,
        title: "Le Frigo (no-show)",
        content: (
            <>
                <p>
                    Un RDV non honoré (no-show) gèle ton pion au Frigo, le
                    coin des leads refroidis : pas de points pour cet
                    événement, pas de bonus de passage par la case Départ.
                </p>
                <p>
                    Tu en sors automatiquement à ta prochaine action CRM — le
                    meilleur moyen de réchauffer un lead, c'est de reprendre
                    le téléphone. La case piège « Zone morte » a le même
                    effet si ton pion s'y arrête.
                </p>
            </>
        ),
    },
    {
        id: "defis",
        icon: Zap,
        title: "Les défis du jour",
        content: (
            <p>
                Chaque jour, 2 défis sont tirés au sort (les mêmes pour toute
                l'équipe) : poser 2 RDV, passer 5 appels, réussir un show sans
                no-show, agir avant 10h… Chaque défi rempli ajoute son bonus à
                ton score du mois. La carte « Défis du jour » montre qui les a
                déjà réussis.
            </p>
        ),
    },
    {
        id: "classement",
        icon: Trophy,
        title: "Le classement et le mois",
        content: (
            <>
                <p>
                    Le classement additionne tout : points des actions, bonus
                    de show, tours de plateau, cartes, loyers et défis. Les
                    barres de progression comparent chaque joueur au leader.
                </p>
                <p>
                    Le plateau repart de zéro au début de chaque mois : tout
                    le monde retourne sur la case Départ, les propriétés sont
                    remises en jeu.
                </p>
            </>
        ),
    },
]

function Rules() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <BookOpen className="h-4 w-4" aria-hidden />
                    </span>
                    Règles du jeu
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <Accordion type="single" collapsible>
                    {RULE_SECTIONS.map(({ id, icon: Icon, title, content }) => (
                        <AccordionItem key={id} value={id}>
                            <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline sm:text-sm">
                                <span className="flex items-center gap-2">
                                    <Icon
                                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                    {title}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-1.5 text-2xs leading-relaxed text-muted-foreground sm:text-xs">
                                {content}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    )
}

export default function TourneeTab() {
    const { game, loading, error, refresh } = useTournee()
    const [mode, setMode] = useState<"2d" | "3d">(() =>
        localStorage.getItem(BOARD_MODE_KEY) === "2d" ? "2d" : "3d"
    )

    const toggleMode = () => {
        const next = mode === "3d" ? "2d" : "3d"
        setMode(next)
        localStorage.setItem(BOARD_MODE_KEY, next)
    }

    if (loading) {
        return (
            <SkeletonGroup
                className="flex flex-col items-start gap-6 lg:flex-row"
                label="Chargement de la tournée…"
            >
                <Skeleton className="mx-auto aspect-square w-full max-w-xl shrink-0 lg:mx-0" />
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </SkeletonGroup>
        )
    }

    if (error || !game) {
        return (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
                <p className="text-sm text-muted-foreground">
                    {error ?? "Plateau indisponible."}
                </p>
                <Button variant="outline" size="sm" onClick={refresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Réessayer
                </Button>
            </div>
        )
    }

    return (
        // Tout en flex : plateau en largeur fixe (max-w-xl, shrink-0) à
        // gauche, panels qui absorbent le reste. Les deux colonnes de panels
        // se mettent côte à côte à partir de 2xl, sinon elles s'empilent.
        <div className="flex flex-col items-start gap-6 lg:flex-row">
            <div className="mx-auto w-full max-w-xl shrink-0 space-y-3 lg:mx-0">
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={toggleMode}>
                        {mode === "3d" ? (
                            <>
                                <LayoutGrid className="mr-2 h-4 w-4" />
                                Vue 2D
                            </>
                        ) : (
                            <>
                                <Boxes className="mr-2 h-4 w-4" />
                                Vue 3D
                            </>
                        )}
                    </Button>
                </div>
                {mode === "3d" ? (
                    <Suspense
                        fallback={
                            <Skeleton className="aspect-square w-full" />
                        }
                    >
                        <Board3D game={game} />
                    </Suspense>
                ) : (
                    <Board game={game} />
                )}
            </div>
            <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-4 2xl:flex-row">
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    <ChallengesCard game={game} />
                    <Leaderboard game={game} />
                </div>
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    <MovesLog game={game} />
                    <Rules />
                </div>
            </div>
        </div>
    )
}
