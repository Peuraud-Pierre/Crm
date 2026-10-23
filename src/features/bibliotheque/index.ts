// API publique de la feature bibliotheque (Architecture_Feature.pdf, doctrine
// Vertical Slice/Feature-First). Tout ce qui vit sous src/features/bibliotheque/
// et n'est pas ré-exporté ici est un détail d'implémentation interne — un
// fichier extérieur à la feature ne doit jamais importer directement
// services/, hooks/ ou context/ (contourne la couche service/hooks/contexte).
//
// Ne PAS ré-exporter les composants internes ni les services.
//
// `export type { ... } from "./types"` ne réexporte QUE des types TypeScript
// (Lang, Thematique, etc.) : ils n'existent qu'à la compilation et disparaissent
// entièrement du code une fois compilé en JavaScript.
// `export { default as Bibliotheque } from "./routes/Bibliotheque"` réexporte
// une vraie valeur qui existe à l'exécution (le composant React) : ici, on
// prend l'export par défaut du fichier Bibliotheque.tsx et on lui donne le nom
// "Bibliotheque" dans cette API publique.

export type {
    Lang,
    FormatChannel,
    Thematique,
    Brief,
    QR,
    QRContent,
    FormatMap,
    SearchGroup,
} from "./types"

export { default as Bibliotheque } from "./routes/Bibliotheque"
