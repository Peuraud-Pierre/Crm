import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { NO_FLASH_SCRIPT } from "./src/theme/noFlash"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const maplibreVersion: string = require("maplibre-gl/package.json").version
const isDev = process.env.NODE_ENV !== "production"


/** Origine d'une API, ajoutée à `connect-src` : en local, elle est en http. */
function apiOrigin(url: string | undefined, fallback: string): string {
    try {
        return new URL(url ?? fallback).origin
    } catch {
        return fallback
    }
}

const arrivageApiOrigin = apiOrigin(process.env.PUBLIC_ARRIVAGE_API_URL, "http://localhost:8000")
// Console retail (tickets, plans de magasin) : http://localhost:8080 en local.
const retailApiOrigin = apiOrigin(process.env.PUBLIC_RETAIL_API_URL, "https://retail.nokk-project.example")
// Supabase local (local-db/) : servi en http/ws, hors des `https:`/`wss:` génériques.
const supabaseOrigin = apiOrigin(process.env.PUBLIC_SUPABASE_URL, "")
const localSupabaseSources = supabaseOrigin.startsWith("http://")
    ? `${supabaseOrigin} ${supabaseOrigin.replace("http://", "ws://")}`
    : ""

export default defineConfig({
    source: {
        entry: {
            index: "./src/main.tsx",
        },
    },

    resolve: {
        alias: {
            "@": "./src",
        },
    },

    plugins: [pluginReact()],
    output: {
        assetPrefix: "/", // 🔥 obligatoire pour charger les chunks
        distPath: {
            root: "dist",
            js: "static/js",
            css: "static/css",
            image: "static/image",
            font: "static/font",
            media: "static/media",
            svg: "static/svg",
        },
        filename: {
            js: "[name].[contenthash:8].js",
            css: "[name].[contenthash:8].css",
        },
    },

    server: {
        port: 8082,
        open: false,
        historyApiFallback: true,
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Service-Worker-Allowed": "/",
        },
    },

    html: {
        title: "Nokk_project",
        tags: [
            {
                // Anti-FOUC : pose la classe .dark sur <html> avant le premier
                // paint (app CSR pure, le script anti-flash de next-themes
                // arrive trop tard — voir docs/DESIGN_SYSTEM.md § Theming et
                // src/theme/noFlash.ts). Doit rester synchrone (pas de
                // type="module"/async/defer) : les bundles JS de l'app sont
                // chargés en `defer` et ne peuvent donc jamais s'exécuter
                // avant ce script, quelle que soit sa position dans <head>.
                tag: "script",
                attrs: { id: "theme-no-flash" },
                children: NO_FLASH_SCRIPT,
            },
            {
                tag: "meta",
                attrs: {
                    "http-equiv": "Cache-Control",
                    content: "no-cache, no-store, must-revalidate",
                },
            },
            {
                tag: "meta",
                attrs: {
                    "http-equiv": "Content-Security-Policy",
                    content:
                        "default-src 'self'; " +
                        "base-uri 'self'; " +
                        "object-src 'none'; " +
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://challenges.cloudflare.com https://*.cloudflareaccess.com; " +
                        "script-src-elem 'self' 'unsafe-inline' blob: https://challenges.cloudflare.com https://*.cloudflareaccess.com; " +
                        "style-src 'self' 'unsafe-inline'; " +
                        `img-src 'self' data: blob: https: ${localSupabaseSources}; ` +
                        "font-src 'self' data: https:; " +
                        `connect-src 'self' https: wss: ${arrivageApiOrigin} ${retailApiOrigin} ${localSupabaseSources}; ` +
                        // Le host média des fichiers galerie/keyexchange est renvoyé
                        // par le backend (peut différer de l'env front : api vs apidev).
                        // Wildcard sur le domaine plutôt que d'énumérer chaque origine.
                        "media-src 'self' blob: https://*.nokk-project.example; " +
                        "worker-src 'self' blob:; " +
                        // blob: — l'aperçu PDF du Drive encadre un blob local et
                        // non l'URL distante : le host de l'API répond
                        // `frame-ancestors 'self'`, qui interdit à une page
                        // d'une autre origine de l'encadrer.
                        // *.nokk-project.example reste listé au cas où cette
                        // règle serait levée côté proxy.
                        "frame-src blob: https://challenges.cloudflare.com https://*.cloudflareaccess.com https://*.nokk-project.example;",
                },
            },
            {
                tag: "link",
                attrs: {
                    rel: "manifest",
                    href: "/manifest.webmanifest",
                },
            },
        ],
    },

    performance: {
        chunkSplit: {
            strategy: "split-by-experience",
        },
    },
    tools: {
        rspack: (config, { appendPlugins }) => {
            if (process.env.RSDOCTOR) {
                // Chargement paresseux d'un plugin dev optionnel (uniquement si RSDOCTOR)
                const { RsdoctorRspackPlugin } = require("@rsdoctor/rspack-plugin")
                appendPlugins(new RsdoctorRspackPlugin())
            }

            config.module ??= {}
            config.module.rules ??= []

            // Worker maplibre-gl (voir src/shared/lib/maplibreWorker.ts) :
            // le worker et son module partagé sont émis tels quels, sous leur
            // nom d'origine et dans le même dossier, pour que l'import relatif
            // `./maplibre-gl-shared.mjs` du worker reste valide. Le dossier est
            // versionné pour ne jamais apparier un worker et un shared de deux
            // versions différentes via le cache navigateur.
            // `dependency: "url"` : ne s'applique qu'aux `new URL(..., import.meta.url)`,
            // pas aux `import` JS classiques de ces mêmes fichiers.
            config.module.rules.push({
                test: /maplibre-gl[\\/]dist[\\/]maplibre-gl-(worker|shared)\.mjs$/,
                dependency: "url",
                type: "asset/resource",
                generator: {
                    filename: `static/js/maplibre-${maplibreVersion}/[name][ext]`,
                },
            })
            // maplibre-gl.mjs contient un `new URL(expr, import.meta.url)` que
            // rspack ne peut pas résoudre statiquement ("Critical dependency:
            // the request of a dependency is an expression"). L'URL du worker
            // est fournie explicitement ci-dessus, ce chemin n'est jamais pris :
            // on coupe l'analyse des `new URL` et l'avertissement sur ce seul
            // module.
            config.module.rules.push({
                test: /maplibre-gl[\\/]dist[\\/]maplibre-gl\.mjs$/,
                parser: { url: false, exprContextCritical: false },
            })

            if (isDev) {
                config.module.rules.unshift({
                    test:    /\.(tsx|jsx)$/,
                    exclude: /node_modules/,
                    enforce: "pre",
                    use: [{
                        loader: path.resolve(__dirname, "scripts/data-source-loader.cjs"),
                    }],
                })
            }
        },
    },
})
