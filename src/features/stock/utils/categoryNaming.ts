/**
 * Forme canonique d'une catégorie : son nom et son tag.
 *
 * Pur, sans React ni Supabase — l'algorithme se teste en table.
 *
 * Pourquoi le tag ne peut pas être laissé vide
 * --------------------------------------------
 * Le BIN d'une balle est construit avec `category.tag.substring(0, 4)`
 * (`LivraisonCreationSheet.tsx`). Une catégorie créée sans tag produit donc un
 * segment de référence VIDE, et une catégorie dont le tag est NULL en base fait
 * carrément lever cette ligne. D'où deux règles qui ne sont pas cosmétiques :
 *
 *  - un tag fait TOUJOURS 4 caractères ;
 *  - une variante de collision reste DANS ces 4 caractères. Un suffixe en 5ᵉ
 *    position serait invisible pour le BIN, et deux balles partageraient
 *    silencieusement la même référence.
 *
 * Ne pas confondre avec `normalizePackingLabel` (`packingGrouping.ts`), qui
 * normalise les libellés du FOURNISSEUR : celui-là singularise et retire des
 * jetons parasites pour reconnaître deux écritures d'un même article, et doit
 * rester l'exact miroir de `normalize_packing_label` en base. Ici on met en
 * forme un nom saisi par un humain, ce qui n'a ni les mêmes règles ni le même
 * arbitre.
 */

/** Longueur d'un tag. C'est ce que le BIN lit, pas une préférence d'affichage. */
export const CATEGORY_TAG_LENGTH = 4

/**
 * Mots qui ne discriminent rien dans un nom de catégorie. `À` a déjà été replié
 * en `A` et les apostrophes en espaces quand ce filtre s'applique, d'où `D` et
 * `L` seuls (pour « d'hiver », « l'ensemble »).
 */
const LIAISON_WORDS = new Set([
    "A", "AU", "AUX", "DE", "DU", "DES", "EN", "ET",
    "LA", "LE", "LES", "D", "L", "POUR", "SUR", "AVEC",
])

/** Base de repli quand un nom ne porte aucune lettre ni chiffre exploitable. */
const FALLBACK_BASE = "CAT"

/** Caractère de remplissage. Alphabétique À DESSEIN : voir `buildCategoryTag`. */
const PAD_CHAR = "X"

function foldAccents(value: string): string {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

/**
 * Forme stockée d'un nom de catégorie : majuscules, espaces internes réduits.
 *
 * Les accents sont CONSERVÉS — c'est du texte destiné à être lu
 * (« VÊTEMENTS D'HIVER »). Ils ne sont repliés que pour fabriquer le tag.
 */
export function normalizeCategoryName(raw: string): string {
    return raw.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR")
}

/**
 * Clé de comparaison de deux noms de catégorie.
 *
 * Identique à `normalizeCategoryName` : la casse et les espaces surnuméraires
 * ne distinguent pas deux catégories, le reste si. En particulier les accents
 * ne sont PAS repliés — « pêche » et « peche » sont deux mots français
 * différents, les fusionner en silence serait une perte d'information.
 */
export function categoryNameKey(name: string): string {
    return normalizeCategoryName(name)
}

/** Forme stockée d'un tag saisi à la main. */
export function normalizeCategoryTag(raw: string | null | undefined): string {
    if (!raw) return ""
    return foldAccents(raw)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 8)
}

/**
 * Clé de collision d'un tag : les 4 premiers caractères, seuls lus par le BIN.
 *
 * Un tag historique plus long ou en minuscules bloque donc bien une nouvelle
 * catégorie dont le tag généré commencerait pareil.
 */
export function tagKey(tag: string | null | undefined): string {
    return normalizeCategoryTag(tag).slice(0, CATEGORY_TAG_LENGTH)
}

/** Jetons alphanumériques d'un nom, accents repliés, apostrophes coupées. */
function tokenize(name: string): string[] {
    return foldAccents(name)
        .toUpperCase()
        .replace(/['’]/g, " ")
        .split(/[^A-Z0-9]+/)
        .filter((token) => token !== "")
}

/**
 * Base de 4 caractères d'un nom, avant résolution de collision.
 *
 * Deux mots significatifs ou plus → 2 lettres du premier + 2 du deuxième
 * (« JEAN HOMME » → JEHO). Un seul → ses 4 premières lettres (« TSHIRT » →
 * TSHI). Un nom fait uniquement de mots de liaison garde quand même un tag :
 * on retombe alors sur les jetons non filtrés (« de la » → DELA).
 */
function tagBase(name: string): string {
    const tokens = tokenize(name)
    const significant = tokens.filter((token) => !LIAISON_WORDS.has(token))
    const words = significant.length > 0 ? significant : tokens

    let base: string
    if (words.length === 0) base = FALLBACK_BASE
    else if (words.length === 1) base = words[0].slice(0, CATEGORY_TAG_LENGTH)
    else base = words[0].slice(0, 2) + words[1].slice(0, 2)

    return base.padEnd(CATEGORY_TAG_LENGTH, PAD_CHAR)
}

/**
 * Tag dérivé d'un nom, garanti libre parmi `takenTags`.
 *
 * Résolution de collision : la 4ᵉ position devient un chiffre (JEHO pris →
 * JEH2 … JEH9), puis les deux dernières (JE10 … JE99). Le remplissage d'un nom
 * trop court utilise `X` et jamais un chiffre : en lisant un BIN, un chiffre en
 * fin de tag doit vouloir dire « variante de collision », et rien d'autre.
 *
 * Renvoie `null` quand les 99 variantes d'une même base sont prises — l'appelant
 * crée alors la catégorie sans tag plutôt que d'en fabriquer un à 5 caractères,
 * que le BIN tronquerait sans le dire.
 */
export function buildCategoryTag(
    name: string,
    takenTags: Iterable<string | null | undefined>,
): string | null {
    const taken = new Set<string>()
    for (const tag of takenTags) {
        const key = tagKey(tag)
        if (key !== "") taken.add(key)
    }

    const base = tagBase(name)
    if (!taken.has(base)) return base

    for (let digit = 2; digit <= 9; digit++) {
        const candidate = base.slice(0, 3) + String(digit)
        if (!taken.has(candidate)) return candidate
    }

    for (let pair = 10; pair <= 99; pair++) {
        const candidate = base.slice(0, 2) + String(pair)
        if (!taken.has(candidate)) return candidate
    }

    return null
}
