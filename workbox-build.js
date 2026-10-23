// workbox-build.js
import fs from "fs"
import { generateSW } from "workbox-build"

// Génère dist/version.json : source de vérité DYNAMIQUE de la version déployée.
// Reconstruit à chaque build (pas de bump manuel) et servi en no-cache → l'app
// et nginx peuvent toujours lire la version réellement en ligne.
function writeVersionFile() {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
    const commit =
        process.env.DRONE_COMMIT_SHA || process.env.DRONE_COMMIT || "dev"
    const version = {
        version: pkg.version,
        commit: commit.slice(0, 8),
        branch: process.env.DRONE_BRANCH || "local",
        builtAt: new Date().toISOString(),
    }
    fs.writeFileSync(
        "dist/version.json",
        JSON.stringify(version, null, 2) + "\n"
    )
    console.log(
        `✔ version.json généré: v${version.version} (${version.commit}, ${version.branch})`
    )
}

async function buildSW() {
    console.log("🔧 Génération Workbox...")

    writeVersionFile()

    await generateSW({
        swDest: "dist/sw.js",
        globDirectory: "dist",
        // Précache uniquement les assets immutables (hashés). Pas d'index.html
        // dans le precache → évite de servir un HTML stale qui référence des chunks disparus.
        globPatterns: [
            "static/**/*.{js,css,svg,png,webp,woff2}",
            "manifest.webmanifest",
            "favicon.ico",
        ],
        globIgnores: ["**/*.map", "**/sw*.js"],
        // Les URLs hashées sont déjà uniques par contenu : pas besoin de cache-bust.
        dontCacheBustURLsMatching: /\.[a-f0-9]{8}\.(?:js|css)$/,
        // Autorise les chunks > 2 MiB (default Workbox) pour les vendors lourds.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,

        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,

        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
            /^\/api\//,
            /^\/functions\//,
            /^\/storage\//,
            /^\/keyexchange\//,
            /^\/matomo\//,
            /^\/apple\//,
            /\.[a-z0-9]+$/i, // requêtes avec extension (assets directs)
        ],

        runtimeCaching: [
            // Navigations (HTML) : NetworkFirst court → toujours tenter la dernière index.html
            {
                urlPattern: ({ request }) => request.mode === "navigate",
                handler: "NetworkFirst",
                options: {
                    cacheName: "pages-cache",
                    networkTimeoutSeconds: 3,
                    expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                },
            },
            // Assets hashés : CacheFirst longue durée (immuables par construction).
            {
                urlPattern: /\/static\/.+\.[a-f0-9]{8}\.(?:js|css|woff2)$/,
                handler: "CacheFirst",
                options: {
                    cacheName: "hashed-assets-cache",
                    expiration: {
                        maxEntries: 300,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                },
            },
            // JS/CSS non hashés (fallback) : SWR pour rester à jour rapidement.
            {
                urlPattern: ({ request }) =>
                    request.destination === "script" ||
                    request.destination === "style" ||
                    request.destination === "worker",
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "assets-cache",
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 60 * 60 * 24 * 7,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                },
            },
            {
                urlPattern: ({ request }) => request.destination === "image",
                handler: "CacheFirst",
                options: {
                    cacheName: "images-cache",
                    expiration: {
                        maxEntries: 200,
                        maxAgeSeconds: 60 * 60 * 24 * 30,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                },
            },
            {
                urlPattern: ({ request }) => request.destination === "font",
                handler: "CacheFirst",
                options: {
                    cacheName: "fonts-cache",
                    expiration: {
                        maxEntries: 50,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                },
            },
        ],
    })

    console.log("✔ Workbox terminé, injection module PUSH en tête...")

    // Prepend (pas append) : les listeners `push` / `notificationclick` doivent
    // être enregistrés avant la fin du script pour intercepter les events au boot.
    try {
        const pushCode = fs.readFileSync("sw-push.js", "utf8")
        const existing = fs.readFileSync("dist/sw.js", "utf8")
        fs.writeFileSync(
            "dist/sw.js",
            "// ---- PUSH MODULE ----\n" + pushCode + "\n// ---- /PUSH ----\n\n" + existing
        )
        console.log("✔ Module PUSH injecté en tête")
    } catch {
        console.warn(
            "⚠ Attention: sw-push.js non trouvé, le module push n'a pas été ajouté."
        )
    }

    // Nettoyage des .map du dist
    for (const file of fs.readdirSync("dist")) {
        if (file.endsWith(".map")) fs.rmSync(`dist/${file}`)
    }
    let sw = fs.readFileSync("dist/sw.js", "utf8")
    sw = sw.replace(/\/\/# sourceMappingURL=.*$/gm, "")
    fs.writeFileSync("dist/sw.js", sw)
    console.log("✔ Sourcemaps supprimées")
}

buildSW()
