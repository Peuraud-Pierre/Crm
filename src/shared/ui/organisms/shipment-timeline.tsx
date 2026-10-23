import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, FileText, Forklift, Ship, Truck, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
    dechargementCountdown,
    formatShipmentDate,
    legProgress,
    parseDechargement,
    type LegState,
} from "@/shared/lib/shipment"

/**
 * Frise d'acheminement d'une expédition, et son bloc de facturation.
 *
 * Pourquoi ce composant existe
 * ----------------------------
 * Les deux fiches de lecture d'arrivage listaient leurs champs à la chaîne —
 * fournisseur, mode, départ, déchargement, facture — tous au même poids visuel.
 * Or on sait ce qui compte : le DÉCHARGEMENT PRÉVU est la date de référence,
 * celle qui pilote le surlignage du tableau et les alertes, et une facture
 * manquante à l'approche du déchargement est un incident comptable et douanier.
 * Une suite de lignes égales cachait les deux.
 *
 * Le véhicule est une DONNÉE, pas une décoration
 * ----------------------------------------------
 * Sa position sur un segment est la part du temps écoulée entre les deux
 * jalons qui le bornent (`legProgress`), et la portion parcourue du rail est
 * remplie derrière lui — c'est ce remplissage qui rend la position lisible.
 * Elle est posée en style inline, jamais par une animation : elle doit survivre
 * à `prefers-reduced-motion`, que l'app neutralise globalement.
 *
 * Le seul mouvement décoratif est le tangage du véhicule, et il ne tourne que
 * sur le segment EN COURS. Un trajet fini ou pas commencé reste immobile :
 * autrement ça bougerait sans rien dire.
 *
 * Le trajet appartient à l'appelant
 * ---------------------------------
 * Ce composant ne présume rien de l'itinéraire : il reçoit des jalons, chacun
 * portant le véhicule qui mène au suivant. Le stock principal déclare trois
 * jalons (départ → escale au port → déchargement), le handpick deux — il ne
 * saisit plus l'arrivée au port. Aucune entité métier ici, comme dans
 * `shared/lib/shipment` dont ce composant est le pendant visuel.
 *
 * Les teintes reprennent celles du tableau, par les tokens sémantiques et non
 * les couleurs Tailwind brutes qu'emploie encore `features/stock`.
 */

/** Teinte du trajet. Dérivée par l'appelant, qui seul connaît son statut. */
export type ShipmentTone = "neutral" | "upcoming" | "alert" | "done"

export type ShipmentVehicle = "ship" | "truck" | "forklift"

export interface TimelineStop {
    /** Libellé court : « Départ », « Arrivée au port ». */
    label: string
    /** Date ISO ou date seule. `null` = jalon non renseigné. */
    date: string | null
    /**
     * Véhicule reliant ce jalon au SUIVANT. Le terminus n'en porte pas, et un
     * segment sans véhicule déclaré rend un simple filet.
     */
    vehicle?: ShipmentVehicle
}

const TONE: Record<ShipmentTone, { fill: string; text: string; chip: string; halo: string }> = {
    neutral: {
        fill: "bg-muted-foreground/50",
        text: "text-foreground",
        chip: "bg-muted text-muted-foreground border-border",
        halo: "bg-muted-foreground/15",
    },
    upcoming: {
        fill: "bg-warning",
        text: "text-warning",
        chip: "bg-warning-light text-warning border-warning/30",
        halo: "bg-warning/15",
    },
    alert: {
        fill: "bg-destructive",
        text: "text-destructive",
        chip: "bg-destructive-light text-destructive border-destructive/30",
        halo: "bg-destructive/15",
    },
    done: {
        fill: "bg-success",
        text: "text-success",
        chip: "bg-success-light text-success border-success/30",
        halo: "bg-success/15",
    },
}

const LABEL = "text-3xs font-bold uppercase tracking-wider text-muted-foreground"

const VEHICLE_ICON = { ship: Ship, truck: Truck, forklift: Forklift } as const
const VEHICLE_IDLE = {
    ship: "animate-ship-bob",
    truck: "animate-truck-rumble",
    forklift: "animate-truck-rumble",
} as const

