#!/usr/bin/env node
// Mode ratchet CI — voir docs/PLAN_ASSAINISSEMENT.md §5.1.
// Usage: node scripts/check-quality-ratchet.mjs <lint|typecheck>
// Échoue si le nombre de problèmes dépasse la baseline committée dans ci/quality-baseline.json.

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const target = process.argv[2]

if (target !== "lint" && target !== "typecheck") {
    console.error("Usage: node scripts/check-quality-ratchet.mjs <lint|typecheck>")
    process.exit(2)
}

const baseline = JSON.parse(
    readFileSync(path.join(rootDir, "ci/quality-baseline.json"), "utf8"),
)[target]

function run(cmd) {
    try {
        return execSync(cmd, { cwd: rootDir, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 })
    } catch (err) {
        // oxlint/tsc quittent avec un code non nul dès qu'il y a des problèmes : on veut leur sortie, pas l'échec.
        // Mais si l'outil a crashé sans rien produire (node_modules corrompu,
        // binaire absent…), le signaler clairement au lieu de laisser le
        // JSON.parse aval échouer avec un message cryptique.
        const stdout = err.stdout ?? ""
        if (stdout.trim() === "") {
            console.error(`[quality-ratchet] ÉCHEC — la commande n'a produit aucune sortie: ${cmd}`)
            console.error(
                "[quality-ratchet] L'outil a probablement crashé avant d'analyser quoi que ce soit " +
                    "(node_modules corrompu ou incomplet ? → invalider le cache CI / réinstaller).",
            )
            if (err.stderr) console.error(String(err.stderr).slice(0, 4000))
            process.exit(2)
        }
        return stdout
    }
}

const t0 = performance.now()
console.log(`[quality-ratchet] ${target}: analyse en cours (baseline attendue: ${baseline})...`)

let count
let errorCount = 0
let warningCount = 0
if (target === "lint") {
    const { diagnostics } = JSON.parse(run("npx oxlint -f json"))
    errorCount = diagnostics.filter((d) => d.severity === "error").length
    warningCount = diagnostics.filter((d) => d.severity === "warning").length
    count = errorCount + warningCount
} else {
    const output = run("npx tsc --noEmit -p tsconfig.json")
    count = (output.match(/error TS\d+:/g) ?? []).length
}

const durationMs = Math.round(performance.now() - t0)
const detail = target === "lint" ? ` (${errorCount} erreur(s), ${warningCount} warning(s))` : ""
console.log(
    `[quality-ratchet] ${target}: ${count} problème(s)${detail} — baseline: ${baseline} — analysé en ${durationMs}ms`,
)

if (count > baseline) {
    console.error(
        `[quality-ratchet] ÉCHEC — ${target} a régressé (${count} > ${baseline} attendus). ` +
            `Corrigez les nouveaux problèmes introduits, ou si une réduction volontaire de la baseline est justifiée, ` +
            `mettez à jour ci/quality-baseline.json dans la même PR avec une explication.`,
    )
    process.exit(1)
}

if (count < baseline) {
    console.log(
        `[quality-ratchet] ${target} s'est amélioré (${count} < ${baseline}). ` +
            `Pensez à abaisser la baseline dans ci/quality-baseline.json pour verrouiller le gain.`,
    )
}

process.exit(0)
