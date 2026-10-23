import { expect, test } from "@rstest/core"
import {
    COLUMN_NAMES,
    SHARED_COLUMNS,
    UNASSIGNED_POOL_COLUMN,
} from "./CrmTab"

// Ces index sont dérivés par indexOf sur un libellé : renommer une colonne
// donnerait -1 et couperait silencieusement le partage (filtre `.or()` qui ne
// matche plus rien, badge de comptage à zéro).
test("les index de colonnes partagées sont résolus", () => {
    expect(UNASSIGNED_POOL_COLUMN).toBeGreaterThanOrEqual(0)
    for (const col of SHARED_COLUMNS) {
        expect(col).toBeGreaterThanOrEqual(0)
    }
})

test("la seule colonne partagée est RDV à confirmer", () => {
    expect(SHARED_COLUMNS.map((c) => COLUMN_NAMES[c])).toEqual([
        "RDV à confirmer",
    ])
})

// Le RPC get_client_column_counts code ces index en dur (v5 : `collum = 9`
// et generate_series(0, 9)). Si le tableau change, la migration doit suivre.
test("les index restent alignés avec le RPC de comptage", () => {
    expect(SHARED_COLUMNS).toEqual([9])
    expect(COLUMN_NAMES.length).toBe(10)
})
