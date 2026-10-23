import { describe, expect, test } from "@rstest/core"
import { buildPackingAdminAlerts, type PackingAlertInput } from "./alerts"
import type {
    PackingImportRow,
    PackingModelStats,
    PackingReplayReport,
    PackingServiceStatus,
} from "@/features/packing-admin/types"

const MODEL: PackingModelStats = {
    examples: 120,
    categories: 18,
    vocabulary: 340,
    dictionary_entries: 47,
    evidence: 60,
    evidence_correct: 59,
    overall_precision: 59 / 60,
    threshold: 0.991,
    precision_at_threshold: 1,
    support_at_threshold: 40,
    target_precision: 0.98,
    min_evidence: 50,
    recent_imports: [],
}

const STATUS: PackingServiceStatus = {
    service: "packing-api",
    version: "2.0.0",
    started_at: "2026-09-21T08:00:00Z",
    uptime_s: 3600,
    normalizer_version: 2,
    config: {
        supabase_url: "https://db.test",
        max_upload_mb: 10,
        allowed_origins: ["http://localhost:8082"],
        log_level: "info",
        log_format: "json",
        guard: { target_precision: 0.98, min_evidence: 50, min_margin: 0.2 },
    },
    model: MODEL,
    counts: { packing_lists: 8, a_verifier: 1, validee: 6, echec: 0, en_traitement: 1 },
}

const REPLAY: PackingReplayReport = {
    settings: { target_precision: 0.98, min_evidence: 50, min_margin: 0.2 },
    simulated: false,
    total_packings: 6,
    returned: 6,
    steps: [],
}

function input(overrides: Partial<PackingAlertInput> = {}): PackingAlertInput {
    return {
        apiConfigured: true,
        reachable: true,
        status: STATUS,
        statusError: null,
        model: MODEL,
        replay: REPLAY,
        imports: [],
        misses: [],
        conflicts: [],
        feedbackTableMissing: false,
        ...overrides,
    }
}

function importRow(overrides: Partial<PackingImportRow> = {}): PackingImportRow {
    return {
        id: "p1",
        arrivage_manuel_id: "a1",
        container_label: "GR153",
        source_filename: "GR153.xlsx",
        status: "validee",
        error_message: null,
        imported_at: "2026-09-20T10:00:00Z",
        imported_by: "user-1",
        lines: { dictionary: 40, model: 20, suggested: 30, none: 7 },
        threshold: 0.99,
        ...overrides,
    }
}

const ids = (alerts: { id: string }[]) => alerts.map((a) => a.id)

describe("quand tout va bien", () => {
    test("aucune alerte — l'absence de bandeau est l'information", () => {
        expect(buildPackingAdminAlerts(input())).toEqual([])
    })
})

describe("le service", () => {
    test("une variable d'environnement manquante n'est PAS une panne du service", () => {
        const alerts = buildPackingAdminAlerts(input({ apiConfigured: false, reachable: false }))
        expect(ids(alerts)).toEqual(["api-unconfigured"])
    })

    test("injoignable : on n'empile pas les symptômes d'une seule panne", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                reachable: false,
                statusError: { message: "boom", status: null },
                model: { ...MODEL, threshold: null },
            }),
        )
        expect(ids(alerts)).toEqual(["api-unreachable"])
    })

    test("un 403 dit LAQUELLE des deux causes regarder", () => {
        const alerts = buildPackingAdminAlerts(
            input({ statusError: { message: "Forbidden", status: 403 } }),
        )
        expect(ids(alerts)).toContain("api-forbidden")
        expect(alerts[0].detail).toContain("MFA")
        expect(alerts[0].detail).toContain("stock.packing.view")
    })

    test("une autre erreur remonte son message, sans le réécrire", () => {
        const alerts = buildPackingAdminAlerts(
            input({ statusError: { message: "Passerelle en vrac", status: 502 } }),
        )
        expect(ids(alerts)).toContain("status-error")
        expect(alerts[0].detail).toBe("Passerelle en vrac")
    })
})

describe("le seuil d'auto-classement", () => {
    test("inactif faute de preuves : le compte exact qui manque", () => {
        const alerts = buildPackingAdminAlerts(
            input({ model: { ...MODEL, threshold: null, evidence: 12 } }),
        )
        const alert = alerts.find((a) => a.id === "threshold-inactive")
        expect(alert?.detail).toContain("38")
    })

    test("inactif malgré assez de preuves : c'est la précision qui manque", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                model: { ...MODEL, threshold: null, evidence: 80, evidence_correct: 60, overall_precision: 0.75 },
            }),
        )
        const alert = alerts.find((a) => a.id === "threshold-inactive")
        expect(alert?.detail).toContain("précision mesurée")
        expect(alert?.detail).not.toContain("Il manque")
    })

    test("à la frontière exacte, on n'annonce pas qu'il manque des preuves", () => {
        const alerts = buildPackingAdminAlerts(
            input({ model: { ...MODEL, threshold: null, evidence: 50 } }),
        )
        expect(alerts.find((a) => a.id === "threshold-inactive")?.detail).toContain("précision")
    })

    test("actif : aucune alerte", () => {
        expect(ids(buildPackingAdminAlerts(input()))).not.toContain("threshold-inactive")
    })
})

