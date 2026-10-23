import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { isVideoUrl } from "@/shared/utils/media"
import {
    fileIcon,
    formatBytes,
    formatLabel,
} from "@/features/drive/utils/fileDisplay"
import { Play } from "lucide-react"
import { useRef } from "react"
import { cn } from "@/shared/lib/utils"

import { useDriveDrag } from "@/features/drive/hooks/useDriveDrag"
import { type DriveItem } from "../types"

export default function FileCard({
    item,
    selected,
    toggle,
    openPreview,
    dragIds,
    onDropInto,
}: {
    item: DriveItem
    selected: boolean
    toggle: () => void
    openPreview: () => void
    /** Éléments transportés si le glisser part de cette carte. */
    dragIds?: string[]
    /** Fourni uniquement pour un dossier : reçoit les éléments déposés. */
    onDropInto?: (ids: string[]) => void
}) {
    const touchTimerRef = useRef<number | null>(null)
    const { dropActive, dragProps } = useDriveDrag({
        itemId: item.id,
        dragIds,
        onDropInto,
    })
    const isFolder = item?.isFolder === true
    const isVideo =
        !isFolder &&
        (item?.type === "video" ||
            item?.mime?.startsWith("video/") ||
            isVideoUrl(item?.url ?? ""))
    // Le `!item.mime` couvre les entrées antérieures à la migration 005, qui
    // ne pouvaient être que des images ou des vidéos.
    const isImage =
        !isFolder &&
        !isVideo &&
        (item?.type === "image" ||
            item?.mime?.startsWith("image/") ||
            !item?.mime)
    const Icon = fileIcon(item)
    const size = formatBytes(item?.sizeBytes)
    const label = formatLabel(item)

    // Un aperçu occupe toute la vignette : le titre doit alors se poser sur le
    // média, en blanc sur dégradé sombre. Sans aperçu, la vignette est un aplat
    // de la palette et le titre reprend les couleurs du thème — un dégradé noir
    // sur fond clair y faisait une bande sale en thème clair, et un empilement
    // de gris indistincts en thème sombre.
    const hasPreview = isImage || isVideo

    return (
        <Card
            variant="interactive"
            className={cn(
                "group relative overflow-hidden rounded-2xl border active:scale-98 motion-reduce:active:scale-100 touch-manipulation select-none",
                // `ring-inset` : la vignette est en overflow-hidden, un anneau
                // extérieur serait rogné sur ses quatre côtés.
                selected && "ring-2 ring-inset ring-primary border-primary",
                dropActive && "ring-2 ring-inset ring-primary"
            )}
            {...dragProps}
            onClick={(e) => {
                const hit = (e.target as HTMLElement).closest("[data-select]")
                if (hit) return // clique sur la checkbox → ne pas ouvrir la preview
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault()
                    toggle()
                    return
                }
                openPreview()
            }}
            onTouchStart={() => {
                touchTimerRef.current = window.setTimeout(() => toggle(), 600)
            }}
            onTouchEnd={() => {
                if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
            }}
        >
            <CardContent className="p-0 relative">
                {isVideo ? (
                    <>
                        <video
                            src={item.url}
                            muted
                            preload="metadata"
                            playsInline
                            // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                            className="h-48 w-full object-cover md:h-52 lg:h-56 bg-black"
                        />
                        {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4) */}
                        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/30 opacity-0 transition group-hover:flex group-hover:opacity-100">
                            {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4) */}
                            <Play className="h-10 w-10 text-white drop-shadow-lg" />
                        </div>
                    </>
                ) : isImage ? (
                    <img
                        src={item.url}
                        alt={item.title}
                        className="h-48 w-full object-cover md:h-52 lg:h-56"
                        loading="lazy"
                    />
                ) : (
                    // Ni image ni vidéo : aucun aperçu possible, on montre
                    // l'icône du type et le poids du fichier.
                    // `pb-12` réserve la hauteur du bandeau de titre, qui est en
                    // position absolue : sans elle, il recouvrait le poids du
                    // fichier affiché sous l'icône.
                    <div className="flex h-48 w-full flex-col items-center justify-center gap-2 bg-muted/60 pb-12 md:h-52 lg:h-56">
                        <Icon
                            className="h-12 w-12 text-muted-foreground"
                            aria-hidden="true"
                        />
                        {size && (
                            <span className="text-xs text-muted-foreground">
                                {size}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>

            {/* ✅ Checkbox seule (plus de bouton autour) */}
            {/* Le conteneur ne porte plus que la zone de clic : empiler une
                pastille carrée et une case carrée faisait deux contours
                imbriqués. L'habillage est passé sur la case elle-même. */}
            <div
                data-select
                className={cn(
                    "absolute right-2 top-2 z-10 cursor-pointer p-1.5 transition",
                    "sm:opacity-0 sm:group-hover:opacity-100",
                    "opacity-100", // visible sur mobile
                    // Une case cochée reste visible sans survol : sinon la
                    // sélection disparaissait dès que le pointeur s'éloignait.
                    selected && "sm:opacity-100"
                )}
                onClick={(e) => e.stopPropagation()} // ne pas ouvrir la preview
            >
                <Checkbox
                    checked={selected}
                    onCheckedChange={toggle}
                    className={cn(
                        // `size-5` et non 6 : l'atome fige sa coche à 16 px, un
                        // carré de 24 px la laissait flotter au centre. À 20 px
                        // les proportions redeviennent justes.
                        //
                        // `flex items-center justify-center` : le Root de
                        // l'atome n'est pas un conteneur flex, seul son
                        // indicateur l'est. Cela passe inaperçu à la taille
                        // d'origine, où la coche remplit exactement la case,
                        // mais dès qu'on l'agrandit la coche se cale en haut à
                        // gauche.
                        //
                        // `[&_svg]:size-3` : centrée géométriquement, la coche
                        // de 16 px paraissait quand même mal posée, parce que
                        // le glyphe de lucide est bien plus large que haut
                        // (18×13 dans son viewBox). Ses pointes frôlaient le
                        // bord du cercle quand il restait de l'air en haut et
                        // en bas. À 12 px elle respire et l'équilibre optique
                        // revient. Même convention que l'atome Button.
                        "flex size-5 items-center justify-center rounded-full [&_svg]:size-3",
                        // `border` et non `ring` : un ring est un box-shadow
                        // posé À L'EXTÉRIEUR de la boîte, si bien qu'une fois
                        // cochée la case montrait trois couches — le rond vert,
                        // puis un liseré presque blanc (--border vaut 90 % de
                        // luminosité en thème clair), puis le contour. Une
                        // bordure est dans la boîte : cochée, le rond est plein
                        // et net.
                        //
                        // Le flou détache la case du média : la vignette
                        // derrière peut être n'importe quelle image.
                        "border border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70",
                        // Cochée, elle se remplit franchement : l'état se lit
                        // d'un coup d'œil sur une planche de vignettes.
                        "data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    )}
                />
            </div>

            {/* ✅ Barre de titre */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
                {hasPreview ? (
                    // Sur un aperçu : dégradé montant depuis le bas, qui assoit
                    // le texte sans masquer le média. Le dégradé part du bord de
                    // la carte plutôt que d'une pastille flottante — celle-ci
                    // laissait une bande grise en suspens sur les vignettes
                    // claires.
                    <div className="bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-2 pt-8">
                        {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- texte posé sur un média de couleur imprévisible : blanc requis pour le contraste, indépendant du thème (design system §12.4) */}
                        <div className="truncate text-xs font-medium text-white drop-shadow-sm sm:text-sm">
                            {item.title}
                        </div>
                        {isVideo && label && (
                            // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte posé sur un média de couleur imprévisible : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                            <div className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/90 ring-1 ring-white/30">
                                {label}
                            </div>
                        )}
                    </div>
                ) : (
                    // Sans aperçu : bandeau opaque aux couleurs du thème. Le
                    // titre y est lisible de plein droit, et la carte cesse de
                    // porter un dégradé sombre sans raison.
                    <div className="border-t bg-card/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <div className="truncate text-xs font-medium text-card-foreground sm:text-sm">
                            {item.title}
                        </div>
                        {label && (
                            <div className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
                                {label}
                            </div>
                        )}
                    </div>
                )}
            </div>

        </Card>
    )
}
