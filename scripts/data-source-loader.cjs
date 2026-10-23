/**
 * Loader Rspack — injecte un attribut `data-source="<file>:<line>:<col>"`
 * sur chaque JSXOpeningElement (dev only). Aucune modification de la
 * source utilisateur, transforme uniquement la copie qui passe dans le
 * pipeline. Tourne avant la transformation JSX→JS de SWC built-in.
 *
 * Utilise @babel/parser (offsets en char index 0-based, fiables et
 * stables entre appels) plutôt que @swc/core dont les BytePos sont
 * globaux au process et difficiles à anchorer correctement.
 */

const path = require("node:path")
const { parse } = require("@babel/parser")
const MagicString = require("magic-string")

const ATTR_NAME = "data-source"

/**
 * Éléments à ne pas instrumenter : ce ne sont pas des balises DOM, leurs props
 * sont transmises telles quelles à une API qui valide strictement son schéma.
 * `<Source>`/`<Layer>` (react-map-gl) partent dans map.addSource/addLayer, dont
 * la spec maplibre rejette toute propriété inconnue :
 *   Error: sources.countries: unknown property "data-source"
 */
const SKIP_ELEMENTS = new Set(["Source", "Layer"])

function buildLineIndex(src) {
    const idx = [0]
    for (let i = 0; i < src.length; i++) {
        if (src.charCodeAt(i) === 10) idx.push(i + 1)
    }
    return idx
}

function locFromCharOffset(idx, offset) {
    let lo = 0
    let hi = idx.length - 1
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (idx[mid] <= offset) lo = mid
        else hi = mid - 1
    }
    return { line: lo + 1, col: offset - idx[lo] + 1 }
}

function visit(node, fn) {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) { for (const n of node) visit(n, fn); return }
    if (typeof node.type === "string") fn(node)
    for (const k in node) {
        if (k === "loc" || k === "start" || k === "end" || k === "range" || k === "type") continue
        const v = node[k]
        if (v && typeof v === "object") visit(v, fn)
    }
}

module.exports = function dataSourceLoader(source) {
    const callback = this.async()
    const filename = this.resourcePath
    const rootContext = this.rootContext || process.cwd()

    if (filename.includes("node_modules")) return callback(null, source)
    if (!/\.(tsx|jsx)$/.test(filename))     return callback(null, source)

    // Early-out sûr : sans le moindre `<`, le fichier ne peut contenir aucun
    // JSXOpeningElement. On évite alors un parse Babel complet (le coût
    // dominant de ce loader) sur les .tsx purement logiques (hooks, types,
    // services). Un `<` de générique TS (`useState<Foo>`) déclenche quand même
    // le parse — aucun risque de faux négatif, juste pas d'optimisation.
    if (!source.includes("<")) return callback(null, source)

    let ast
    try {
        ast = parse(source, {
            sourceType:               "module",
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction:  true,
            allowAwaitOutsideFunction:   true,
            errorRecovery:               true,
            plugins: [
                "typescript",
                "jsx",
                "decorators-legacy",
                "topLevelAwait",
                "importMeta",
            ],
        })
    } catch {
        return callback(null, source)
    }

    const lineIdx = buildLineIndex(source)
    const relPath = path.relative(rootContext, filename).split(path.sep).join("/")
    const ms      = new MagicString(source)

    visit(ast.program ?? ast, (node) => {
        if (node.type !== "JSXOpeningElement") return

        if (
            node.name?.type === "JSXIdentifier" &&
            SKIP_ELEMENTS.has(node.name.name)
        ) return

        const already = node.attributes?.some(a =>
            a.type === "JSXAttribute" &&
            a.name?.type === "JSXIdentifier" &&
            a.name.name === ATTR_NAME
        )
        if (already) return

        const nameEnd = node.name?.end
        const elStart = node.start
        if (nameEnd == null || elStart == null) return

        const { line, col } = locFromCharOffset(lineIdx, elStart)
        ms.appendRight(nameEnd, ` ${ATTR_NAME}="${relPath}:${line}:${col}"`)
    })

    callback(null, ms.toString())
}
