import { Calendar, ChevronRight, Inbox, MapPin, Shirt } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Label } from "@/shared/ui/atoms/label"
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/atoms/card"

/**
 * Carte d'une unité de stock — la tuile carrée et dense des grilles
 * d'inventaire.
 *
 * Pourquoi ce composant existe
 * ----------------------------
 * Les deux modules de stock affichaient leur inventaire sous deux dessins sans
 * rien de commun : une tuile carrée avec le poids en gros chiffres côté
 * `stock`, une carte large en liste de champs côté `stock_handpick`. Passer
 * d'un module à l'autre changeait la lecture de l'écran le plus consulté des
 * deux. Le dessin du stock principal a été retenu, et il vit désormais ici.
 *
 * Ce qui monte ici : la géométrie (carré, en-tête, corps centré, tiroir), les
 * animations et l'accessibilité au clavier. Ce qui reste dans la feature :
 * l'aplatissement de l'entité en champs affichables, et les classes de thème —
 * un module garde sa palette chez lui plutôt que de la promouvoir en socle.
 *
 * Le badge central porte la couleur du STATUT, pas de la catégorie qu'il
 * affiche : c'est le comportement d'origine du stock, conservé tel quel.
 */

/** Habillage dépendant du statut, résolu par le module appelant. */
export interface BaleCardSkin {
    /** Bordure de la carte, états de survol compris. */
    border: string
    /** Teinte de l'illustration révélée au survol. */
    icon: string
    /** Filets d'en-tête et de pied. */
    footerBorder: string
    /** Pastille de statut, en haut à droite. */
    statusDot: string
}

/** Surfaces communes à tous les statuts — `theme.card` d'un `ModuleTheme`. */
export interface BaleCardSurface {
    surface: string
    text: string
    mutedText: string
}

interface BaleCardProps {
    /** BIN côté `stock`, identifiant tronqué côté handpick. */
    identity: string
    quantity: number | null
    /** `kg`, `pièces`… — le handpick a deux modes de conditionnement. */
    unit: string
    category: string
    /** Libellé brut du fournisseur ; masqué s'il duplique la catégorie. */
    rawName?: string | null
    /** Date ISO d'entrée en stock. */
    date: string | null
    /** Emplacement lisible : macro-état ou adresse dans l'entrepôt. */
    place: string
    /** Classes du badge central — la couleur du statut. */
    badgeClassName: string
    surface: BaleCardSurface
    skin: BaleCardSkin
    className?: string
    onClick?: () => void
}

const EMPTY = "—"

export function BaleCard({
    identity,
    quantity,
    unit,
    category,
    rawName,
    date,
    place,
    badgeClassName,
    surface,
    skin,
    className,
    onClick,
}: BaleCardProps) {
    const quantityLabel =
        quantity === null ? EMPTY : String(Math.round(quantity * 100) / 100)

    const dateLabel = date
        ? new Date(date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
          })
        : EMPTY

    return (
        <Card
            variant="interactive"
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onClick()
                          }
                      }
                    : undefined
            }
            className={cn(
                "group relative aspect-square p-0 border overflow-hidden flex flex-col select-none",
                "active:scale-98 motion-reduce:active:scale-100",
                surface.surface,
                skin.border,
                className,
            )}
        >
            {/* --- ANIMATION LUDIQUE (Vêtement qui tombe au hover) --- */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <Shirt
                    size={40}
                    className={cn(
                        "absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 transition-[top,opacity] duration-slower ease-in-out group-hover:top-1/4 group-hover:opacity-10 rotate-12",
                        skin.icon,
                    )}
                />
            </div>

            {/* --- HEADER --- */}
            <CardHeader
                className={cn(
                    "p-2.5 space-y-0 flex flex-row items-center justify-between border-b z-10",
                    skin.footerBorder,
                )}
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <Inbox size={12} className={cn("shrink-0 opacity-50", surface.text)} />
                    <Label
                        className={cn(
                            "font-mono text-3xs font-bold tracking-tight truncate cursor-pointer",
                            surface.text,
                        )}
                    >
                        {identity}
                    </Label>
                </div>
                <div
                    className={cn("h-2 w-2 rounded-full shrink-0 shadow-sm", skin.statusDot)}
                />
            </CardHeader>

            {/* --- CONTENT --- */}
            <CardContent className="flex-1 flex flex-col items-center justify-center p-2 gap-1 z-10">
                <div
                    className={cn(
                        "flex items-baseline gap-0.5 transition-transform group-hover:scale-110 duration-slow",
                        surface.text,
                    )}
                >
                    <span className="text-3xl font-black tracking-tighter">
                        {quantityLabel}
                    </span>
                    <span className="text-3xs font-bold uppercase opacity-40">{unit}</span>
                </div>
                <Label
                    className={cn(
                        "px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-tight text-center line-clamp-1 border",
                        badgeClassName,
                    )}
                >
                    {category}
                </Label>
                {rawName && rawName.toLowerCase() !== category.toLowerCase() && (
                    <span
                        className={cn(
                            "text-4xs font-medium tracking-tight text-center line-clamp-1 opacity-60",
                            surface.mutedText,
                        )}
                        title={rawName}
                    >
                        {rawName}
                    </span>
                )}

                {/* Méta-données : date d'entrée et emplacement */}
                <div className="flex items-center gap-3 mt-2 opacity-40 grayscale group-hover:grayscale-0 transition-[filter]">
                    <div className="flex items-center gap-1">
                        <Calendar size={10} />
                        <span className="text-4xs font-bold uppercase tracking-tighter">
                            {dateLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 border-l pl-3 border-border">
                        <MapPin size={10} />
                        <span className="text-4xs font-bold uppercase tracking-tighter line-clamp-1">
                            {place}
                        </span>
                    </div>
                </div>
            </CardContent>

            {/* --- FOOTER --- */}
            <CardFooter
                className={cn(
                    "hidden lg:flex",
                    "p-1.5 mt-auto border-t text-center items-center justify-center gap-1 transition-transform duration-slow",
                    "bg-card/90 backdrop-blur-sm z-20",
                    "lg:absolute lg:bottom-0 lg:left-0 lg:right-0 translate-y-full group-hover:translate-y-0",
                    skin.footerBorder,
                )}
            >
                <Label
                    className={cn(
                        "text-4xs font-black uppercase tracking-[0.2em] cursor-pointer flex items-center gap-1",
                        surface.text,
                    )}
                >
                    Détails{" "}
                    <ChevronRight
                        size={10}
                        className="group-hover:translate-x-0.5 transition-transform"
                    />
                </Label>
            </CardFooter>
        </Card>
    )
}
