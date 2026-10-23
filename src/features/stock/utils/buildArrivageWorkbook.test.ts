import { expect, test } from "@rstest/core"
import XLSX from "xlsx-js-style"
import { buildArrivageWorkbook } from "@/features/stock/utils/buildArrivageWorkbook"
import {
    CELL_FILLS,
    COLUMN_DEFS,
    PAST_CELL_FILLS,
    SCHEDULED_CELL_FILL,
    SCHEDULED_DATE_FONT_COLOR,
} from "@/features/stock/utils/arrivageExportColumns"
import {
    filterArrivagesByRange,
    groupByMonth,
    isArrivagePast,
    monthBannerLabel,
} from "@/features/stock/utils/arrivageGrouping"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"

function makeRow(overrides: Partial<ArrivageManuelRow> = {}): ArrivageManuelRow {
    return {
        id: "a1",
        container_no: "ABCD1234567",
        conteneur_no_raw: null,
        fournisseur_id: "f1",
        status: "reçu",
        status_auto: false,
        transport_mode: "40'",
        departure_date: null,
        port_arrival_date: null,
        total_weight_kg: 1000,
        total_qty: 10,
        prev_dechargement_at: "2026-08-10T08:00:00.000Z",
        notes: null,
        invoice_date: null,
        created_at: "2026-08-01T08:00:00.000Z",
        updated_at: "2026-08-01T08:00:00.000Z",
        ...overrides,
    }
}

/** Numéro de la première ligne (1-based, comme Excel) dont une cellule vaut `value`. */
function rowOf(ws: XLSX.WorkSheet, predicate: (v: string) => boolean): number {
    const range = XLSX.utils.decode_range(ws["!ref"] as string)
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })]
            if (cell && typeof cell.v === "string" && predicate(cell.v)) return r
        }
    }
    return -1
}

test("la bannière de mois ouvre son bloc, le total le referme", () => {
    const rows = [
        makeRow({ id: "a1", container_no: "AOUT0000001", prev_dechargement_at: "2026-08-10T08:00:00.000Z" }),
        makeRow({ id: "a2", container_no: "AOUT0000002", prev_dechargement_at: "2026-08-20T08:00:00.000Z" }),
        makeRow({ id: "a3", container_no: "JUIL0000001", prev_dechargement_at: "2026-07-15T08:00:00.000Z" }),
    ]

    const wb = buildArrivageWorkbook(rows, COLUMN_DEFS)
    const ws = wb.Sheets["Arrivages"]

    const banner = rowOf(ws, v => v.startsWith("AOÛT 2026 ·"))
    const first  = rowOf(ws, v => v === "AOUT0000001")
    const total  = rowOf(ws, v => v.startsWith("↳ Total Août 2026"))

    expect(banner).toBeGreaterThan(0)
    expect(banner).toBeLessThan(first)
    expect(first).toBeLessThan(total)

    // Le mois suivant s'ouvre après le total du précédent — pas de libellé orphelin.
    const nextBanner = rowOf(ws, v => v.startsWith("JUILLET 2026 ·"))
    expect(nextBanner).toBeGreaterThan(total)
})

