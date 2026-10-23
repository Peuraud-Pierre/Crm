/**
 * Enregistre l'URL du web worker de maplibre-gl auprès du bundle rspack.
 *
 * Depuis maplibre-gl 6, la lib localise son worker via `import.meta.url`.
 * Rspack remplace cette valeur à la compilation par un chemin `file://` :
 * maplibre le rejette (non http), retombe sur une URL vide et `new Worker("")`
 * échoue — aucune carte ne s'affiche. On fournit donc explicitement l'URL.
 *
 * Le worker importe `./maplibre-gl-shared.mjs` en relatif : les deux fichiers
 * sont émis tels quels, côte à côte et sous leur nom d'origine, par une règle
 * `asset/resource` dédiée dans `rsbuild.config.ts`. La seconde `new URL` ne
 * sert qu'à forcer l'émission du module partagé.
 *
 * À importer une fois, avant le premier rendu d'une carte.
 */
import { setWorkerUrl } from "maplibre-gl"

const workerUrl = new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url
)
void new URL("maplibre-gl/dist/maplibre-gl-shared.mjs", import.meta.url)

setWorkerUrl(workerUrl.href)
