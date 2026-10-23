import { PACKING_GAP_TOLERANCE } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type {
    PackingGap,
    PackingGroup,
    PackingGroupState,
    PackingListLigne,
    PackingListSummary,
} from "@/features/stock/types/packing-list.types"

/**
 * Logique pure de la vérification des packing lists : regroupement des lignes
 * par libellé brut, ordre de revue, écarts de totaux. Sans React ni Supabase,
 * pour être testée à part (`packingGrouping.test.ts`).
 */

/**
 * Version du normaliseur qui produit `raw_label_key`. Stockée sur chaque ligne
 * et sur chaque entrée du dictionnaire : quand les règles changent, les clés
 * périmées cessent de correspondre au lieu de correspondre à tort.
 */
export const PACKING_NORMALIZER_VERSION = 2

/**
 * Orthographes flottantes du même article, relevées sur CONTENEUR GR153 et
 * GR154. Ce ne sont pas des rapprochements approximatifs : chaque paire a été
 * vérifiée article par article, et aucune ne fusionne deux libellés distincts
 * des 88 de GR153.
 */
const LABEL_SYNONYMS: ReadonlyArray<[RegExp, string]> = [
    [/\btshirt\b/g, "t shirt"],
    [/\bsweatshirt\b/g, "sweat shirt"],
    [/\bjkt\b/g, "jacket"],
    [/\bnaylon\b/g, "nylon"],
    [/\bcolumb\b/g, "colum"],
    [/\bhensen\b/g, "hansen"],
    [/\bbrohers?\b/g, "brother"],
    [/\b3button\b/g, "3 button"],
    [/\bpolyster\b/g, "poly"],
    [/\breyon\b/g, "rayon"],
]

/** Jetons sans valeur discriminante : « (A) », « (DXB) », « U.S.A. », « 45KG ». */
const LABEL_STOP_TOKENS = new Set(["a", "dxb", "usa", "kg", "kgs"])

/**
 * Normalisation d'un libellé : minuscules, sans accents, ponctuation réduite à
 * des espaces, puis orthographes du fournisseur harmonisées et pluriels
 * ramenés au singulier (« PANTS » et « PANT » désignent le même article).
 *
 * L'ordre des mots est CONSERVÉ : trier les jetons gagnerait quelques
 * correspondances mais rendrait la clé illisible et fusionnerait des articles
 * différents. Mesuré sur GR153 → GR154 : 47 correspondances exactes contre 37
 * avant, sans aucune collision.
 *
 * Trois implémentations doivent s'accorder : celle-ci, `normalize_packing_label`
 * en base (l'arbitre) et celle du service Go.
 */
export function normalizePackingLabel(value: string): string {
    let key = value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()

    for (const [pattern, replacement] of LABEL_SYNONYMS) key = key.replace(pattern, replacement)

    return key
        .split(" ")
        .filter((token) => token !== "" && !LABEL_STOP_TOKENS.has(token) && !/^\d+kg$/.test(token))
        .map((token) => (token.length > 1 && token.endsWith("s") ? token.slice(0, -1) : token))
        .join(" ")
}

const STATE_ORDER: Record<PackingGroupState, number> = {
    unmatched: 0,
    model: 1,
    reviewed: 2,
    dictionary: 3,
}

function mostFrequent(values: string[]): string {
    const counts = new Map<string, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    let best = values[0] ?? ""
    for (const [value, count] of counts) {
        if (count > (counts.get(best) ?? 0)) best = value
    }
    return best
}

function sumBy(lignes: PackingListLigne[], pick: (l: PackingListLigne) => number | null): number {
    return lignes.reduce((sum, l) => sum + (pick(l) ?? 0), 0)
}

/**
 * Ce que pèse (ou compte) une ligne, dans son régime d'unité.
 *
 * `declared_total` est la colonne TOTAL PCS/KG telle que lue, et le fichier la
 * laisse VIDE bien plus souvent qu'on ne l'imagine : 3 lignes en kilos sur 4
 * dans GR153, 9 sur 10 dans GR154. Sommer la seule colonne déclarée affichait
 * donc 75 kg là où le conteneur en porte 2 370, et 200 kg là où il en porte
 * 2 475 — un facteur trente, sur le nombre qui sert ensuite à confronter la
 * packing aux totaux saisis sur l'arrivage.
 *
 * Le repli sur `contenu d'un colis × nombre de colis` est LE calcul du
 * document, celui-là même que la colonne TOTAL reprend quand elle est
 * renseignée (`25 kg × 3 colis = 75`), et que le contrôle d'intégrité vérifie
 * ligne à ligne. Il ne devine rien : il termine une addition que le fournisseur
 * n'a pas écrite.
 *
 * `declared_total` reste la source dès qu'elle existe — y compris quand elle ne
 * tombe pas juste. Le document fait foi ; l'écart, lui, est signalé comme
 * anomalie et se lit sur la ligne concernée.
 */
