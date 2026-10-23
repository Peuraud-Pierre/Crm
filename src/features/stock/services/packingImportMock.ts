// ── services/packingImportMock.ts ─────────────────────────────────────────────
// Faux import de packing list, pour le DÉVELOPPEMENT uniquement.
//
// Il simule le contrat de `packing-api` (voir `packingImportService.ts`) dans
// le navigateur, pour que le parcours complet — dépôt, vérification,
// validation — soit jouable sans lancer le service. Il n'est chargé que par import dynamique,
// quand `isPackingImportMocked()` est vrai : c'est ce qui garde
// `xlsx-js-style` hors du bundle de production.
//
// Ce qu'il fait, et que le service fait à l'identique :
//   1. lire le classeur          → `utils/packingDocument.ts`, testé sur les
//                                  deux vraies packings (le corpus doré) ;
//   2. consulter le dictionnaire → `packingLabelDictionaryService.ts` ;
//   3. écrire l'en-tête et les lignes avec le JWT de l'utilisateur.
//
// Ce qu'il ne fait PAS : le modèle appris. La seule chose qui reste naïve ici,
// et qui n'engage rien, est la SUGGESTION par similarité de libellé : elle n'écrit jamais `category_id`, seulement
// `suggested_category_id` + `match_confidence`. Mesuré sur GR153/GR154, un
// rapprochement flou à recall utile intervertit les marques (« BRAND FEATHER
// JACKET » → NF FEATHER JACKET) à confiance 0,72-0,84 ; il peut donc proposer,
// jamais retenir. Seule une correspondance EXACTE du dictionnaire retient.

import XLSX from "xlsx-js-style"
import { fetchCategories } from "@/features/stock/services/categorieService"
import { fetchMappingsForKeys } from "@/features/stock/services/packingLabelDictionaryService"
import { PACKING_TABLES, supabasePacking } from "@/features/stock/services/packingListService"
import { PACKING_NORMALIZER_VERSION, normalizePackingLabel } from "@/features/stock/utils/packingGrouping"
import {
    fromWorksheet,
    PackingParseError,
    parsePackingDocument,
    type RawWorksheet,
} from "@/features/stock/utils/packingDocument"
import type { PackingImportResult } from "@/features/stock/types/packing-list.types"
import { PackingImportError } from "./packingImportService"

/** Proportion de mots du libellé retrouvés dans le nom de la catégorie. */
function similarity(rawKey: string, categoryKey: string): number {
    if (rawKey === categoryKey) return 1
    const rawTokens = rawKey.split(" ").filter(Boolean)
    const catTokens = categoryKey.split(" ").filter(Boolean)
    if (rawTokens.length === 0 || catTokens.length === 0) return 0
    const hits = rawTokens.filter((t) =>
        catTokens.some((c) => c.startsWith(t.slice(0, 3)) || t.startsWith(c.slice(0, 3))),
    ).length
    return hits / Math.max(rawTokens.length, catTokens.length)
}

/** En deçà, on ne propose rien : une suggestion trop faible coûte plus qu'elle ne rend. */
const SUGGESTION_FLOOR = 0.3

export async function mockImportPackingList(
    file: File,
    arrivageManuelId: string,
): Promise<PackingImportResult> {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
    if (!sheet) throw new PackingImportError("Le fichier ne contient aucune feuille.", 422)

    let document
    try {
        document = parsePackingDocument(
            fromWorksheet(sheetName, sheet as unknown as RawWorksheet),
        )
    } catch (error) {
        // 422 : le fichier est lisible mais n'a pas la forme attendue. Le
        // message du parseur dit précisément ce qui manque.
        if (error instanceof PackingParseError) throw new PackingImportError(error.message, 422)
        throw error
    }

    const categories = (await fetchCategories()).map((c) => ({
        id: c.id,
        key: normalizePackingLabel(c.name),
    }))
    const dictionary = await fetchMappingsForKeys(document.lines.map((l) => l.rawLabelKey))

    const { data: header, error: headerError } = await supabasePacking
        .from(PACKING_TABLES.header)
        .insert({
            arrivage_manuel_id: arrivageManuelId,
            status: "en_traitement",
            source_filename: file.name,
            source_sheet: document.sheetName,
            container_label: document.containerLabel,
            declared_package_count: document.declaredPackageCount,
        })
        .select("id")
        .single()

    if (headerError) {
        // 23505 : contrainte UNIQUE sur arrivage_manuel_id.
        if (headerError.code === "23505") throw new PackingImportError("Cet arrivage a déjà une packing list.", 409)
        throw headerError
    }

    const lignes = document.lines.map((line) => {
        const known = dictionary.get(line.rawLabelKey)

        let best: { id: string; score: number } | null = null
        for (const category of categories) {
            const score = similarity(line.rawLabelKey, category.key)
            if (score > (best?.score ?? 0)) best = { id: category.id, score }
        }
        const suggested = best && best.score >= SUGGESTION_FLOOR ? best : null

        return {
            packing_list_id: header.id,
            position: line.position,
            source_row: line.sourceRow,
            raw_label: line.rawLabel,
            raw_label_key: line.rawLabelKey,
            raw_row: line.rawRow,
            package_count: line.packageCount,
            units_per_package: line.unitsPerPackage,
            unit_kind: line.unitKind,
            declared_total: line.declaredTotal,
            normalizer_version: PACKING_NORMALIZER_VERSION,
            // La proposition, quelle que soit sa provenance, reste affichée à
            // côté du libellé brut : c'est ce qui rend une erreur visible.
            suggested_category_id: known?.category_id ?? suggested?.id ?? null,
            match_confidence: known ? 1 : suggested ? Math.round(suggested.score * 100) / 100 : null,
            suggestion_source: known ? "dictionary" : suggested ? "name" : null,
            // Seul le dictionnaire retient une catégorie. Tout le reste part
            // sans `category_id`, donc bloque la validation jusqu'à ce qu'un
            // humain tranche.
            category_id: known?.category_id ?? null,
            resolution: known ? "dictionary" : null,
        }
    })

    const { error: lignesError } = await supabasePacking.from(PACKING_TABLES.lignes).insert(lignes)
    const status = lignesError ? "echec" : "a_verifier"

    await supabasePacking
        .from(PACKING_TABLES.header)
        .update({
            status,
            error_message: lignesError ? `Écriture des lignes impossible : ${lignesError.message}` : null,
        })
        .eq("id", header.id)

    return { packing_list_id: header.id, status }
}
