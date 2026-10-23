// ── ThematiqueItem.tsx ────────────────────────────────────────────────────────
// RÔLE : Ligne de la sidebar représentant une thématique.
//
// Visuellement :
//   - Icône + libellé + badge de comptage (ex: 5 Q&R)
//   - Au survol ou au focus clavier : le badge est remplacé par deux icônes
//     (crayon pour renommer, poubelle pour supprimer)
//
// Accessibilité :
//   Les icônes d'action sont des <button> séparés positionnés en absolu
//   (le HTML interdit d'imbriquer un <button> dans un autre <button>).
//   Elles sont cachées visuellement (opacity-0) mais restent dans le tab order
//   du clavier, et la classe focus-within les rend visibles au focus.
//
// Composant pur : aucun import de contexte ni de hook — toutes les données et
// callbacks viennent via props. Cela le rend testable et réutilisable.
//
// onClick/onRename/onDelete reçoivent `id` (pas un objet Thematique complet) et
// sont enveloppés dans memo() (voir export en bas) : BiblioSidebar en affiche un
// par thématique, et lui faire lire le contexte directement aurait re-rendu
// TOUTES les lignes à chaque changement de contexte, même sans rapport avec
// elles (même raisonnement que QRCard, voir son en-tête). Pour que memo()
// serve à quelque chose, BiblioSidebar doit passer des callbacks à référence
// STABLE (voir ses useCallback) plutôt qu'une fonction fléchée recréée à
// chaque rendu pour chaque ligne.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/BiblioSidebar.tsx → rendu pour chaque thématique

import { memo } from "react"
import { cn } from "@/shared/lib/utils"
import { MaskIcon } from "./MaskIcon"
import { Pencil, Trash2 } from "lucide-react"

interface ThematiqueItemProps {
    id: string               // identifiant de la thématique, transmis aux callbacks
    label: string             // libellé de la thématique dans la langue active
    iconUrl?: string | null   // URL de l'icône (optionnelle)
    count: number             // nombre de Q&R dans cette thématique
    active: boolean           // true si c'est la thématique sélectionnée
    onClick: (id: string) => void // appelée quand on clique sur le bouton principal
    // onRename/onDelete sont omises quand l'utilisateur n'a pas
    // bibliotheque.manage : les icônes d'action ne sont alors pas rendues.
    onRename?: (id: string) => void // appelée quand on clique sur l'icône crayon
    onDelete?: (id: string) => void // appelée quand on clique sur l'icône poubelle
    renameLabel: string       // aria-label du bouton renommer
    deleteLabel: string       // aria-label du bouton supprimer
}

function ThematiqueItemImpl({ id, label, iconUrl, count, active, onClick, onRename, onDelete, renameLabel, deleteLabel }: ThematiqueItemProps) {
    const showActions = Boolean(onRename && onDelete)
    return (
        // Wrapper relatif portant le groupe hover.
        // Les icônes d'action sont positionnées en absolu pour ne pas être
        // imbriquées dans le <button> principal (le HTML interdit les <button>
        // imbriqués). Elles s'affichent en overlay sur le compteur au survol
        // ou quand l'une d'elles reçoit le focus clavier (focus-within sur le conteneur).
        <div className="relative group w-full">
            <button
                type="button"
                aria-current={active || undefined}
                onClick={() => onClick(id)}
                className={cn(
                    // cn() fusionne la classe de base avec un jeu de classes différent
                    // selon que cette thématique est la sélectionnée (active) ou non.
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                    active
                        ? "bg-brand/10 text-brand border-l-2 border-brand font-medium pl-2.5"
                        : "text-foreground hover:bg-muted"
                )}
            >
                {/* Groupe gauche : icône + label — flex-1 garantit l'ancrage à gauche */}
                <span className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Rendu conditionnel avec `&&` : l'icône ne s'affiche que si une
                        iconUrl a été fournie (prop optionnelle). */}
                    {iconUrl && <MaskIcon src={iconUrl} className="w-4 h-4 bg-current" />}
                    <span className="truncate">{label}</span>
                </span>

                {/* Compteur — masqué au survol par les icônes en absolu. Sans
                    icônes d'action (lecture seule), il reste visible : sinon il
                    disparaîtrait au survol sans que rien ne le remplace. */}
                <span className={cn(
                    "shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium",
                    showActions && "group-hover:invisible",
                    active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                )}>
                    {count}
                </span>
            </button>

            {/* Icônes d'action — en absolu pour ne pas nicher dans le <button>.
                opacity-0 + pointer-events-none : visuellement absentes mais dans
                le tab order. Visibles sur hover (groupe) ou focus clavier (focus-within
                scoped à ce conteneur — ne se déclenche PAS sur le bouton principal).
                "group"/"group-hover:" et "focus-within:" sont des classes Tailwind :
                le parent porte "group", et group-hover:X applique la classe X quand on
                survole ce parent ; focus-within:X l'applique quand un enfant de CE
                conteneur (pas forcément l'icône elle-même) a le focus clavier. */}
            {onRename && onDelete && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity items-center gap-0.5">
                    <button
                        type="button"
                        aria-label={renameLabel}
                        onClick={() => onRename?.(id)}
                        className="p-0.5 rounded hover:bg-brand/20 text-muted-foreground hover:text-brand transition-colors"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        aria-label={deleteLabel}
                        onClick={() => onDelete?.(id)}
                        className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    )
}

// memo() : évite de ré-exécuter le rendu de cette ligne quand ses props n'ont
// pas changé — utile car BiblioSidebar en affiche une par thématique (voir
// l'en-tête du fichier).
export const ThematiqueItem = memo(ThematiqueItemImpl)
