// API publique de la feature magasins — seuls ces exports peuvent être
// utilisés hors de magasins/. Tout import interne passe par un chemin complet.

export type {
    Magasin,
    ZoneMagasin,
    EmplacementMagasin,
    ZoneKind,
} from "./types/magasin.types"

export { MAGASIN_PERMISSIONS } from "./constants"
export { default as MagasinsRoute } from "./routes/Magasins"