describe("les erreurs d'auto-classement", () => {
    test("une seule suffit à lever une alerte grave", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                replay: {
                    ...REPLAY,
                    steps: [
                        {
                            packing_list_id: "p1",
                            container_label: "GR153",
                            imported_at: null,
                            label: "GR153",
                            lines: 90,
                            from_dictionary: 40,
                            auto: 20,
                            auto_wrong: 1,
                            suggestions_right: 10,
                            to_review: 30,
                            untouched_share: 0.66,
                            threshold: 0.99,
                        },
                    ],
                },
            }),
        )
        const alert = alerts.find((a) => a.id === "auto-wrong")
        expect(alert?.level).toBe("error")
        expect(alert?.tab).toBe("ecarts")
    })

    test("des auto corrigées à la main alertent aussi, mais moins fort", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                misses: [
                    {
                        packing_list_ligne_id: "l1",
                        packing_list_id: "p1",
                        raw_label_key: "polo ralph",
                        category_id: "cat-2",
                        suggested_category_id: "cat-1",
                        suggested_confidence: 0.995,
                        was_auto: true,
                        decided_by: "user-1",
                        created_at: "2026-09-20T10:00:00Z",
                    },
                ],
            }),
        )
        const alert = alerts.find((a) => a.id === "auto-corrected")
        expect(alert?.level).toBe("warning")
    })
})

describe("les imports", () => {
    test("un échec remonte son message d'erreur", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                imports: [importRow({ status: "echec", error_message: "colonne ITEM # absente" })],
            }),
        )
        const alert = alerts.find((a) => a.id === "imports-failed")
        expect(alert?.detail).toContain("colonne ITEM # absente")
        expect(alert?.tab).toBe("imports")
    })

    test("un échec sans message ne produit pas « undefined »", () => {
        const alerts = buildPackingAdminAlerts(
            input({ imports: [importRow({ status: "echec", error_message: null })] }),
        )
        expect(alerts.find((a) => a.id === "imports-failed")?.detail).toContain(
            "aucun message enregistré",
        )
    })

    test("un import récent en traitement n'est PAS bloqué", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                imports: [importRow({ status: "en_traitement", imported_at: new Date().toISOString() })],
            }),
        )
        expect(ids(alerts)).not.toContain("imports-stalled")
    })

    test("un import en traitement depuis une heure est bloqué", () => {
        const old = new Date(Date.now() - 3_600_000).toISOString()
        const alerts = buildPackingAdminAlerts(
            input({ imports: [importRow({ status: "en_traitement", imported_at: old })] }),
        )
        expect(ids(alerts)).toContain("imports-stalled")
    })
})

describe("le dictionnaire", () => {
    test("une correspondance contredite dit où la corriger", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                conflicts: [
                    {
                        raw_label_key: "polo ralph",
                        raw_label_sample: "PLO RalLrt",
                        dictionary_category_id: "cat-1",
                        latest_human_category_id: "cat-2",
                        latest_decision_at: "2026-09-20T10:00:00Z",
                        hit_count: 5,
                    },
                ],
            }),
        )
        const alert = alerts.find((a) => a.id === "dictionary-contradicted")
        expect(alert?.detail).toContain("Correspondances")
        expect(alert?.detail).toContain("5 fois")
    })

    test("un tableau vide alors que des décisions existent est signalé", () => {
        const alerts = buildPackingAdminAlerts(
            input({ model: { ...MODEL, dictionary_entries: 0 } }),
        )
        const alert = alerts.find((a) => a.id === "dictionary-empty")
        expect(alert?.detail).toContain("normaliseur")
    })

    test("aucune décision et aucun tableau : c'est un démarrage, pas une anomalie", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                model: { ...MODEL, dictionary_entries: 0, examples: 0, threshold: null, evidence: 0 },
            }),
        )
        expect(ids(alerts)).not.toContain("dictionary-empty")
    })
})

describe("migration et démarrage", () => {
    test("la table du journal absente est une information, pas une erreur", () => {
        const alerts = buildPackingAdminAlerts(input({ feedbackTableMissing: true }))
        const alert = alerts.find((a) => a.id === "feedback-table-missing")
        expect(alert?.level).toBe("info")
        expect(alert?.detail).toContain("20260918100000")
    })

    test("moins de trois conteneurs validés : on annonce qu'il n'y a pas de courbe", () => {
        const alerts = buildPackingAdminAlerts(
            input({ replay: { ...REPLAY, total_packings: 2 } }),
        )
        const alert = alerts.find((a) => a.id === "curve-too-early")
        expect(alert?.level).toBe("info")
        expect(alert?.detail).toContain("2 à ce jour")
    })

    test("trois conteneurs suffisent", () => {
        const alerts = buildPackingAdminAlerts(input({ replay: { ...REPLAY, total_packings: 3 } }))
        expect(ids(alerts)).not.toContain("curve-too-early")
    })
})

describe("l'ordre", () => {
    test("les alertes graves passent avant les autres", () => {
        const alerts = buildPackingAdminAlerts(
            input({
                model: { ...MODEL, threshold: null, evidence: 10 },
                imports: [importRow({ status: "echec", error_message: "boom" })],
                feedbackTableMissing: true,
                replay: { ...REPLAY, total_packings: 1 },
            }),
        )
        const levels = alerts.map((a) => a.level)
        const rank = { error: 0, warning: 1, info: 2 } as const
        const ranks = levels.map((l) => rank[l])
        expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    })
})