interface ShipmentTimelineProps {
    /** Jalons intermédiaires, dans l'ordre du trajet. */
    stops: TimelineStop[]
    /** Terminus : le déchargement prévu, horaire compris. */
    arrival: { label: string; at: string | null }
    tone: ShipmentTone
    /** Injectable pour les tests — sans quoi rien de daté n'est reproductible. */
    now?: number
}

export function ShipmentTimeline({ stops, arrival, tone, now }: ShipmentTimelineProps) {
    const palette = TONE[tone]
    const dechargement = parseDechargement(arrival.at)
    const countdown = dechargementCountdown(arrival.at)

    /** Date bornant la FIN du segment partant du jalon d'indice `index`. */
    const nextDate = (index: number) =>
        index + 1 < stops.length ? stops[index + 1].date : arrival.at

    return (
        <ol className="flex flex-col sm:flex-row sm:items-stretch">
            {stops.map((stop, index) => (
                <Stop
                    key={stop.label}
                    label={stop.label}
                    palette={palette}
                    filled={Boolean(stop.date)}
                    leg={{
                        vehicle: stop.vehicle,
                        ...legProgress(stop.date, nextDate(index), now),
                    }}
                >
                    <span
                        className={cn(
                            "text-sm tabular-nums",
                            stop.date
                                ? "font-medium text-foreground"
                                : "italic text-muted-foreground",
                        )}
                    >
                        {formatShipmentDate(stop.date) ?? "Date manquante"}
                    </span>
                </Stop>
            ))}

            <Stop
                label={arrival.label}
                labelClassName={dechargement ? palette.text : undefined}
                palette={palette}
                filled={Boolean(dechargement)}
                terminus
            >
                {dechargement ? (
                    <>
                        <span className="text-sm font-bold capitalize text-foreground">
                            {dechargement.jour} {dechargement.date}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {dechargement.heure}
                        </span>
                        {countdown && (
                            <span
                                className={cn(
                                    "mt-1.5 inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider",
                                    palette.chip,
                                )}
                            >
                                {countdown.label}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-sm italic text-muted-foreground">Non planifié</span>
                )}
            </Stop>
        </ol>
    )
}

interface LegDescriptor {
    vehicle?: ShipmentVehicle
    state: LegState
    ratio: number
}

/**
 * Un jalon : sa pastille, le segment qui le relie au suivant, son libellé.
 *
 * Le rail est vertical sous 640 px et horizontal au-delà. C'est la seule
 * bascule de la frise, et elle tient dans ces classes — sans positionnement
 * absolu : le remplissage et le véhicule sont des frères dans un flex, dont
 * seule la direction change. Un `flexGrow` fonctionne dans les deux sens, là où
 * un `left: 40%` aurait exigé un `top: 40%` en mobile, impossible à basculer
 * depuis un style inline.
 */
function Stop({
    label,
    labelClassName,
    palette,
    filled,
    leg,
    terminus = false,
    children,
}: {
    label: string
    labelClassName?: string
    palette: (typeof TONE)[ShipmentTone]
    filled: boolean
    leg?: LegDescriptor
    terminus?: boolean
    children: ReactNode
}) {
    return (
        <li
            className={cn(
                "flex gap-3 sm:flex-col sm:gap-2.5",
                // Le terminus ne s'étire pas : les segments se partagent la
                // largeur, lui prend celle de son contenu.
                terminus ? "sm:shrink-0" : "sm:flex-1",
            )}
        >
            <div className="flex flex-col items-center sm:h-7 sm:flex-row">
                <Marker filled={filled} palette={palette} terminus={terminus} />
                {leg && <Leg leg={leg} palette={palette} />}
            </div>

            <div className={cn("flex min-w-0 flex-col", terminus ? "pb-0" : "pb-5 sm:pb-0")}>
                <span className={cn(LABEL, labelClassName)}>{label}</span>
                {children}
            </div>
        </li>
    )
}

/**
 * Pastille d'un jalon. Une date manquante devient une croix plutôt qu'un rond
 * creux : l'absence est une information, pas un état intermédiaire.
 *
 * Le halo est un élément qui porte son propre fond, et non un `ring` posé sur
 * un parent translucide — un anneau semi-transparent au-dessus du `bg-muted/30`
 * du conteneur virait au terne en thème sombre.
 */
function Marker({
    filled,
    palette,
    terminus,
}: {
    filled: boolean
    palette: (typeof TONE)[ShipmentTone]
    terminus: boolean
}) {
    if (!filled) {
        return (
            <span
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-background text-muted-foreground"
                aria-label="Date manquante"
            >
                <X size={9} strokeWidth={3} aria-hidden />
            </span>
        )
    }

    return (
        <span
            className={cn(
                "flex shrink-0 items-center justify-center rounded-full",
                terminus ? "size-4" : "size-3",
                palette.halo,
            )}
            aria-hidden
        >
            <span
                className={cn("rounded-full", terminus ? "size-2.5" : "size-1.5", palette.fill)}
            />
        </span>
    )
}

/**
 * Segment entre deux jalons : la part parcourue, le véhicule, la part restante.
 *
 * Sans les deux bornes, aucune progression n'est calculable : le segment se
 * rend alors en pointillés et sans véhicule, plutôt que d'en placer un à une
 * position inventée.
 */
function Leg({
    leg,
    palette,
}: {
    leg: LegDescriptor
    palette: (typeof TONE)[ShipmentTone]
}) {
    const Icon = leg.vehicle ? VEHICLE_ICON[leg.vehicle] : null

    if (leg.state === "unknown" || !Icon) {
        return (
            <span
                className="min-h-8 flex-1 border-l border-dashed border-border sm:min-h-0 sm:min-w-6 sm:border-l-0 sm:border-t"
                aria-hidden
            />
        )
    }

    const done = leg.state === "done"

    return (
        <span
            className="flex min-h-8 flex-1 flex-col items-center sm:min-h-0 sm:min-w-6 sm:flex-row"
            aria-hidden
        >
            <span
                style={{ flexGrow: leg.ratio }}
                className={cn("w-px sm:h-px sm:w-auto", palette.fill)}
            />

            <span
                className={cn(
                    "shrink-0 px-0.5 py-0.5",
                    done ? "text-muted-foreground" : palette.text,
                    // Le tangage ne tourne QUE sur un trajet en cours.
                    leg.state === "moving" && leg.vehicle && VEHICLE_IDLE[leg.vehicle],
                )}
            >
                <Icon size={13} strokeWidth={2.25} />
            </span>

            <span
                style={{ flexGrow: 1 - leg.ratio }}
                className={cn("w-px sm:h-px sm:w-auto", done ? palette.fill : "bg-border")}
            />
        </span>
    )
}

interface ShipmentInvoiceNoticeProps {
    /** Absent pour le stock principal, qui ne saisit pas de numéro. */
    invoiceNo?: string | null
    invoiceDate: string | null
    /** Déchargement proche sans facture — `isInvoiceAlert` de l'appelant. */
    alert: boolean
    /** Échéance en toutes lettres, pour motiver l'alerte. */
    countdownLabel?: string
}

/**
 * État de facturation, en bloc plein plutôt qu'en ligne libellé / valeur.
 *
 * Trois états seulement, et c'est le sujet : facturé (vert), manquant et
 * urgent (rouge), manquant sans échéance proche (neutre). Une date de facture
 * noyée dans une liste de lignes ne disait pas laquelle des trois.
 */
export function ShipmentInvoiceNotice({
    invoiceNo,
    invoiceDate,
    alert,
    countdownLabel,
}: ShipmentInvoiceNoticeProps) {
    const invoiced = Boolean(invoiceDate)
    const tone: ShipmentTone = invoiced ? "done" : alert ? "alert" : "neutral"
    const palette = TONE[tone]
    const Icon = invoiced ? CheckCircle2 : alert ? AlertTriangle : FileText

    const date = formatShipmentDate(invoiceDate)

    return (
        <div
            className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3",
                palette.chip,
            )}
        >
            <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-bold uppercase tracking-wider">
                    {invoiced ? "Facturé" : alert ? "Facture manquante" : "Non facturé"}
                </span>

                <span className="text-xs opacity-90">
                    {invoiced
                        ? [invoiceNo, date].filter(Boolean).join(" · ")
                        : alert
                          ? `Déchargement ${countdownLabel ?? "proche"} — incident comptable et douanier`
                          : "Aucune facture enregistrée"}
                </span>
            </div>
        </div>
    )
}
