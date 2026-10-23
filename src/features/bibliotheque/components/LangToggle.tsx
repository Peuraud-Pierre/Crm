// ── LangToggle.tsx ────────────────────────────────────────────────────────────
// RÔLE : Sélecteur de langue FR/EN réutilisable (groupe de boutons radio
// accessibles), utilisé à la fois par BiblioToolbar (barre supérieure) et
// FormatPanel (bascule locale de la langue affichée dans les réponses).
//
// Accessibilité : les deux boutons forment un "radiogroup" ARIA. Le focus
// clavier suit le pattern "roving tabIndex" : seul le bouton actif a
// tabIndex=0 (inclus dans la navigation Tab), l'autre a tabIndex=-1. La
// navigation entre les deux se fait avec les flèches directionnelles.
//
// Props :
//   lang      → langue active
//   setLang   → setter (vient du contexte BiblioContext chez l'appelant)
//   label     → ui.langSelectorLabel (aria-label du radiogroup, déjà traduit)
//   labelFr / labelEn → ui.langFr / ui.langEn (déjà traduits)
//   className → classes additionnelles sur le conteneur (ex. largeur, flex-1 des boutons)
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/BiblioToolbar.tsx
//   - components/FormatPanel.tsx

import { useRef } from "react"
import { cn } from "@/shared/lib/utils"
import type { Lang } from "../types"

export function LangToggle({ lang, setLang, label, labelFr, labelEn, className }: {
    lang: Lang
    setLang: (lang: Lang) => void
    label: string
    labelFr: string
    labelEn: string
    className?: string
}) {
    // useRef(null) crée une "référence" : une boîte mutable qui, une fois attachée
    // à un élément via l'attribut ref={...} du JSX, donne un accès direct à
    // l'élément DOM réel (ici les <button> FR/EN plus bas). Contrairement à
    // useState, changer une ref ne redéclenche pas de rendu.
    // Utilisées par handleLangKey pour déplacer le focus au clavier.
    const frRef = useRef<HTMLButtonElement>(null)
    const enRef = useRef<HTMLButtonElement>(null)

    // Navigation clavier dans le radiogroup : flèche gauche/droite ou haut/bas
    // bascule la langue ET déplace le focus sur le bouton sélectionné.
    function handleLangKey(e: React.KeyboardEvent<HTMLButtonElement>, current: Lang) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowUp") return
        e.preventDefault() // empêche le scroll de la page avec les flèches
        const next: Lang = current === "fr" ? "en" : "fr"
        setLang(next)
        const targetRef = next === "fr" ? frRef : enRef
        targetRef.current?.focus() // déplace le focus sur le bouton cible
    }

    return (
        <div role="radiogroup" aria-label={label} className={cn("flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1", className)}>
            <button
                ref={frRef}
                type="button"
                role="radio"
                aria-checked={lang === "fr"}
                tabIndex={lang === "fr" ? 0 : -1}
                onClick={() => setLang("fr")}
                onKeyDown={(e) => handleLangKey(e, "fr")}
                className={cn(
                    "flex-1 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    lang === "fr"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                🇫🇷 {labelFr}
            </button>
            <button
                ref={enRef}
                type="button"
                role="radio"
                aria-checked={lang === "en"}
                tabIndex={lang === "en" ? 0 : -1}
                onClick={() => setLang("en")}
                onKeyDown={(e) => handleLangKey(e, "en")}
                className={cn(
                    "flex-1 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    lang === "en"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                🇬🇧 {labelEn}
            </button>
        </div>
    )
}
