import { defineConfig } from "@rstest/core"
import { pluginReact } from "@rsbuild/plugin-react"

export default defineConfig({
    testEnvironment: "jsdom",
    setupFiles: "./rstest.setup.ts",
    globals: true,
    plugins: [pluginReact()],
    // vmThreads : chaque fichier de test tourne dans un contexte VM neuf, à
    // l'intérieur de workers réutilisés. On garde l'isolation entre fichiers
    // (mocks de modules, globals, DOM) sans payer un process par fichier :
    // ≈15s → ≈6,5s sur `npm run test:front`.
    // Remplace l'ancien `isolate: false` du pool forks, qui n'est plus sûr
    // depuis rstest 0.12 : les mocks de modules y fuient d'un fichier à
    // l'autre (échecs aléatoires). `isolate` est sans effet sur les pools VM.
    // Ne PAS ajouter restoreMocks:true : plusieurs suites s'appuient sur des
    // mocks persistants et 28 tests cassent (voir historique).
    pool: {
        type: "vmThreads",
        maxWorkers: "80%",
        minWorkers: 1,
    },
})