export function ligneTotal(
    ligne: Pick<PackingListLigne, "declared_total" | "units_per_package" | "package_count">,
): number | null {
    if (ligne.declared_total !== null) return ligne.declared_total
    if (ligne.units_per_package === null || ligne.package_count === null) return null
    return ligne.units_per_package * ligne.package_count
}

function buildGroup(key: string, lignes: PackingListLigne[]): PackingGroup {
    const categoryIds = new Set(lignes.map((l) => l.category_id))
    const assigned = new Set(lignes.map((l) => l.category_id).filter((id) => id !== null))
    const hasUnmatched = categoryIds.has(null)

    // Un groupe entièrement issu du dictionnaire ne demande aucun œil. Dès
    // qu'un humain est passé sur une de ses lignes, il compte comme vérifié.
    // Classé par le modèle et jamais retouché : acquis, mais montré.
    const state: PackingGroupState = hasUnmatched
        ? "unmatched"
        : lignes.every((l) => l.resolution === "dictionary")
          ? "dictionary"
          : lignes.some((l) => l.resolution === "human")
            ? "reviewed"
            : "model"

    const confidences = lignes
        .map((l) => l.match_confidence)
        .filter((c): c is number => c !== null)

    return {
        key,
        rawLabel: mostFrequent(lignes.map((l) => l.raw_label)),
        lignes,
        state,
        categoryId: categoryIds.size === 1 ? [...categoryIds][0] : null,
        suggestedCategoryId: lignes.find((l) => l.suggested_category_id)?.suggested_category_id ?? null,
        confidence: confidences.length > 0 ? Math.min(...confidences) : null,
        // Deux catégories RETENUES différentes. Des lignes sans catégorie à
        // côté d'une catégorie unique ne font pas un groupe mixte : c'est un
        // groupe incomplet, déjà signalé par `unmatched`.
        mixed: assigned.size > 1,
        totalPackages: sumBy(lignes, (l) => l.package_count),
        totalPieces: sumBy(lignes, (l) => (l.unit_kind === "pcs" ? ligneTotal(l) : null)),
        totalWeightKg: sumBy(lignes, (l) => (l.unit_kind === "kgs" ? ligneTotal(l) : null)),
    }
}

/**
 * Regroupe les lignes par libellé brut normalisé, dans l'ordre de revue :
 *
 *  1. sans catégorie — elles bloquent la validation, c'est le seul vrai travail ;
 *  2. classées seules par le modèle — acquises, mais à survoler ;
 *  3. tranchées par un humain sur cette packing ;
 *  4. reconnues par le dictionnaire — rien à y faire.
 *
 * À état égal, le NOMBRE DE COLIS décroissant départage : une erreur sur
 * cinquante colis compte plus qu'une erreur sur un seul. C'est le colis qui
 * mesure le risque, pas le poids — 93 lignes sur 97 de GR153 n'en portent
 * aucun. Puis, à égalité, la confiance la plus basse d'abord : les propositions
 * les plus douteuses méritent l'œil humain en premier.
 */
export function groupLignes(lignes: readonly PackingListLigne[]): PackingGroup[] {
    const byKey = new Map<string, PackingListLigne[]>()
    for (const ligne of lignes) {
        const bucket = byKey.get(ligne.raw_label_key)
        if (bucket) bucket.push(ligne)
        else byKey.set(ligne.raw_label_key, [ligne])
    }

    return [...byKey.entries()]
        .map(([key, bucket]) => buildGroup(key, bucket))
        .sort((a, b) => {
            const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state]
            if (byState !== 0) return byState
            const byPackages = b.totalPackages - a.totalPackages
            if (byPackages !== 0) return byPackages
            if (a.state === "unmatched") {
                const byConfidence = (a.confidence ?? 0) - (b.confidence ?? 0)
                if (byConfidence !== 0) return byConfidence
            }
            return a.rawLabel.localeCompare(b.rawLabel)
        })
}