test("la bannière annonce le nombre d'arrivages du mois", () => {
    const groups = groupByMonth([
        makeRow({ id: "a1", prev_dechargement_at: "2026-08-10T08:00:00.000Z", total_weight_kg: 1000 }),
        makeRow({ id: "a2", prev_dechargement_at: "2026-08-20T08:00:00.000Z", total_weight_kg: 500 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].rows).toHaveLength(2)
    expect(groups[0].totalWeight).toBe(1500)
})

test("le filtre par période inclut les bornes et ancre les lignes sans date sur leur création", () => {
    const rows = [
        makeRow({ id: "in-start",  prev_dechargement_at: "2026-08-01T00:30:00.000Z" }),
        makeRow({ id: "in-end",    prev_dechargement_at: "2026-08-31T12:00:00.000Z" }),
        makeRow({ id: "out",       prev_dechargement_at: "2026-09-02T08:00:00.000Z" }),
        makeRow({ id: "undated",   prev_dechargement_at: null, port_arrival_date: null, departure_date: null }),
    ]

    // Les bornes sont interprétées en heure locale : "in-end" est un 31 août local.
    // "undated" n'a aucune date d'arrivage mais a été créé le 01/08 : il est
    // retenu sur cet ancrage, sinon il disparaîtrait d'un export sur période
    // alors qu'il figure dans l'export complet.
    const kept = filterArrivagesByRange(rows, new Date(2026, 7, 1), new Date(2026, 7, 31))
    expect(kept.map(r => r.id)).toEqual(["in-start", "in-end", "undated"])
})

// ─── Tri intra-mois ───────────────────────────────────────────────────────────

test("les lignes d'un mois sont triées par date de déchargement, pas par création", () => {
    // "tard" est créé APRÈS "tot" mais se décharge plus tard : la requête les
    // renvoie en created_at DESC (tard, tot) alors que le classeur doit les
    // ordonner par déchargement décroissant (tard en premier ici aussi) —
    // le cas discriminant est l'inverse, testé juste en dessous.
    const groups = groupByMonth([
        makeRow({ id: "tot",  container_no: "TOT", prev_dechargement_at: "2026-08-05T08:00:00.000Z", created_at: "2026-07-30T08:00:00.000Z" }),
        makeRow({ id: "tard", container_no: "TARD", prev_dechargement_at: "2026-08-25T08:00:00.000Z", created_at: "2026-07-01T08:00:00.000Z" }),
    ])

    expect(groups[0].rows.map(r => r.id)).toEqual(["tard", "tot"])
})

test("déplacer une date de déchargement remonte la ligne dans son bloc", () => {
    const base = [
        makeRow({ id: "a", container_no: "AAAA0000001", prev_dechargement_at: "2026-08-25T08:00:00.000Z", created_at: "2026-07-01T08:00:00.000Z" }),
        makeRow({ id: "b", container_no: "BBBB0000001", prev_dechargement_at: "2026-08-05T08:00:00.000Z", created_at: "2026-07-02T08:00:00.000Z" }),
    ]
    const wsAvant = buildArrivageWorkbook(base, COLUMN_DEFS).Sheets["Arrivages"]
    expect(rowOf(wsAvant, v => v === "AAAA0000001")).toBeLessThan(rowOf(wsAvant, v => v === "BBBB0000001"))

    // B est repoussé après A : l'ordre du classeur doit suivre.
    const apres = base.map(r => r.id === "b" ? { ...r, prev_dechargement_at: "2026-08-28T08:00:00.000Z" } : r)
    const wsApres = buildArrivageWorkbook(apres, COLUMN_DEFS).Sheets["Arrivages"]
    expect(rowOf(wsApres, v => v === "BBBB0000001")).toBeLessThan(rowOf(wsApres, v => v === "AAAA0000001"))
})

// ─── Passé / à venir ──────────────────────────────────────────────────────────

const NOW = new Date(2026, 7, 15, 10, 0, 0) // 15 août 2026, 10h — heure locale

test("passé = déchargement antérieur au début du jour courant", () => {
    const hier    = makeRow({ id: "hier",    prev_dechargement_at: "2026-08-14T08:00:00.000Z" })
    const ceMatin = makeRow({ id: "matin",   prev_dechargement_at: "2026-08-15T06:00:00.000Z" })
    const demain  = makeRow({ id: "demain",  prev_dechargement_at: "2026-08-16T08:00:00.000Z" })
    const sansDate = makeRow({ id: "sans", prev_dechargement_at: null, port_arrival_date: null, departure_date: null })

    expect(isArrivagePast(hier, NOW)).toBe(true)
    // Un arrivage prévu aujourd'hui, même passé de quelques heures, reste « à venir ».
    expect(isArrivagePast(ceMatin, NOW)).toBe(false)
    expect(isArrivagePast(demain, NOW)).toBe(false)
    // Sans date planifiée, l'échéance est indéterminée — pas « passé ».
    expect(isArrivagePast(sansDate, NOW)).toBe(false)
})

test("les lignes passées sont grisées et italiques, les lignes à venir non", () => {
    const rows = [
        makeRow({ id: "futur", container_no: "FUTUR000001", prev_dechargement_at: "2026-08-25T08:00:00.000Z" }),
        makeRow({ id: "passe", container_no: "PASSE000001", prev_dechargement_at: "2026-08-05T08:00:00.000Z" }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]

    const cellAt = (r: number, header: string) => {
        const c = COLUMN_DEFS.findIndex(col => col.header === header)
        return ws[XLSX.utils.encode_cell({ r, c })]
    }

    const rFutur = rowOf(ws, v => v === "FUTUR000001")
    const rPasse = rowOf(ws, v => v === "PASSE000001")

    const futurStatut = cellAt(rFutur, "Statut")
    const passeStatut = cellAt(rPasse, "Statut")
    expect(passeStatut.s.font.italic).toBe(true)
    // "passe" est la 2e ligne du bloc — la palette du passé alterne comme les autres.
    expect(PAST_CELL_FILLS).toContain(passeStatut.s.fill.fgColor.rgb)
    expect(futurStatut.s.font.italic).toBeFalsy()
    // La ligne à venir a un déchargement programmé : elle est en jaune, pas en blanc.
    expect(futurStatut.s.fill.fgColor.rgb).toBe(SCHEDULED_CELL_FILL)

    // Colonne Déchargement : la date passée est barrée, la date à venir en gras.
    const futurDech = cellAt(rFutur, "Déchargement")
    const passeDech = cellAt(rPasse, "Déchargement")
    expect(futurDech.s.font.bold).toBe(true)
    expect(PAST_CELL_FILLS).toContain(passeDech.s.fill.fgColor.rgb)
    expect(passeDech.s.font.strike).toBe(true)
})

test("la bannière de mois annonce ce qui reste à venir", () => {
    const mixte = groupByMonth([
        makeRow({ id: "f", prev_dechargement_at: "2026-08-25T08:00:00.000Z" }),
        makeRow({ id: "p", prev_dechargement_at: "2026-08-05T08:00:00.000Z" }),
    ], NOW)
    expect(monthBannerLabel(mixte[0])).toBe("AOÛT 2026 · 2 arrivages · 1 à venir")

    const revolu = groupByMonth([
        makeRow({ id: "p1", prev_dechargement_at: "2026-07-05T08:00:00.000Z" }),
        makeRow({ id: "p2", prev_dechargement_at: "2026-07-06T08:00:00.000Z" }),
    ], NOW)
    expect(monthBannerLabel(revolu[0])).toBe("JUILLET 2026 · 2 arrivages · passés")

    // Une ligne sans date d'arrivage est classée sur sa création (01/08) : le
    // bloc n'a aucune échéance à annoncer, donc pas de suffixe.
    const sansDate = groupByMonth([
        makeRow({ id: "s", prev_dechargement_at: null, port_arrival_date: null, departure_date: null }),
    ], NOW)
    expect(monthBannerLabel(sansDate[0])).toBe("AOÛT 2026 · 1 arrivage")
})

// ─── Arrivages en route ───────────────────────────────────────────────────────

test("un déchargement programmé allume la ligne entière en jaune", () => {
    const rows = [
        makeRow({
            id: "route", container_no: "ROUTE000001", invoice_date: "2026-07-10",
            departure_date: "2026-08-01", port_arrival_date: "2026-08-20",
            prev_dechargement_at: "2026-08-25T08:00:00.000Z",
        }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const r = rowOf(ws, v => v === "ROUTE000001")
    const cellAt = (header: string) =>
        ws[XLSX.utils.encode_cell({ r, c: COLUMN_DEFS.findIndex(col => col.header === header) })]

    // Toute la ligne, colonnes de dates comprises — y compris la colonne
    // Déchargement, dont le bleu d'emphase cède le pas.
    for (const header of ["Statut", "Fournisseur", "Départ", "Le Havre", "Déchargement", "Notes"]) {
        expect(cellAt(header).s.fill.fgColor.rgb).toBe(SCHEDULED_CELL_FILL)
    }
})

test("sans date de déchargement, la ligne reste neutre", () => {
    const rows = [
        makeRow({
            id: "sansdech", container_no: "SANSD000001", invoice_date: "2026-07-10",
            departure_date: "2026-08-01", port_arrival_date: "2026-08-20",
            prev_dechargement_at: null,
        }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const r = rowOf(ws, v => v === "SANSD000001")
    const depart = ws[XLSX.utils.encode_cell({ r, c: COLUMN_DEFS.findIndex(c => c.header === "Départ") })]
    expect(depart.s.fill.fgColor.rgb).toBe("FFFFFF")
})

test("la facture manquante prime sur l'arrivage en route", () => {
    // Déchargement dans 3 jours, aucune facture : l'incident colore toute la ligne.
    const rows = [
        makeRow({
            id: "alerte", container_no: "ALERT000001", invoice_date: null,
            departure_date: "2026-08-01", port_arrival_date: "2026-08-10",
            prev_dechargement_at: "2026-08-18T08:00:00.000Z",
        }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const r = rowOf(ws, v => v === "ALERT000001")
    const cellAt = (header: string) =>
        ws[XLSX.utils.encode_cell({ r, c: COLUMN_DEFS.findIndex(col => col.header === header) })]

    expect(CELL_FILLS.alert).toContain(cellAt("Fournisseur").s.fill.fgColor.rgb)
    expect(CELL_FILLS.alert).toContain(cellAt("Déchargement").s.fill.fgColor.rgb)
})

// ─── Alignement avec la newsletter ────────────────────────────────────────────

test("le classeur porte une feuille Légende, comme la newsletter", () => {
    const wb = buildArrivageWorkbook([makeRow()], COLUMN_DEFS, NOW)
    expect(wb.SheetNames).toEqual(["Arrivages", "Légende"])
})

test("le total du mois sépare les milliers par une espace simple", () => {
    const wb = buildArrivageWorkbook([makeRow({ total_weight_kg: 18500 })], COLUMN_DEFS, NOW)
    const ws = wb.Sheets["Arrivages"]
    const total = rowOf(ws, v => v.startsWith("↳ Total"))
    const c = COLUMN_DEFS.findIndex(col => col.header === "Poids (kg)")
    // Espace U+0020, comme fmtWeight côté Go — pas l'espace fine de toLocaleString.
    expect(ws[XLSX.utils.encode_cell({ r: total, c })].v).toBe("18 500 kg")
})

test("l'heure de déchargement est celle de Paris, pas celle du navigateur", () => {
    const wb = buildArrivageWorkbook(
        [makeRow({ prev_dechargement_at: "2026-08-22T09:30:00.000Z" })], COLUMN_DEFS, NOW)
    const ws = wb.Sheets["Arrivages"]
    const r = rowOf(ws, v => v.startsWith("Samedi"))
    const c = COLUMN_DEFS.findIndex(col => col.header === "Déchargement")
    // 09:30 UTC = 11:30 à Paris en août (CEST).
    expect(ws[XLSX.utils.encode_cell({ r, c })].v).toBe("Samedi 22/08/26 · 11:30")
})

test("sur une ligne en route, seule la date de déchargement est en rouge", () => {
    const rows = [
        makeRow({
            id: "route", container_no: "ROUGE000001", invoice_date: "2026-07-10",
            departure_date: "2026-08-01", port_arrival_date: "2026-08-20",
            prev_dechargement_at: "2026-08-25T08:00:00.000Z",
        }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const r = rowOf(ws, v => v === "ROUGE000001")
    const cellAt = (header: string) =>
        ws[XLSX.utils.encode_cell({ r, c: COLUMN_DEFS.findIndex(col => col.header === header) })]

    const dech = cellAt("Déchargement").s.font
    expect(dech.color.rgb).toBe(SCHEDULED_DATE_FONT_COLOR)
    // Le rouge sur jaune plafonne près du seuil AA : l'emphase est portée par
    // des indices non chromatiques — gras, un point plus grand, souligné.
    expect(dech.bold).toBe(true)
    expect(dech.sz).toBe(11)
    expect(dech.underline).toBe(true)

    // Le reste de la ligne, dates comprises, garde le quasi-noir en taille 10
    // sans soulignement : le renfort ne vise que la date à retenir.
    for (const header of ["Statut", "Départ", "Le Havre", "Notes"]) {
        const f = cellAt(header).s.font
        expect(f.color.rgb).toBe("111827")
        expect(f.sz).toBe(10)
        expect(f.underline).toBeFalsy()
    }
})

test("le rouge ne s'applique qu'aux lignes en route", () => {
    const rows = [
        // Déchargement passé : la date est grisée et barrée, pas rouge.
        makeRow({ id: "p", container_no: "PASSE000002", invoice_date: "2026-07-10",
                  prev_dechargement_at: "2026-08-05T08:00:00.000Z" }),
        // Sans date de déchargement : ligne neutre, rien de rouge.
        makeRow({ id: "n", container_no: "NEUTRE00001", invoice_date: "2026-07-10",
                  prev_dechargement_at: null, departure_date: "2026-08-03" }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const c = COLUMN_DEFS.findIndex(col => col.header === "Déchargement")

    for (const container of ["PASSE000002", "NEUTRE00001"]) {
        const cell = ws[XLSX.utils.encode_cell({ r: rowOf(ws, v => v === container), c })]
        expect(cell.s.font.color.rgb).not.toBe(SCHEDULED_DATE_FONT_COLOR)
        // Ni le grossissement ni le soulignement ne débordent hors de l'état « en route ».
        expect(cell.s.font.sz).toBe(10)
        expect(cell.s.font.underline).toBeFalsy()
    }
})

// ─── Arrivages sans date ──────────────────────────────────────────────────────

test("une ligne sans date est intercalée à sa date de création, pas reléguée en bas", () => {
    // Sans date d'arrivage, créée le 12/08 : elle doit tomber dans le bloc d'août,
    // entre le déchargement du 25 et celui du 05 — et non dans un bloc "Sans date"
    // épinglé en fin de fichier, où plus personne ne la voit.
    const rows = [
        makeRow({ id: "tard", container_no: "TARD0000001", prev_dechargement_at: "2026-08-25T08:00:00.000Z" }),
        makeRow({
            id: "sans", container_no: "SANS0000001",
            prev_dechargement_at: null, port_arrival_date: null, departure_date: null,
            created_at: "2026-08-12T08:00:00.000Z",
        }),
        makeRow({ id: "tot", container_no: "TOT00000001", prev_dechargement_at: "2026-08-05T08:00:00.000Z" }),
    ]

    const groups = groupByMonth(rows, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Août 2026")
    expect(groups[0].rows.map(r => r.id)).toEqual(["tard", "sans", "tot"])

    // Elle n'est comptée ni comme à venir ni comme passée : son échéance est inconnue.
    expect(groups[0].datedCount).toBe(2)
    expect(monthBannerLabel(groups[0])).toBe("AOÛT 2026 · 3 arrivages · 1 à venir")
})

test("une ligne sans date reste neutre : ni jaune, ni grisée", () => {
    const rows = [
        makeRow({
            id: "sans", container_no: "SANS0000001", invoice_date: "2026-07-10",
            prev_dechargement_at: null, port_arrival_date: null, departure_date: null,
            created_at: "2026-01-05T08:00:00.000Z",
        }),
    ]
    const ws = buildArrivageWorkbook(rows, COLUMN_DEFS, NOW).Sheets["Arrivages"]
    const r = rowOf(ws, v => v === "SANS0000001")
    const c = COLUMN_DEFS.findIndex(col => col.header === "Statut")
    // Créée il y a des mois, mais sans date d'arrivage : pas de gris « passé »,
    // l'échéance est indéterminée et non dépassée.
    expect(ws[XLSX.utils.encode_cell({ r, c })].s.fill.fgColor.rgb).toBe("FFFFFF")
})
