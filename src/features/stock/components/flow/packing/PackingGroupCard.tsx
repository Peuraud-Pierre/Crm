import type { Ref } from "react"
import {
    ArrowRight, BookCheck, Bot, Check, CheckCircle2, ChevronDown, CircleSlash, Sparkles,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { SearchSelect, type SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { TruncatedText } from "@/shared/ui/molecules/truncated-text"
import { cn } from "@/shared/lib/utils"
import { staggerStyle } from "@/shared/lib/motion"
import { PACKING_LOW_CONFIDENCE } from "@/features/stock/constants"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"
import { PackingLineRow } from "./PackingLineRow"
import { formatConfidence, formatKg, formatPackages, formatQty } from "./packingFormat"

interface PackingGroupCardProps {
    group: PackingGroup
    categoryOptions: SearchSelectOption[]
    categoryName: (id: string | null) => string
    /**
     * Conteneur sur lequel la correspondance a été validée, pour un groupe
     * venu du dictionnaire. C'est ce qui rend l'auto-résolution vérifiable.
     */
    dictionaryLabel?: string | null
    /** Absent : lecture seule (pas de `stock.packing.update`). */
    onAccept?: () => void
    onAssign?: (categoryId: string) => void
    onAssignLigne?: (ligneId: string, categoryId: string) => void
    /**
     * Créer une catégorie absente du référentiel puis l'attribuer — au groupe
     * (`ligneId` absent) ou à une seule ligne. Absent : pas le droit.
     */
    onCreateCategory?: (query: string, ligneId?: string) => void
    /**
     * La carte peut-elle entrer dans une sélection multiple ? Vrai seulement
     * dans la strate « à classer » : un groupe acquis ne se coche pas, il se
     * corrige délibérément.
     */
    selectable?: boolean
    selected?: boolean
    /** `extend` porte le Maj-clic, qui sélectionne une plage. */
    onSelectedChange?: (extend: boolean) => void
    /**
     * Catégories récemment retenues, dans l'ordre des raccourcis 1-5. Affichées
     * sur la SEULE carte focalisée : 74 cartes × 5 pastilles seraient du bruit,
     * et les chiffres n'ont d'existence que là où les pastilles se lisent — les
     * deux sont donc câblés sur la même condition.
     */
    recentCategories?: { id: string; label: string }[]
    /**
     * Liste des catégories ouverte, pilotée par le panneau : c'est lui qui sait
     * quel libellé a le focus, et une seule liste doit être ouverte à la fois.
     */
    listOpen?: boolean
    onListOpenChange?: (open: boolean) => void
    expanded: boolean
    onToggleExpanded: () => void
    focused: boolean
    onFocus: () => void
    cardRef?: Ref<HTMLDivElement>
    /** Position dans sa strate — pilote le décalage du stagger d'entrée. */
    index?: number
}

const STATE_STYLE = {
    unmatched: { icon: CircleSlash, tone: "text-destructive", border: "border-l-destructive", label: "À classer" },
    model: { icon: Bot, tone: "text-primary", border: "border-l-primary", label: "Classé automatiquement" },
    reviewed: { icon: CheckCircle2, tone: "text-success", border: "border-l-success", label: "Classé" },
    dictionary: { icon: BookCheck, tone: "text-success", border: "border-l-success", label: "Reconnu" },
} as const

/**
 * Un libellé brut du fichier et tout ce qu'il couvre.
 *
 * La carte met côte à côte ce que dit le FICHIER (libellé brut, en mono et
 * entre guillemets : on lit une donnée, pas un nom) et ce que la console en a
 * COMPRIS (catégorie proposée, confiance, catégorie retenue). C'est cet écart
 * que l'humain arbitre.
 *
 * Les totaux se lisent en COLIS d'abord : c'est la grandeur qui mesure le
 * risque d'une erreur de catégorie, et la seule dont toutes les lignes
 * disposent. Le contenu (pièces ou kilos) vient ensuite, quand le fichier le
 * donne.
 *
 * Un groupe acquis — classé ou reconnu — se replie en une ligne : il ne doit
 * plus coûter d'attention. Un groupe classé par le modèle reste DÉPLIÉ : il
 * est acquis, mais c'est la seule strate où une erreur passerait sans qu'un
 * humain ait choisi — sa catégorie et sa confiance doivent se lire d'un coup
 * d'œil, et se corriger sans clic de plus.
 */
export function PackingGroupCard({
    group,
    categoryOptions,
    categoryName,
    dictionaryLabel,
    onAccept,
    onAssign,
    onAssignLigne,
    onCreateCategory,
    selectable = false,
    selected = false,
    onSelectedChange,
    recentCategories = [],
    listOpen,
    onListOpenChange,
    expanded,
    onToggleExpanded,
    focused,
    onFocus,
    cardRef,
    index = 0,
}: PackingGroupCardProps) {
    const style = STATE_STYLE[group.state]
    const StateIcon = style.icon
    const editable = Boolean(onAssign)
    const settled = group.state === "reviewed" || group.state === "dictionary"
    const confidence = formatConfidence(group.confidence)
    const lowConfidence = group.confidence !== null && group.confidence < PACKING_LOW_CONFIDENCE
    const corrected =
        group.categoryId !== null &&
        group.suggestedCategoryId !== null &&
        group.categoryId !== group.suggestedCategoryId
    const compact = settled && !expanded
    // Confirmer = retenir la proposition affichée. Sans proposition, il n'y a
    // rien à confirmer : il faut choisir une catégorie.
    const canAccept = group.state === "unmatched" && group.suggestedCategoryId !== null

    return (
        <div
            ref={cardRef}
            tabIndex={0}
            onFocus={onFocus}
            data-group-key={group.key}
            aria-label={`Libellé ${group.rawLabel} — ${style.label}`}
            // Le décalage d'entrée est posé en style inline sur une animation
            // CSS, jamais par framer-motion : une carte est de fait une ligne de
            // liste, et monter un moteur d'animation JS par ligne coûterait cher
            // pour une cascade (DESIGN_SYSTEM.md §13.6).
            style={staggerStyle(index, { step: 40, cap: 360 })}
            className={cn(
                "rounded-lg border border-l-4 border-border bg-card transition-shadow duration-base",
                "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-emphasized motion-reduce:animate-none",
                // Le survol ÉLÈVE la carte sans la déplacer : elle n'est pas
                // cliquable dans son ensemble, un décalage promettrait un geste
                // qui n'existe pas (DESIGN_SYSTEM.md §13.7). Il dit seulement
                // « c'est cette ligne-là que vous visez », ce qui manquait sur
                // une liste de 140 cartes identiques.
                "hover:shadow-md",
                // Le contour clavier ne doit pas dépendre du seul état interne
                // du panneau : une tabulation qui entre par un autre chemin
                // laissait la carte sans repère visible.
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                style.border,
                focused && "ring-2 ring-primary/40",
            )}
        >
            {/* ── En-tête : ce que dit le fichier ── */}
            <div className="flex items-center gap-3 px-4 py-3">
                {selectable && onSelectedChange && (
                    <Checkbox
                        checked={selected}
                        // Le Maj-clic passe par `onClick` : `onCheckedChange` de
                        // Radix ne transporte pas l'événement, donc pas la touche.
                        onClick={(event) => onSelectedChange(event.shiftKey)}
                        aria-label={`Sélectionner « ${group.rawLabel} »`}
                        className="shrink-0"
                    />
                )}
                <StateIcon size={16} className={cn("shrink-0", style.tone)} aria-label={style.label} />

                <div className="min-w-0 flex-1">
                    <TruncatedText
                        text={`« ${group.rawLabel} »`}
                        className="font-mono text-sm font-semibold text-foreground"
                    />
                    <p className="text-xs tabular-nums text-muted-foreground">
                        {formatPackages(group.totalPackages)} · {group.lignes.length} ligne
                        {group.lignes.length > 1 ? "s" : ""}
                        {group.totalPieces > 0 && <> · {formatQty(group.totalPieces)}</>}
                        {group.totalWeightKg > 0 && <> · {formatKg(group.totalWeightKg)}</>}
                    </p>
                </div>

                {compact && (
                    <TruncatedText
                        text={group.mixed ? "Plusieurs catégories" : categoryName(group.categoryId)}
                        className="hidden max-w-48 text-sm font-medium text-foreground sm:block"
                    />
                )}

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onToggleExpanded}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Masquer les lignes" : "Afficher les lignes"}
                >
                    <ChevronDown
                        size={14}
                        className={cn(
                            "transition-transform duration-base ease-emphasized",
                            expanded && "rotate-180",
                        )}
                        aria-hidden
                    />
                </Button>
            </div>

            {/* ── Correspondance : ce que la console en a compris ── */}
            {!compact && (
                <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:w-2/5">
                        {group.state === "dictionary" ? (
                            <>
                                <BookCheck size={12} className="shrink-0 text-success" aria-hidden />
                                {dictionaryLabel ? (
                                    <>
                                        <span className="shrink-0">Déjà validé sur</span>
                                        <TruncatedText text={dictionaryLabel} className="text-foreground" />
                                    </>
                                ) : (
                                    <span className="truncate">Déjà validé sur un précédent conteneur</span>
                                )}
                            </>
                        ) : group.state === "model" ? (
                            <>
                                <Bot size={12} className="shrink-0 text-primary" aria-hidden />
                                <span className="truncate">Classé par le modèle</span>
                                {confidence && (
                                    <span
                                        className="shrink-0 rounded bg-primary/10 px-1.5 py-px text-2xs font-medium tabular-nums text-primary"
                                        title="Le modèle ne classe seul qu'au-dessus d'un seuil de confiance où sa précision passée a été mesurée. Corrigez si besoin : la correction lui sert d'exemple."
                                    >
                                        {confidence}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <Sparkles size={12} className="shrink-0" aria-hidden />
                                {group.suggestedCategoryId ? (
                                    <>
                                        {/* « Proposé : » ne se tronque jamais —
                                            c'est le NOM de la catégorie qu'il
                                            faut pouvoir lire en entier pour
                                            décider, pas l'intitulé. */}
                                        <span className="shrink-0">Proposé :</span>
                                        <TruncatedText
                                            text={categoryName(group.suggestedCategoryId)}
                                            className="text-foreground"
                                        />
                                    </>
                                ) : (
                                    <span className="text-destructive">Aucune correspondance trouvée</span>
                                )}
                                {confidence && (
                                    <span
                                        className={cn(
                                            "shrink-0 rounded px-1.5 py-px text-2xs font-medium tabular-nums",
                                            lowConfidence ? "bg-warning-light text-warning" : "bg-muted text-muted-foreground",
                                        )}
                                        title="Confiance de la proposition — elle n'engage rien tant qu'elle n'est pas confirmée"
                                    >
                                        {confidence}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <ArrowRight size={12} className="hidden shrink-0 text-muted-foreground sm:block" aria-hidden />

                    <div className="flex flex-1 items-center gap-2">
                        {editable ? (
                            <div className="min-w-0 flex-1">
                                <SearchSelect
                                    options={categoryOptions}
                                    value={group.mixed ? "" : group.categoryId ?? ""}
                                    onChange={(value) => value && onAssign?.(value)}
                                    placeholder={group.mixed ? "Plusieurs catégories — tout réattribuer…" : "Choisir la catégorie…"}
                                    variant="button"
                                    size="sm"
                                    searchable
                                    emptyMessage="Aucune catégorie"
                                    onCreate={onCreateCategory ? (query) => onCreateCategory(query) : undefined}
                                    createLabel="Nouvelle catégorie"
                                    open={listOpen}
                                    onOpenChange={onListOpenChange}
                                    // Une carte classée QUITTE la strate : rendre
                                    // le focus à son déclencheur le poserait sur
                                    // un nœud en cours de démontage, et
                                    // l'enchaînement au clavier s'arrêterait là.
                                    restoreFocusOnClose={false}
                                />
                            </div>
                        ) : (
                            <TruncatedText
                                text={group.mixed ? "Plusieurs catégories" : categoryName(group.categoryId)}
                                className="flex-1 text-sm font-medium"
                            />
                        )}

                        {corrected && (
                            <span className="shrink-0 text-2xs font-medium text-primary">Corrigé</span>
                        )}

                        {editable && canAccept && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0 gap-1"
                                onClick={onAccept}
                                aria-label={`Confirmer la catégorie de « ${group.rawLabel} »`}
                            >
                                <Check size={13} aria-hidden />
                                <span className="hidden sm:inline">Confirmer</span>
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Raccourcis vers ce qu'on vient d'utiliser ── */}
            {!compact && editable && focused && recentCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 border-t border-border px-4 py-2">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground">
                        Récentes
                    </span>
                    {recentCategories.map((recent, index) => (
                        <Button
                            key={recent.id}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 px-1.5 text-2xs"
                            onClick={() => onAssign?.(recent.id)}
                            // Le nom est tronqué à 8 rem dans la pastille : le
                            // libellé accessible, lui, le dit en entier.
                            aria-label={`Attribuer « ${recent.label} » (touche ${index + 1})`}
                        >
                            <kbd className="rounded border border-border px-1 text-3xs">{index + 1}</kbd>
                            <span className="max-w-32 truncate">{recent.label}</span>
                        </Button>
                    ))}
                </div>
            )}

            {/* ── Détail ligne à ligne ── */}
            {expanded && (
                <ul className="divide-y divide-border border-t border-border bg-muted/20">
                    {group.lignes.map((ligne) => (
                        <PackingLineRow
                            key={ligne.id}
                            ligne={ligne}
                            categoryOptions={categoryOptions}
                            categoryName={categoryName}
                            onAssign={onAssignLigne ? (categoryId) => onAssignLigne(ligne.id, categoryId) : undefined}
                            onCreateCategory={
                                onAssignLigne && onCreateCategory
                                    ? (query) => onCreateCategory(query, ligne.id)
                                    : undefined
                            }
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}
