// ── BiblioToolbar.tsx ─────────────────────────────────────────────────────────
// RÔLE : Barre supérieure de la page Bibliothèque.
//
// Contient :
//   1. Un sélecteur de langue FR/EN (groupe de boutons radio accessibles)
//   2. Une barre de recherche (avec bouton ✕ pour effacer)
//
// Accessibilité du sélecteur de langue :
//   Les deux boutons forment un "radiogroup" ARIA. Le focus clavier suit le
//   pattern "roving tabIndex" : seul le bouton actif a tabIndex=0 (inclus dans
//   la navigation Tab), l'autre a tabIndex=-1 (exclu). La navigation entre les
//   deux se fait avec les flèches directionnelles (handleLangKey).
//
// Aucune prop : toutes les données viennent du contexte BiblioContext.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/BiblioSidebar.tsx → rendu en haut de la colonne gauche (vue normale)
//   - components/SearchResults.tsx → rendu en haut de la colonne gauche (vue recherche)
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit lang, searchQuery, ui et les setters

import { useBiblioContext } from "../context/BiblioContext"
import { Input } from "@/shared/ui/atoms/input"
import { LangToggle } from "./LangToggle"
import { Search, X } from "lucide-react"

export function BiblioToolbar() {
    const { nav: { lang, setLang, searchQuery, setSearchQuery, ui } } = useBiblioContext()

    return (
        <div className="pb-3 shrink-0 flex flex-col gap-2">
            {/* Sélecteur FR / EN — largeur alignée sur la barre de recherche juste en dessous,
                les deux boutons se partageant l'espace à parts égales (flex-1). */}
            <LangToggle lang={lang} setLang={setLang} label={ui.langSelectorLabel} labelFr={ui.langFr} labelEn={ui.langEn} />

            {/* Barre de recherche — l'icône X n'apparaît que si du texte est saisi */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    type="text"
                    aria-label={ui.searchPlaceholder}
                    value={searchQuery}
                    // onChange se déclenche à chaque frappe dans le champ ; e.target.value
                    // est le texte actuel de l'input, qu'on stocke via setSearchQuery pour
                    // que React re-rende le composant avec la nouvelle valeur.
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={ui.searchPlaceholder}
                    className="pl-9 pr-9"
                />
                {/* Rendu conditionnel avec && : le bouton ✕ n'apparaît que si searchQuery
                    contient du texte (chaîne non vide = "truthy" en JavaScript). */}
                {searchQuery && (
                    <button
                        type="button"
                        aria-label={ui.clearSearch}
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
