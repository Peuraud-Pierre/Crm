// ── MaskIcon.tsx ──────────────────────────────────────────────────────────────
// RÔLE : Icône SVG colorisable via CSS mask, sans dupliquer le fichier SVG par couleur.
//
// Pourquoi un CSS mask plutôt qu'un <img> classique :
//   Un <img src="icon.svg"> affiche le SVG avec SES couleurs propres, figées dans
//   le fichier. Pour une icône qui doit suivre la couleur du texte environnant
//   (bg-current), du thème (bg-foreground) ou du vert de marque (bg-brand) SANS avoir
//   à maintenir un fichier SVG par couleur, on utilise le SVG comme MASQUE sur un
//   fond coloré en Tailwind : le mask définit la FORME, le fond définit la couleur.
//   WebkitMaskImage est nécessaire en plus de maskImage pour Safari (pas encore
//   aligné sur la propriété standard sans préfixe).
//
// Ce composant existait auparavant recopié à la main (style={{ WebkitMaskImage... }})
// dans 6 fichiers différents (ThematiqueItem, QRCard, QRDetailPanel, BriefPanel,
// FormatPanel, BiblioSidebar) — extrait ici pour que toute évolution de la
// technique (ex: migration vers des sprites SVG) ne se fasse qu'à un seul endroit.
//
// `className` porte la taille (w-8 h-8) ET la couleur (bg-foreground / bg-brand /
// bg-current) — volontairement laissé au consommateur plutôt que figé ici, chaque
// usage ayant sa propre combinaison taille/couleur.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/ThematiqueItem.tsx, QRCard.tsx, QRDetailPanel.tsx, BriefPanel.tsx,
//     FormatPanel.tsx, BiblioSidebar.tsx, FormatToggleButton.tsx, FormatEditDialog.tsx

import { cn } from "@/shared/lib/utils"

// cn() est une petite fonction utilitaire qui assemble plusieurs chaînes de
// classes CSS (Tailwind) en une seule, en gérant proprement les conflits.
// Ici elle fusionne la classe fixe "shrink-0" avec le "className" reçu en prop.
export function MaskIcon({ src, className }: {
    src: string        // chemin de l'icône SVG (ex: "/bibliotheque/icons/question.svg")
    className?: string // taille (w-* h-*) + couleur de fond (bg-*) + éventuel shrink-0
}) {
    return (
        <span
            className={cn("shrink-0", className)}
            style={{
                WebkitMaskImage: `url(${src})`, WebkitMaskSize: "contain",
                maskImage: `url(${src})`, maskSize: "contain",
            }}
        />
    )
}
