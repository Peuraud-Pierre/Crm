#!/usr/bin/env node
// Rapport de dette technique — voir docs/PLAN_ASSAINISSEMENT.md §8.3.
// Usage: node scripts/tech-debt-report.mjs [--write]
//   sans argument : affiche le rapport sur stdout
//   --write        : écrit aussi le rapport dans docs/TECH_DEBT.md
//
// Objectif : rendre visible si le nettoyage tient dans la durée (le vrai
// enjeu de "stabilité sur la longueur"), pas juste au moment où ce plan a
// été exécuté. Informatif — ne fait jamais échouer le process (code 0
// systématique), contrairement aux gates ratchet de scripts/check-quality-ratchet.mjs.

import { readdirSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Logs de progression → stderr, pour ne JAMAIS polluer le markdown émis sur
// stdout (le rapport peut être redirigé : `node ... > rapport.md`).
const t0 = performance.now()
const log = (msg) => process.stderr.write(`[tech-debt] ${msg}\n`)
const elapsed = () => `${Math.round(performance.now() - t0)}ms`

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const featuresDir = path.join(rootDir, "src/features")

const GOD_COMPONENT_THRESHOLD = 400 // docs/Architecture_Feature.pdf §15
const ARBITRARY_TAILWIND_RE = /\b[a-z-]+-\[[^\]]+\]/g
const SUPABASE_IMPORT_RE = /@\/integrations\/supabase\/client/

function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist") continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
}

function lineCount(content) {
    return content.split("\n").length
}

function isTestFile(file) {
    return /\.test\.(ts|tsx)$/.test(file)
}

function isInServicesDir(file) {
    return /[\\/]services[\\/]/.test(file)
}

function relative(file) {
    return path.relative(rootDir, file).replace(/\\/g, "/")
}

async function analyzeFeature(name, files) {
    const nonTestFiles = files.filter((f) => !isTestFile(f))
    const testFiles = files.filter(isTestFile)

    const godComponents = []
    let arbitraryTailwindCount = 0
    const directSupabaseImports = []

    // Lecture parallèle : le scan est I/O-bound (des centaines de petits
    // fichiers). Promise.all laisse le pool libuv paralléliser les lectures
    // au lieu de bloquer sur chaque readFileSync l'une après l'autre.
    const contents = await Promise.all(nonTestFiles.map((f) => readFile(f, "utf8")))

    for (let i = 0; i < nonTestFiles.length; i++) {
        const file = nonTestFiles[i]
        const content = contents[i]
        const lines = lineCount(content)
        if (lines > GOD_COMPONENT_THRESHOLD) {
            godComponents.push({ file: relative(file), lines })
        }
        arbitraryTailwindCount += (content.match(ARBITRARY_TAILWIND_RE) ?? []).length
        if (SUPABASE_IMPORT_RE.test(content) && !isInServicesDir(file)) {
            directSupabaseImports.push(relative(file))
        }
    }

    return {
        name,
        totalFiles: nonTestFiles.length,
        testFiles: testFiles.length,
        testRatio: nonTestFiles.length === 0 ? 0 : testFiles.length / nonTestFiles.length,
        godComponents: godComponents.sort((a, b) => b.lines - a.lines),
        arbitraryTailwindCount,
        directSupabaseImports,
    }
}

function formatPercent(ratio) {
    return `${Math.round(ratio * 100)}%`
}

async function buildReport() {
    const features = readdirSync(featuresDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()

    log(`${features.length} feature(s) détectée(s) dans src/features — scan en cours...`)

    // Toutes les features analysées en parallèle (chacune parallélise déjà ses
    // lectures) : sur ce repo, ramène le scan de ~séquentiel à quasi-instantané.
    const results = await Promise.all(
        features.map((name) => analyzeFeature(name, walk(path.join(featuresDir, name)))),
    )

    const scannedFiles = results.reduce((s, r) => s + r.totalFiles + r.testFiles, 0)
    log(`${scannedFiles} fichier(s) analysé(s) en ${elapsed()}`)

    const totalGodComponents = results.reduce((s, r) => s + r.godComponents.length, 0)
    const totalArbitrary = results.reduce((s, r) => s + r.arbitraryTailwindCount, 0)
    const totalDirectSupabase = results.reduce((s, r) => s + r.directSupabaseImports.length, 0)
    const totalFiles = results.reduce((s, r) => s + r.totalFiles, 0)
    const totalTests = results.reduce((s, r) => s + r.testFiles, 0)

    const lines = []
    lines.push("# Rapport de dette technique")
    lines.push("")
    lines.push(`Généré par \`scripts/tech-debt-report.mjs\` — voir \`docs/PLAN_ASSAINISSEMENT.md\` §8.3.`)
    lines.push(`Snapshot au ${new Date().toISOString().slice(0, 10)}. Document jetable, régénéré à chaque exécution — ne pas éditer à la main.`)
    lines.push("")
    lines.push("## Vue d'ensemble")
    lines.push("")
    lines.push(`- Fichiers >${GOD_COMPONENT_THRESHOLD} lignes (god components) : **${totalGodComponents}**`)
    lines.push(`- Imports Supabase directs hors \`services/\` : **${totalDirectSupabase}**`)
    lines.push(`- Valeurs Tailwind arbitraires (\`text-[...]\`, \`w-[...]\`, etc.) : **${totalArbitrary}**`)
    lines.push(`- Couverture de tests globale (features) : **${totalTests}/${totalFiles} fichiers (${formatPercent(totalFiles === 0 ? 0 : totalTests / totalFiles)})**`)
    lines.push("")
    lines.push("## Par feature")
    lines.push("")
    lines.push("| Feature | Fichiers | Tests | Couverture | God components | Tailwind arbitraire | Supabase direct |")
    lines.push("|---|---|---|---|---|---|---|")
    for (const r of [...results].sort((a, b) => b.totalFiles - a.totalFiles)) {
        if (r.totalFiles === 0) continue
        lines.push(
            `| ${r.name} | ${r.totalFiles} | ${r.testFiles} | ${formatPercent(r.testRatio)} | ${r.godComponents.length} | ${r.arbitraryTailwindCount} | ${r.directSupabaseImports.length} |`,
        )
    }
    lines.push("")
    lines.push("## God components (>400 lignes)")
    lines.push("")
    const allGodComponents = results
        .flatMap((r) => r.godComponents)
        .sort((a, b) => b.lines - a.lines)
    if (allGodComponents.length === 0) {
        lines.push("Aucun.")
    } else {
        lines.push("| Fichier | Lignes |")
        lines.push("|---|---|")
        for (const g of allGodComponents) {
            lines.push(`| \`${g.file}\` | ${g.lines} |`)
        }
    }
    lines.push("")
    lines.push("## Features sans aucun test")
    lines.push("")
    const untested = results.filter((r) => r.totalFiles > 0 && r.testFiles === 0).map((r) => r.name)
    lines.push(untested.length === 0 ? "Aucune." : untested.map((n) => `- ${n}`).join("\n"))
    lines.push("")

    return lines.join("\n") + "\n"
}

const report = await buildReport()
const shouldWrite = process.argv.includes("--write")

if (shouldWrite) {
    const outPath = path.join(rootDir, "docs/TECH_DEBT.md")
    writeFileSync(outPath, report, "utf8")
    console.log(`Rapport écrit dans ${path.relative(rootDir, outPath)}`)
    log(`Terminé en ${elapsed()}`)
} else {
    console.log(report)
    log(`Terminé en ${elapsed()}`)
}