/** Ordre de la strate à classer. `risque` est celui de `groupLignes`. */
export type PackingSort = "risque" | "libelle"

/**
 * Sous-ensemble affiché de la strate : recherche par libellé et ordre.
 *
 * L'ordre par défaut (colis décroissants, puis confiance) est le bon pour
 * ARBITRER LE RISQUE, et le pire pour traiter une famille de libellés : les six
 * « … JACKET » d'un conteneur sont dispersés dans soixante-dix cartes. Trier par
 * libellé les rapproche sans jamais rien décider — un regroupement peut
 * ordonner, il ne retient pas une catégorie.
 *
 * La recherche passe par le normaliseur, pour que « tshirt » trouve
 * « T-SHIRT » et « jkt » trouve « JACKET ». Quand la saisie ne survit pas à la
 * normalisation (un jeton sans valeur discriminante, « a » par exemple), on
 * retombe sur une comparaison brute plutôt que de laisser un filtre inerte.
 */
export function filterGroups(
    groups: readonly PackingGroup[],
    { query, sort }: { query: string; sort: PackingSort },
): PackingGroup[] {
    const raw = query.trim().toLowerCase()
    const normalized = normalizePackingLabel(query)
    const needle = normalized !== "" ? normalized : raw

    const filtered =
        needle === ""
            ? [...groups]
            : groups.filter(
                  (group) =>
                      group.key.includes(needle) ||
                      group.rawLabel.toLowerCase().includes(needle) ||
                      normalizePackingLabel(group.rawLabel).includes(needle),
              )

    if (sort === "libelle") {
        // L'ordre ENTRE strates ne bouge pas : ce sont elles qui portent le
        // sens de l'écran, le tri ne joue qu'à l'intérieur.
        filtered.sort(
            (a, b) =>
                STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.rawLabel.localeCompare(b.rawLabel),
        )
    }

    return filtered
}

export interface PackingReviewProgress {
    groupCount: number
    /** Groupes restant à classer : ce qui reste réellement à faire. */
    unmatchedGroups: number
    /** Groupes reconnus par le dictionnaire, donc dispensés de relecture. */
    dictionaryGroups: number
    /** Groupes classés seuls par le modèle. */
    modelGroups: number
    /** Groupes tranchés par un humain sur cette packing. */
    reviewedGroups: number
    unmatchedLines: number
    /** Vrai quand la base acceptera `validate_packing_list`. */
    canValidate: boolean
}

export function reviewProgress(groups: readonly PackingGroup[]): PackingReviewProgress {
    const unmatchedLines = groups.reduce(
        (sum, g) => sum + g.lignes.filter((l) => l.category_id === null).length,
        0,
    )
    return {
        groupCount: groups.length,
        unmatchedGroups: groups.filter((g) => g.state === "unmatched").length,
        dictionaryGroups: groups.filter((g) => g.state === "dictionary").length,
        modelGroups: groups.filter((g) => g.state === "model").length,
        reviewedGroups: groups.filter((g) => g.state === "reviewed").length,
        unmatchedLines,
        canValidate: groups.length > 0 && unmatchedLines === 0,
    }
}

/**
 * Catégories utilisées le plus récemment dans CETTE session de classement, de
 * la plus récente à la plus ancienne.
 *
 * Aucun état n'est tenu pour ça : l'information est déjà dans les groupes
 * tranchés à la main (`reviewed_at`, posé à chaque décision). Elle survit donc
 * gratuitement à la fermeture de la sheet et redevient juste après une
 * annulation, sans une ligne de synchronisation.
 *
 * Volontairement bornée au conteneur en cours, et NON persistée : le
 * fournisseur suivant a un autre vocabulaire, et remonter « Blouson » parce
 * qu'il a servi la semaine dernière serait du bruit présenté comme une aide. La
 * mémoire entre conteneurs a déjà son mécanisme, exact et auditable — le
 * tableau de correspondance.
 */
