import { useMemo, useState, type KeyboardEvent } from "react"
import { PartyPopper, Search } from "lucide-react"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { usePackingReviewFocus } from "@/features/stock/hooks/ui/usePackingReviewFocus"
import { usePackingBulkAssign } from "@/features/stock/hooks/ui/usePackingBulkAssign"
import { filterGroups, recentCategories, type PackingSort } from "@/features/stock/utils/packingGrouping"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"
import { PackingBulkAssignBar } from "./PackingBulkAssignBar"
import { PackingReviewActions } from "./PackingReviewActions"
import { PackingBulkConfirmDialog } from "./PackingBulkConfirmDialog"
import { PackingDictionaryStrata } from "./PackingDictionaryStrata"
import { PackingGroupCard } from "./PackingGroupCard"
import { PackingSettledStrata } from "./PackingSettledStrata"
import { PackingUnmatchedStrata } from "./PackingUnmatchedStrata"
import type { PackingReviewFilter } from "./PackingReviewToolbar"

export interface PackingGroupAssignment {
    rawLabelKey: string
    categoryId: string
}

interface PackingReviewPanelProps {
    groups: PackingGroup[]
    filter: PackingReviewFilter
    /** Recherche par libellé. Vide : tout est affiché. */
    labelQuery?: string
    sort?: PackingSort
    categoryOptions: SearchSelectOption[]
    categoryName: (id: string | null) => string
    /** Conteneur d'origine d'une correspondance apprise, par clé de libellé. */
    dictionaryLabels?: Map<string, string | null>
    /** Absents : lecture seule. `onAssignGroup` commande l'éditabilité. */
    onAssignGroup?: (rawLabelKey: string, categoryId: string) => void
    /**
     * Confirmer la proposition : ne remplit que les lignes encore sans
     * catégorie, là où `onAssignGroup` réattribue tout le libellé.
     */
    onAcceptGroup?: (rawLabelKey: string, categoryId: string) => void
    onAcceptMany?: (assignments: PackingGroupAssignment[]) => void
    onAssignLigne?: (ligneId: string, categoryId: string) => void
    /**
     * Aucune catégorie ne convient (« SHORT HAWAII » sans catégorie « Short ») :
     * la créer depuis la recherche. `name` est le texte cherché ; `assign`
     * attribue la catégorie créée là où la demande est partie.
     * Absent : pas le droit de créer une catégorie.
     */
    onCreateCategory?: (name: string, assign: (categoryId: string) => void) => void
    /** Défait la dernière décision. Absent : rien à annuler, ou pas le droit. */
    onUndo?: () => void
    /** Libellés que l'annulation ramènerait — c'est ce qui la rend lisible. */
    undoLabels?: string[]
}

/**
 * Libellés d'une packing list, rangés en quatre strates par ce qu'ils coûtent :
 *
 *  1. À CLASSER — les seuls qui demandent une décision, et les seuls qui
 *     bloquent la validation.
 *  2. CLASSÉS AUTOMATIQUEMENT — par le modèle de `packing-api`, qui apprend
 *     de chaque décision humaine et ne classe seul qu'au-dessus d'un seuil où
 *     sa précision a été mesurée. Ils ne bloquent rien, mais restent dépliés :
 *     c'est la seule strate où une erreur passerait sans choix humain. Une
 *     correction y devient un exemple pour le modèle.
 *  3. CLASSÉS — tranchés à l'instant par l'utilisateur.
 *  4. RECONNUS — résolus par le tableau de correspondance, parce qu'ils ont
 *     déjà été validés sur un autre conteneur. Repliés par défaut : leur
 *     intérêt est d'être VUS comme acquis, pas d'être relus.
 *
 * C'est cette troisième strate qui répond au problème de fond. Un conteneur
 * porte 90 à 140 libellés presque tous distincts : les regrouper à l'intérieur
 * du fichier ne fait gagner que 9 %. Ce qui se répète, c'est le vocabulaire du
 * fournisseur d'un conteneur au suivant — mesuré entre deux packings réelles,
 * 47 des 121 libellés du second étaient déjà connus du premier.
 *
 * L'enchaînement se fait sans souris :
 *  - ↑ / ↓ passent d'un libellé à l'autre ;
 *  - Entrée TRAITE le libellé focalisé — elle confirme la proposition affichée
 *    s'il y en a une, et ouvre la liste des catégories sinon. C'est le cas qui
 *    compte : au démarrage, le dictionnaire est vide et le modèle n'a pas encore
 *    de seuil calibré, donc la plupart des libellés n'ont AUCUNE proposition.
 *    Entrée n'y faisait rien, et il fallait la souris pour le seul geste qui
 *    restait à faire ;
 *  - Espace ouvre la liste même quand une proposition existe — le cas où elle
 *    est fausse ;
 *  - après une confirmation ou une réattribution, le focus passe au SUIVANT,
 *    et le libellé traité sort de la strate « à classer ».
 *
 * Les groupes arrivent déjà ordonnés (`utils/packingGrouping`) : le plus gros
 * lot de colis d'abord, puis la proposition la moins sûre.
 */
