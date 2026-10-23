// ── services/geoJsonService.ts ────────────────────────────────────────────────
// Fond de carte de l'onglet Matomo : contours des pays.
//
// Natural Earth 1:110m (domaine public), réduit aux champs utiles — ISO_A2
// (ISO_A2_EH en repli : la France et la Norvège y valent « -99 ») et NAME en
// français (NAME_FR) — coordonnées arrondies au centième : 174 Ko, 54 Ko gzip.
// Remplace un GeoJSON 1:10m de 14,6 Mo chargé depuis raw.githubusercontent.com,
// avec un cache IndexedDB pour amortir ce poids : servi par l'app, le fichier
// est mis en cache par le navigateur et ne dépend plus de GitHub ni de la CSP.
//
// Régénérer : ne_110m_admin_0_countries.geojson (nvkelso/natural-earth-vector),
// mêmes champs, `round(x, 2)`.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useMatomo.ts → useCountriesGeoJson

const GEOJSON_URL = "/geo/countries-110m.geojson"

/**
 * L'ancienne version stockait les 14,6 Mo de contours dans la base IndexedDB
 * « matomo_cache » de chaque navigateur ; rien d'autre ne la lit plus.
 * ponytail: nettoyage ponctuel, à retirer une fois les postes passés (2027).
 */
function dropLegacyCache() {
    try {
        indexedDB.deleteDatabase("matomo_cache")
    } catch {
        // IndexedDB indisponible : rien à nettoyer
    }
}

/** Contours des pays. Lève une erreur si le fichier ne répond pas. */
export async function fetchCountriesGeoJson(): Promise<GeoJSON.FeatureCollection> {
    dropLegacyCache()
    const res = await fetch(GEOJSON_URL)
    if (!res.ok) throw new Error("Fond de carte indisponible.")
    return (await res.json()) as GeoJSON.FeatureCollection
}