export function recentCategories(groups: readonly PackingGroup[], limit = 5): string[] {
    const latest = new Map<string, string>()

    for (const group of groups) {
        // Un groupe mixte n'a pas de catégorie unique : il ne dit rien du choix
        // qu'on vient de faire.
        if (group.state !== "reviewed" || group.categoryId === null) continue
        const at = group.lignes.reduce(
            (max, ligne) => (ligne.reviewed_at && ligne.reviewed_at > max ? ligne.reviewed_at : max),
            "",
        )
        const known = latest.get(group.categoryId)
        if (known === undefined || at > known) latest.set(group.categoryId, at)
    }

    return [...latest.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .slice(0, limit)
        .map(([categoryId]) => categoryId)
}

export interface PackingCategoryGroup {
    categoryId: string | null
    lignes: PackingListLigne[]
    /** Libellés bruts distincts rangés sous cette catégorie : la traçabilité. */
    rawLabels: string[]
    totalPackages: number
    totalPieces: number
    totalWeightKg: number
}

/** Vue d'une packing validée : par catégorie retenue, du plus gros lot au plus petit. */
export function groupByCategory(lignes: readonly PackingListLigne[]): PackingCategoryGroup[] {
    const byCategory = new Map<string | null, PackingListLigne[]>()
    for (const ligne of lignes) {
        const bucket = byCategory.get(ligne.category_id)
        if (bucket) bucket.push(ligne)
        else byCategory.set(ligne.category_id, [ligne])
    }

    return [...byCategory.entries()]
        .map(([categoryId, bucket]) => ({
            categoryId,
            lignes: bucket,
            rawLabels: [...new Set(bucket.map((l) => l.raw_label))],
            totalPackages: sumBy(bucket, (l) => l.package_count),
            totalPieces: sumBy(bucket, (l) => (l.unit_kind === "pcs" ? ligneTotal(l) : null)),
            totalWeightKg: sumBy(bucket, (l) => (l.unit_kind === "kgs" ? ligneTotal(l) : null)),
        }))
        .sort((a, b) => b.totalPackages - a.totalPackages)
}

function relativeGapExceeds(declared: number, gap: number): boolean {
    if (gap === 0) return false
    // Déclaré à zéro : tout écart est une divergence, il n'y a pas de base
    // relative à laquelle le rapporter.
    if (declared === 0) return true
    return Math.abs(gap) / Math.abs(declared) > PACKING_GAP_TOLERANCE
}

/**
 * Écart entre les totaux SAISIS sur l'arrivage et ceux de la packing list.
 * Positif : la packing en contient plus que ce qui a été déclaré.
 *
 * La « Quantité » de l'arrivage est un nombre de COLIS : on la compare à
 * `total_packages`. Le poids ne se compare que si la packing en porte
 * réellement — sur un document en pièces, `total_weight_kg` vaut 0 et ce
 * zéro ne veut pas dire « zéro kilo », il veut dire « non renseigné ».
 *
 * `null` quand la comparaison n'a pas de sens : pas de packing, packing vide,
 * ou aucun total saisi sur l'arrivage. Une donnée absente n'est pas un écart.
 */
export function packingGap(
    row: Pick<ArrivageManuelRow, "total_weight_kg" | "total_qty">,
    summary: PackingListSummary | null | undefined,
): PackingGap | null {
    if (!summary || summary.line_count === 0) return null

    const packages = row.total_qty === null ? null : summary.total_packages - row.total_qty
    const weightKg =
        row.total_weight_kg === null || summary.total_weight_kg === 0
            ? null
            : summary.total_weight_kg - row.total_weight_kg

    if (packages === null && weightKg === null) return null

    return {
        packages,
        weightKg,
        diverges:
            (packages !== null && relativeGapExceeds(row.total_qty ?? 0, packages)) ||
            (weightKg !== null && relativeGapExceeds(row.total_weight_kg ?? 0, weightKg)),
    }
}

/**
 * Le fichier se recoupe-t-il lui-même ? Somme des colis lus contre total que
 * le fournisseur annonce en pied de page.
 *
 * C'est le contrôle qui dispense l'utilisateur de vérifier les nombres de 180
 * lignes : s'il passe, l'arithmétique du document est saine et il ne reste
 * qu'à arbitrer les catégories. Sur les deux packings réelles, il échoue une
 * fois sur deux (GR153 : 543 contre 548 ; GR154 : 553 = 553).
 *
 * `null` quand le fichier n'annonce aucun total : rien à contrôler.
 */
export function packingFileIntegrity(summary: PackingListSummary | null | undefined): {
    packageCountGap: number
    rowsFailingMath: number
    sound: boolean
} | null {
    if (!summary || summary.line_count === 0) return null
    if (summary.package_count_gap === null && summary.rows_failing_math === 0) return null

    const packageCountGap = summary.package_count_gap ?? 0
    return {
        packageCountGap,
        rowsFailingMath: summary.rows_failing_math,
        sound: packageCountGap === 0 && summary.rows_failing_math === 0,
    }
}