export function PackingReviewPanel({
    groups,
    filter,
    labelQuery = "",
    sort = "risque",
    categoryOptions,
    categoryName,
    dictionaryLabels,
    onAssignGroup,
    onAcceptGroup,
    onAcceptMany,
    onAssignLigne,
    onCreateCategory,
    onUndo,
    undoLabels = [],
}: PackingReviewPanelProps) {
    /**
     * Le filtrage précède le découpage en strates, donc `navigable` le suit
     * sans qu'on y touche : ↑/↓ ne circulent que sur ce qui est affiché, et la
     * garde « une carte non rendue n'est pas navigable » tient d'elle-même.
     */
    const visible = useMemo(
        () => filterGroups(groups, { query: labelQuery, sort }),
        [groups, labelQuery, sort],
    )

    const strata = useMemo(
        () => ({
            unmatched: visible.filter((g) => g.state === "unmatched"),
            model: visible.filter((g) => g.state === "model"),
            reviewed: visible.filter((g) => g.state === "reviewed"),
            dictionary: visible.filter((g) => g.state === "dictionary"),
        }),
        [visible],
    )

    const showUnmatched = filter !== "reviewed"
    const showSettled = filter !== "to_review"
    // Repliée par défaut : montrer 47 cartes acquises noierait les 74 qui
    // restent. On annonce leur nombre, on ne les déroule que sur demande.
    const [openDictionary, setOpenDictionary] = useState(false)
    const [bulkPending, setBulkPending] = useState(false)

    /**
     * Cartes réellement rendues, dans l'ordre du DOM : c'est sur elles que
     * ↑ / ↓ circulent. Une carte repliée dans une strate fermée n'est pas
     * navigable, sinon le focus partirait dans le vide.
     */
    const navigable = useMemo(() => {
        const list: PackingGroup[] = []
        if (showUnmatched) list.push(...strata.unmatched)
        list.push(...strata.model)
        if (showSettled) {
            list.push(...strata.reviewed)
            if (openDictionary || filter === "reviewed") list.push(...strata.dictionary)
        }
        return list
    }, [strata, showUnmatched, showSettled, openDictionary, filter])

    /**
     * Libellé dont la liste de catégories est ouverte. Piloté ici plutôt que
     * par la carte : c'est le panneau qui sait quel libellé a le focus, et une
     * seule liste doit être ouverte à la fois.
     */
    const [openListKey, setOpenListKey] = useState<string | null>(null)

    /** Retenir la proposition affichée. Sans proposition, il n'y a rien à retenir. */
    const accept = (group: PackingGroup) => {
        const confirm = onAcceptGroup ?? onAssignGroup
        if (!confirm) return
        if (group.state !== "unmatched" || !group.suggestedCategoryId) return
        advanceFrom(group.key)
        confirm(group.key, group.suggestedCategoryId)
    }

    /**
     * Ouvrir la liste sans souris. Même garde que `accept` : hors de la strate
     * « à classer », rien ne s'ouvre — un groupe déjà acquis ne doit pas changer
     * sur une frappe, il se corrige délibérément.
     */
    const openList = (group: PackingGroup) => {
        if (!onAssignGroup || group.state !== "unmatched") return
        setOpenListKey(group.key)
    }

    /** Entrée : confirmer s'il y a de quoi, ouvrir la liste sinon. */
    const handleEnter = (group: PackingGroup) => {
        if (group.suggestedCategoryId) accept(group)
        // Pas d'`advanceFrom` ici : le focus doit rester sur le libellé dont on
        // vient d'ouvrir la liste.
        else openList(group)
    }

    /**
     * Les cinq dernières catégories retenues, dans l'ordre. Cinq et pas neuf :
     * au-delà, la rangée se lit plus lentement qu'on ne tape trois lettres.
     */
    const recents = useMemo(() => {
        const ids = recentCategories(groups)
        return ids.map((id) => ({ id, label: categoryName(id) }))
    }, [groups, categoryName])

    /** Chiffre 1-5 : attribuer la Nᵉ catégorie récente au libellé focalisé. */
    const assignRecent = (group: PackingGroup, index: number) => {
        const recent = recents[index]
        if (!recent || group.state !== "unmatched") return
        assign(group, recent.id)
    }

    const {
        focusedKey,
        setFocusedKey,
        expanded,
        toggleExpanded,
        registerCard,
        advanceFrom,
        focusCard,
        handleKeyDown,
    } = usePackingReviewFocus({
        navigable,
        onEnter: handleEnter,
        onSpace: openList,
        onDigit: assignRecent,
    })

    const assign = (group: PackingGroup, categoryId: string) => {
        if (!onAssignGroup) return
        advanceFrom(group.key)
        onAssignGroup(group.key, categoryId)
    }

    // Un seul abonnement pour tout le panneau : appeler ce hook dans une carte
    // en produirait un par ligne (DESIGN_SYSTEM.md §13.5).
    const reducedMotion = usePrefersReducedMotion()

    const bulk = usePackingBulkAssign(strata.unmatched, onAcceptMany)

    /** Les groupes à classer qui portent une proposition confirmable d'un bloc. */
    const bulkAssignments = useMemo<PackingGroupAssignment[]>(
        () =>
            strata.unmatched
                .filter((g) => g.suggestedCategoryId !== null)
                .map((g) => ({ rawLabelKey: g.key, categoryId: g.suggestedCategoryId as string })),
        [strata.unmatched],
    )

    const renderCard = (group: PackingGroup, index = 0) => (
        <PackingGroupCard
            key={group.key}
            index={index}
            group={group}
            categoryOptions={categoryOptions}
            categoryName={categoryName}
            dictionaryLabel={dictionaryLabels?.get(group.key) ?? null}
            onAccept={onAssignGroup ? () => accept(group) : undefined}
            onAssign={onAssignGroup ? (categoryId) => assign(group, categoryId) : undefined}
            onAssignLigne={onAssignLigne}
            onCreateCategory={
                onCreateCategory && onAssignGroup
                    ? (query, ligneId) =>
                          onCreateCategory(query, (categoryId) =>
                              ligneId ? onAssignLigne?.(ligneId, categoryId) : assign(group, categoryId),
                          )
                    : undefined
            }
            selectable={bulk.enabled && group.state === "unmatched"}
            selected={bulk.selection.selected.has(group.key)}
            onSelectedChange={
                bulk.enabled ? (extend) => bulk.selection.toggle(group.key, extend) : undefined
            }
            recentCategories={recents}
            listOpen={openListKey === group.key}
            onListOpenChange={(open) => setOpenListKey(open ? group.key : null)}
            expanded={expanded.has(group.key)}
            onToggleExpanded={() => toggleExpanded(group.key)}
            focused={focusedKey === group.key}
            onFocus={() => setFocusedKey(group.key)}
            cardRef={(node) => registerCard(group.key, node)}
        />
    )

    if (groups.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={PartyPopper}
                title="Aucun libellé dans cette packing list"
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    /**
     * Ctrl/⌘+Z est pris ici et non dans `usePackingReviewFocus` : la garde
     * `dataset.groupKey` de ce dernier n'accepte que les frappes venues d'une
     * carte, alors qu'on doit pouvoir annuler depuis n'importe où dans le
     * panneau. Dans un champ de saisie, la touche reste l'annulation de saisie
     * native — l'intercepter effacerait la recherche en cours de quelqu'un.
     */
    const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            const tag = (event.target as HTMLElement).tagName
            if (tag === "INPUT" || tag === "TEXTAREA") return
            if (!onUndo || undoLabels.length === 0) return
            event.preventDefault()
            onUndo()
            return
        }
        handleKeyDown(event)
    }

    return (
        /* Un seul fournisseur d'infobulles pour tout le panneau : les noms de
           catégorie tronqués des cartes s'y rattachent, et le panneau reste
           montable seul (en test) sans dépendre de celui d'`AppProviders`. */
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col gap-3" onKeyDown={handlePanelKeyDown}>
                {/* ── Ce dont l'utilisateur est dispensé ────────────────────────── */}
                {strata.dictionary.length > 0 && filter !== "reviewed" && (
                    <PackingDictionaryStrata
                        groups={strata.dictionary}
                        open={openDictionary}
                        onToggle={() => setOpenDictionary((v) => !v)}
                        renderCard={renderCard}
                    />
                )}

                {/* ── À classer : le seul vrai travail ─────────────────────────── */}
                {showUnmatched && (strata.unmatched.length > 0 || undoLabels.length > 0) && (
                    <PackingUnmatchedStrata
                        groups={strata.unmatched}
                        editable={Boolean(onAssignGroup)}
                        bulkCount={onAcceptMany ? bulkAssignments.length : 0}
                        onBulkRequest={() => setBulkPending(true)}
                        actionsSlot={
                            <PackingReviewActions
                                undoLabels={undoLabels}
                                onUndo={onUndo}
                                canResume={Boolean(onAssignGroup) && focusedKey === null && strata.unmatched.length > 0}
                                onResume={() => focusCard(strata.unmatched[0].key)}
                            />
                        }
                        renderCard={renderCard}
                        reducedMotion={reducedMotion}
                    />
                )}

                {bulk.enabled && bulk.selection.count > 0 && (
                    <PackingBulkAssignBar
                        count={bulk.selection.count}
                        packages={bulk.packages}
                        categoryOptions={categoryOptions}
                        onAssign={bulk.request}
                        onSelectAll={bulk.selection.selectAll}
                        onClear={bulk.selection.clear}
                        canSelectAll={bulk.selection.count < bulk.selectableCount}
                    />
                )}

                {/* Une recherche peut MASQUER du travail : annoncer « tout est
                    classé » dans ce cas serait un mensonge sur l'achèvement. */}
                {showUnmatched && strata.unmatched.length === 0 && (
                    <EmptyState
                        size="sm"
                        icon={labelQuery ? Search : PartyPopper}
                        variant={labelQuery ? "search" : "default"}
                        title={labelQuery ? `Aucun libellé ne correspond à « ${labelQuery} »` : "Tout est classé"}
                        description={
                            labelQuery
                                ? "D'autres libellés restent peut-être à classer hors de cette recherche."
                                : "Chaque libellé a sa catégorie. Vous pouvez valider la packing list."
                        }
                        className="rounded-xl border border-dashed border-border"
                    />
                )}

                {/* ── Ce qui ne demande plus de décision ───────────────────────── */}
                <PackingSettledStrata
                    model={strata.model}
                    reviewed={strata.reviewed}
                    dictionary={strata.dictionary}
                    showSettled={showSettled}
                    reviewedOnly={filter === "reviewed"}
                    renderCard={renderCard}
                />

                <PackingBulkConfirmDialog
                    open={bulkPending}
                    onOpenChange={setBulkPending}
                    mode="suggestions"
                    count={bulkAssignments.length}
                    onConfirm={() => onAcceptMany?.(bulkAssignments)}
                />

                <PackingBulkConfirmDialog
                    open={bulk.pendingCategory !== null}
                    onOpenChange={(open) => !open && bulk.cancel()}
                    mode="selection"
                    count={bulk.selection.count}
                    categoryLabel={bulk.pendingCategory ? categoryName(bulk.pendingCategory) : ""}
                    onConfirm={() => bulk.pendingCategory && bulk.commit(bulk.pendingCategory)}
                />
            </div>
        </TooltipProvider>
    )
}
