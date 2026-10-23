import { createRoot } from "react-dom/client"
import App from "./App"
import { AppErrorBoundary } from "@/shared/components/misc/AppErrorBoundary"
import { notifyUpdateAvailable } from "@/shared/lib/appUpdate"
import "./index.css"

// Auto-reload on ChunkLoadError (stale cache after deploy)
//
// Passe par notifyUpdateAvailable et non par un reload direct : un chunk
// manquant est le symptôme d'un déploiement, exactement comme le
// controllerchange plus bas. Rien en cours → rechargement immédiat, comme
// avant ; saisie en cours → on attend qu'elle soit enregistrée.
window.addEventListener("error", (event) => {
    if (
        event.error?.name === "ChunkLoadError" &&
        !sessionStorage.getItem("chunk_reload")
    ) {
        sessionStorage.setItem("chunk_reload", "1")
        notifyUpdateAvailable()
    }
})

window.addEventListener("unhandledrejection", (event) => {
    if (
        event.reason?.name === "ChunkLoadError" &&
        !sessionStorage.getItem("chunk_reload")
    ) {
        sessionStorage.setItem("chunk_reload", "1")
        notifyUpdateAvailable()
    }
})

// Clear reload flag on successful load
sessionStorage.removeItem("chunk_reload")

// Migration one-shot : l'ancien DarkmodSwitch stockait "true"/"false" dans
// localStorage["darkMode"]. next-themes (storageKey="darkMode") attend
// "light" | "dark" | "system". Convertir une seule fois avant le premier
// rendu pour ne pas réinitialiser silencieusement la préférence des
// utilisateurs existants sur "system".
// Le script anti-FOUC inline (rsbuild.config.ts, src/theme/noFlash.ts) lit
// déjà "true"/"false" indépendamment de cette migration — les deux gèrent
// ces valeurs legacy séparément, ne pas modifier l'un sans l'autre.
const legacyDarkMode = localStorage.getItem("darkMode")
if (legacyDarkMode === "true" || legacyDarkMode === "false") {
    localStorage.setItem("darkMode", legacyDarkMode === "true" ? "dark" : "light")
}

const rootElement = document.getElementById("root")

if (!rootElement) {
    throw new Error("Root element not found")
}

createRoot(rootElement).render(
    <AppErrorBoundary>
        <App />
    </AppErrorBoundary>
)

// DOMException: The operation is insecure.

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        const isLocalhost =
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1"
        const isHttps = location.protocol === "https:"

        if (!isLocalhost && !isHttps) {
            console.warn(
                "Service worker registration skipped: not HTTPS or localhost"
            )
            return
        }

        // À la toute première visite (pas encore de controller), `clientsClaim`
        // déclenche un controllerchange « initial » qu'on ignore pour éviter un
        // reload inutile au boot. Les controllerchange SUIVANTS sont de vraies
        // mises à jour → reload. `let` car on bascule le flag après le 1er event.
        let hadController = !!navigator.serviceWorker.controller

        navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((reg) => {
                console.log("✓ Service Worker registered:", reg.scope)

                // Le navigateur ne vérifie une nouvelle version du SW qu'à la
                // navigation (puis ~toutes les 24h). Un commercial qui laisse
                // l'onglet ouvert ne déclencherait jamais la mise à jour → on
                // force `reg.update()` périodiquement ET au retour sur l'onglet.
                // Dès qu'un nouveau sw.js est déployé, il s'active (skipWaiting)
                // → controllerchange → reload automatique (ci-dessous).
                const checkForUpdate = () => {
                    // Inutile (et bruyant) de vérifier quand l'onglet est masqué.
                    if (document.visibilityState !== "visible") return
                    reg.update().catch(() => {
                        /* hors-ligne / réseau instable : on retentera plus tard */
                    })
                }

                setInterval(checkForUpdate, 60 * 1000)
                document.addEventListener("visibilitychange", checkForUpdate)
            })
            .catch((error) => {
                console.error("✗ Service worker registration failed:", error)
            })

        // Reload une seule fois quand un nouveau SW prend le contrôle, pour
        // que la nouvelle index.html (et ses chunks hashés) soit chargée.
        //
        // Le rechargement n'est plus immédiat : notifyUpdateAvailable le
        // diffère tant qu'un formulaire déclare du travail non enregistré.
        // Recharger en pleine frappe faisait perdre la saisie en cours, et le
        // reload brutal empêchait même les flush de démontage de partir.
        let refreshing = false
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return
            if (!hadController) {
                // Prise de contrôle initiale (1ère visite) : on l'ignore une
                // seule fois, les suivantes seront de vraies mises à jour.
                hadController = true
                return
            }
            refreshing = true
            notifyUpdateAvailable()
        })
    })
}
