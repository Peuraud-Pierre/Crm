import "@testing-library/jest-dom"
import { webcrypto } from "node:crypto"
import { beforeEach, rstest } from "@rstest/core"

// Provide Supabase env vars for tests (prevents createClient crash)
if (!import.meta.env.PUBLIC_SUPABASE_URL) {
    ;(import.meta.env as unknown as Record<string, string>).PUBLIC_SUPABASE_URL =
        "https://test.supabase.co"
}
if (!import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    ;(import.meta.env as unknown as Record<string, string>).PUBLIC_SUPABASE_PUBLISHABLE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMDAwMDAwMCwiZXhwIjoxOTM1NjAwMDAwfQ.test"
}
// Requises par src/shared/lib/env.ts (schéma zod) — évite un throw au premier import de `env` dans un test.
if (!import.meta.env.PUBLIC_SUPABASE_FUNCTION_URL) {
    ;(import.meta.env as unknown as Record<string, string>).PUBLIC_SUPABASE_FUNCTION_URL =
        "https://test.supabase.co/functions/v1"
}
if (!import.meta.env.PUBLIC_API_BASE_URL) {
    ;(import.meta.env as unknown as Record<string, string>).PUBLIC_API_BASE_URL =
        "https://test.local/api"
}

// Dans un contexte VM (pool vmThreads), `crypto` est celui de jsdom, qui n'a pas
// `subtle` : on branche le Web Crypto de Node, comme le fait un vrai navigateur.
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        configurable: true,
        writable: true,
    })
}

// Three.js pose `window.__THREE__` à son chargement et avertit (« Multiple
// instances of Three.js ») s'il le trouve déjà. Avec isolate:false, chaque
// fichier de test qui l'importe le recharge dans le même window : on efface la
// marque laissée par le fichier précédent.
delete (window as { __THREE__?: string }).__THREE__

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = String(value)
        },
        removeItem: (key: string) => {
            delete store[key]
        },
        clear: () => {
            store = {}
        },
        get length() {
            return Object.keys(store).length
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
    }
})()

Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
})

// jsdom ne fournit pas scrollIntoView — utilisé par les composants Radix (ex. <Select>)
// pour amener l'item sélectionné en vue à l'ouverture. Sans ce polyfill, tout test qui
// monte un composant avec un <Select> Radix plante avec "scrollIntoView is not a function".
if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => { }
}

// jsdom ne fournit pas ResizeObserver — utilisé par LiquidTabsIndicator (pastille
// d'onglet actif) pour se remesurer quand la liste change de largeur. Sans ce
// polyfill, tout test montant un <TabsList indicator> plante avec
// "ResizeObserver is not defined". Stub inerte : les tests ne redimensionnent rien.
if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    ;(globalThis as unknown as Record<string, unknown>).ResizeObserver =
        ResizeObserverStub
}

// jsdom ne fournit pas matchMedia — utilisé par useIsMobile (shared/hooks/use-mobile)
// et usePrefersReducedMotion. Sans ce polyfill, tout test montant un composant qui
// s'en sert plante avec "window.matchMedia is not a function" (ex. FluxTab).
// Stub inerte (aucune media query ne matche → rendu desktop) ; les suites qui ont
// besoin d'un comportement précis réassignent window.matchMedia de leur côté.
if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
}

// jsdom n'implémente pas <canvas> : getContext() renvoie null mais logue
// « Not implemented: HTMLCanvasElement's getContext() » à chaque appel (fond
// d'auth, scènes 3D, compression d'image…), ce qui noie la sortie des tests.
// Même résultat (null), sans le bruit ; les suites qui ont besoin d'un contexte
// le stubbent de leur côté (cf. bibliotheque/imageResize.test.ts).
window.HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof window.HTMLCanvasElement.prototype.getContext

// Prevent state leakage between tests
beforeEach(() => {
    localStorageMock.clear()

    // Aucun test ne doit atteindre le réseau. Sans ce stub, un composant monté
    // qui appelle fetch (VisitsLog, MatomoMap, useGallery…) part réellement vers
    // PUBLIC_API_BASE_URL (test.local) et rejette après un délai DNS variable,
    // donc APRÈS la fin du test. Comme isolate:false partage le worker entre
    // fichiers, cette rejection tardive est imputée à un fichier au hasard sous
    // la forme « [birpc] rpc is closed, cannot call onConsoleLog » — d'où des
    // échecs CI intermittents sans aucun test en échec.
    // Ce beforeEach étant enregistré par setupFiles, il s'exécute avant celui
    // des fichiers de test : ceux qui ont besoin d'une réponse précise
    // réassignent global.fetch de leur côté et gardent la main.
    // rstest.fn() et non une fonction nue : plusieurs suites font
    // rstest.mocked(fetch).mockResolvedValueOnce(...) et ont donc besoin d'un
    // mock, pas d'un simple stub.
    globalThis.fetch = rstest.fn(() =>
        Promise.resolve(
            new Response("[]", {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        )
    ) as unknown as typeof fetch
})
