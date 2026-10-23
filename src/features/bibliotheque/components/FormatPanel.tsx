// ── FormatPanel.tsx ───────────────────────────────────────────────────────────
// RÔLE : Panneau des réponses formatées par canal de communication.
//
// Affiche les réponses préparées pour trois canaux : Email, DM Instagram, WhatsApp.
// Chaque canal a sa propre formulation (longueur, ton, emojis adaptés).
//
// Fonctionnalités :
//   - Onglets de canal : bascule entre Email / DM / WhatsApp
//   - Zone de texte en lecture seule avec la réponse du canal actif
//   - Bouton "Copier" avec feedback visuel (icône ✓ pendant 2 secondes)
//   - Hint de style (ui.formatHints[tab]) : conseil de rédaction par canal
//   - Bouton "Modifier" (masqué si readOnly) → ouvre FormatEditDialog
//
// copyTimeoutRef : évite d'accumuler des timers si on clique plusieurs fois.
// On annule le précédent timer avant d'en créer un nouveau.
//
// Props :
//   reponses  → données du canal (undefined = aucune réponse créée → message d'invite)
//   onEdit    → ouvre FormatEditDialog (pas appelé en mode readOnly)
//   readOnly  → cache le bouton Modifier. Ce composant ne sait pas POURQUOI il est
//               readOnly : c'est FormatViewDialog (son seul appelant) qui calcule
//               cette valeur à partir de la permission bibliotheque.manage (canManage).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/FormatViewDialog.tsx → seul appelant, lui passe readOnly selon canManage
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit lang, ui pour les textes et hints

import { useState, useRef, useEffect } from "react"
import type { FormatChannel, FormatMap } from "../types"
import { useBiblioContext } from "../context/BiblioContext"
import { tFormat } from "../utils"
import { toast } from "sonner"
import { FORMAT_LABELS, FORMAT_CHANNELS, iconPath } from "../constants"
import { MaskIcon } from "./MaskIcon"
import { LangToggle } from "./LangToggle"
import { Button } from "@/shared/ui/atoms/button"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { cn } from "@/shared/lib/utils"
import { Pencil, Copy, Check } from "lucide-react"

export function FormatPanel({ reponses, onEdit = () => { }, readOnly = false }: {
    reponses: FormatMap | undefined  // undefined = aucune réponse formatée encore créée
    onEdit?: () => void              // ouvre le dialog d'édition des formats (inutile en readOnly)
    readOnly?: boolean               // true si l'utilisateur n'a pas la permission bibliotheque.manage
}) {
    const { nav: { ui, lang, setLang } } = useBiblioContext()

    // Onglet actif : "email" | "instagram" | "whatsapp"
    const [tab, setTab] = useState<FormatChannel>("email")

    // copied : true pendant 2 secondes après un clic "Copier" → affiche l'icône ✓
    const [copied, setCopied] = useState(false)
    // copyTimeoutRef : référence vers le timer actif (null = aucun timer)
    // On le stocke dans une ref (pas un state) car modifier ce timer ne doit
    // pas déclencher un re-render du composant.
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Nettoyage du timer si le composant est démonté pendant les 2 secondes
    useEffect(() => {
        return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current) }
    }, [])

    function handleCopy() {
        if (!reponses) return
        // navigator.clipboard.writeText est une API navigateur asynchrone (Promise)
        navigator.clipboard.writeText(tFormat(reponses, tab, lang))
            .then(() => {
                // Annule un éventuel timer précédent (double-clic rapide)
                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
                setCopied(true)
                // Remet copied à false après 2 secondes
                copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
            })
            .catch(() => toast.error(ui.errCopy)) // toast d'erreur si le presse-papier est bloqué
    }

    return (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                {/* Onglets des canaux */}
                <div className="flex gap-1.5">
                    {/* .map() parcourt le tableau FORMAT_CHANNELS et transforme chaque
                        élément en bouton JSX. "key" est une prop spéciale React (pas
                        transmise au composant) qui aide React à savoir quel bouton a
                        changé/bougé quand la liste se met à jour, sans devoir tout
                        redessiner. */}
                    {FORMAT_CHANNELS.map((key) => (
                        <button key={key} type="button"
                            onClick={() => {
                                setTab(key)
                                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
                                setCopied(false)
                            }}
                            className={cn(
                                // cn() combine plusieurs classes CSS et enlève les doublons/
                                // conflits (ex: deux couleurs de fond). Ici on choisit un jeu
                                // de classes différent selon que cet onglet est actif (tab === key)
                                // ou non — c'est une "classe conditionnelle" avec l'opérateur ternaire (? :).
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                tab === key
                                    ? "bg-card text-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <MaskIcon src={iconPath(key)} className="w-6 h-6 bg-current" />
                            {FORMAT_LABELS[key]}
                        </button>
                    ))}
                </div>
                {/* Bouton Modifier masqué en mode lecture seule */}
                {!readOnly && (
                    <Button variant="ghost" size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-accent-foreground gap-1"
                        onClick={onEdit}
                    >
                        <Pencil className="w-3 h-3" /> {ui.edit}
                    </Button>
                )}
            </div>

            {/* Toggle FR / EN local au panneau : bascule la langue affichée dans les
                réponses formatées (même source que le sélecteur de BiblioToolbar). */}
            <LangToggle lang={lang} setLang={setLang} label={ui.langSelectorLabel} labelFr={ui.langFr} labelEn={ui.langEn} className="w-fit" />

            {/* Rendu conditionnel avec l'opérateur ternaire (condition ? a : b) :
                si "reponses" existe, on affiche le contenu formaté ; sinon, on
                affiche un message d'invite (voir le bloc "else" plus bas). */}
            {reponses ? (
                <>
                    {/* Textarea en lecture seule : affiche le texte du canal actif */}
                    <div className="relative">
                        <Textarea readOnly tabIndex={-1} value={tFormat(reponses, tab, lang)} rows={20}
                            className="resize-none bg-card border-border text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {/* Bouton Copier positionné en absolu en bas à droite, en variant
                            "default" (même couleur que le bouton {ui.newTopic} de
                            BiblioSidebar) pour bien le mettre en valeur. */}
                        <Button size="sm" variant="default" onClick={handleCopy}
                            className="absolute bottom-2 right-2 h-7 gap-1.5 text-xs"
                        >
                            {copied
                                ? <><Check className="w-3 h-3" /> {ui.copied}</>
                                : <><Copy className="w-3 h-3" /> {ui.copy}</>}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground italic">{ui.formatHints[tab]}</p>
                </>
            ) : (
                // Message si aucune réponse formatée n'existe encore
                <p className="text-sm text-muted-foreground text-center py-2">
                    {readOnly ? ui.noFormattedReadOnly : ui.noFormatted}
                </p>
            )}
        </div>
    )
}
