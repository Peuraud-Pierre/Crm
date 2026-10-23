// ── QRCard.tsx ────────────────────────────────────────────────────────────────
// RÔLE : Carte d'affichage d'une Question / Réponse dans la colonne principale.
//
// Fonctionnalités :
//   - Affiche la question (avec icône) et la réponse (brief)
//   - "Voir plus / Voir moins" : si la réponse dépasse 5 lignes, un bouton
//     permet de l'étendre. La détection du débordement utilise ResizeObserver
//     (plus fiable qu'un calcul de hauteur au montage).
//   - Bouton "Formater" : ouvre FormatViewDialog (pop-up des réponses par canal)
//   - Boutons Modifier (ouvre QRFormDialog) et Supprimer (ouvre DeleteQRDialog)
//
// Composant PUR (pas d'appel à useBiblioContext) : contrairement à la plupart
// des composants de la feature, il reçoit tout en props (qr + canManage/lang/ui
// + callbacks) plutôt que de lire le contexte directement. But : ce composant
// est répété une fois par Q&R affichée (voir BiblioMainColumn) ; s'il lisait le
// contexte lui-même, CHAQUE carte re-rendrait à chaque changement de contexte,
// même sans rapport avec elle (ex: ouverture d'un dialog ailleurs sur la page).
// En le rendant pur et en l'enveloppant dans memo() (voir export en bas), React
// peut sauter son rendu tant que ses props ne changent pas réellement — les
// callbacks reçus (onEdit/onDelete/onViewFormat) doivent donc être des
// références STABLES d'un rendu à l'autre (voir useDialog.ts : openEditQR/
// openDeleteQR/openViewFormat sont mémoïsées avec des dépendances vides), sans
// quoi memo() serait inefficace (nouvelle référence de fonction à chaque rendu
// du parent = memo échoue toujours sa comparaison).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/BiblioMainColumn.tsx → rendu pour chaque Q&R de activeQRs,
//     lui transmet canManage/lang/ui/callbacks lus depuis le contexte

import { memo, useState, useRef, useEffect } from "react"
import type { QR, Lang } from "../types"
import type { UI } from "../constants"
import { tQuestion, tReponse } from "../utils"
import { MaskIcon } from "./MaskIcon"
import { FormatToggleButton } from "./FormatToggleButton"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { Pencil, Trash2 } from "lucide-react"

interface QRCardProps {
    qr: QR
    canManage: boolean
    lang: Lang
    ui: UI
    onEdit: (qr: QR) => void
    onDelete: (qr: QR) => void
    onViewFormat: (qr: QR) => void
}

function QRCardImpl({ qr, canManage, lang, ui, onEdit, onDelete, onViewFormat }: QRCardProps) {

    // "Voir plus / Voir moins" sur le brief de la question.
    // useState crée une variable réactive : quand on appelle setExpanded/setIsOverflowing,
    // React se souvient de la nouvelle valeur ET redessine (re-rend) ce composant
    // pour refléter le changement à l'écran.
    const [expanded, setExpanded] = useState(false)
    const [isOverflowing, setIsOverflowing] = useState(false)
    // useRef crée une "boîte" (briefRef.current) qui, une fois attachée à un élément
    // JSX via l'attribut ref={...}, donne un accès direct à cet élément du DOM
    // (ici le <p> du brief) — utile pour lire ses dimensions réelles (scrollHeight,
    // clientHeight) sans passer par le state.
    const briefRef = useRef<HTMLParagraphElement>(null)

    // useEffect exécute du code "à côté" du rendu, après que React a mis à jour
    // l'écran. Le tableau [qr.id, lang] à la fin est la liste de dépendances :
    // cet effet ne se relance QUE si qr.id ou lang change entre deux rendus.
    // Ici, on réinitialise l'état d'expansion quand on change de Q&R ou de langue.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resync d'un état local (toggle utilisateur) sur changement de source, non dérivable des props
    useEffect(() => { setExpanded(false) }, [qr.id, lang])

    // Détecte le débordement via ResizeObserver : se déclenche après layout complet
    // (chargement de police inclus) et répond aux redimensionnements de conteneur.
    // Actif uniquement quand le texte est replié ; les callbacks sont batchés par le
    // navigateur, ce qui évite le layout thrashing sur de nombreuses cards simultanées.
    useEffect(() => {
        const el = briefRef.current
        if (!el || expanded) return
        // ResizeObserver est une API navigateur qui appelle sa fonction de callback
        // chaque fois que la taille de l'élément observé change (police chargée,
        // fenêtre redimensionnée...). scrollHeight = hauteur totale du contenu texte,
        // clientHeight = hauteur visible réellement (limitée par line-clamp-5) :
        // si le contenu est plus grand que ce qui est visible, le texte déborde.
        const observer = new ResizeObserver(() => {
            setIsOverflowing(el.scrollHeight > el.clientHeight)
        })
        observer.observe(el)
        // Fonction de nettoyage : useEffect peut renvoyer une fonction, exécutée
        // quand le composant est démonté ou juste avant que l'effet se relance.
        // Ici elle arrête l'observation pour éviter les fuites mémoire.
        return () => observer.disconnect()
    }, [expanded])

    return (
        <Card variant="elevated" className="h-full flex flex-col">
            <CardContent className="flex-1 flex flex-col p-4 space-y-2">
                {/* Titre de la question avec icône */}
                <div className="flex items-center gap-2 min-w-0">
                    <MaskIcon src="/bibliotheque/icons/question.svg" className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-foreground" />
                    <p className="font-semibold text-sm text-foreground min-w-0 break-words">{tQuestion(qr, lang)}</p>
                </div>
                {/* Brief : limité à 5 lignes, avec "Voir plus" si le texte déborde */}
                <p ref={briefRef}
                    className={`text-sm text-muted-foreground whitespace-pre-wrap break-words${expanded ? "" : " line-clamp-5"}`}
                >
                    {tReponse(qr, lang)}
                </p>
                {/* Rendu conditionnel avec `&&` : le bouton "Voir plus/moins" n'apparaît
                    que si le texte déborde réellement (isOverflowing est truthy). */}
                {isOverflowing && (
                    <button type="button"
                        className="flex items-center gap-1 self-start py-1 text-xs font-bold text-brand hover:underline"
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {expanded ? ui.showLess : ui.showMore}
                        <MaskIcon
                            src={expanded ? "/bibliotheque/icons/voirmoins.svg" : "/bibliotheque/icons/voirplus.svg"}
                            className="w-3 h-3 bg-brand"
                        />
                    </button>
                )}

                {/* Barre d'actions : mt-auto la colle au bord inférieur du Card, même quand
                    le texte de la question/réponse est plus court que les cartes voisines
                    dans la même ligne de la grille (grid-cols-2, les cartes s'étirent à la
                    même hauteur par défaut). */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 mt-auto border-t border-border">
                    {/* Modifier / Supprimer réservés à bibliotheque.manage ;
                        « Formats » reste accessible, c'est de la consultation. */}
                    {canManage && (
                        <>
                            <Button variant="ghost" size="sm"
                                className="h-9 sm:h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-accent-foreground"
                                onClick={() => onEdit(qr)}
                            >
                                <Pencil className="w-3.5 h-3.5" /><span className="ml-1">{ui.edit}</span>
                            </Button>
                            <Button variant="ghost" size="sm"
                                className="h-9 sm:h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-accent-foreground"
                                onClick={() => onDelete(qr)}
                            >
                                <Trash2 className="w-3.5 h-3.5" /><span className="ml-1">{ui.delete}</span>
                            </Button>
                        </>
                    )}

                    <FormatToggleButton onClick={() => onViewFormat(qr)} label={ui.format} className="ml-auto" />
                </div>
            </CardContent>
        </Card>
    )
}

// memo() : évite de ré-exécuter le rendu de cette carte quand ses props n'ont
// pas changé — utile car BiblioMainColumn en affiche plusieurs à la fois, et
// tout changement de contexte ailleurs sur la page (ouverture d'un dialog non
// lié, etc.) recréerait sinon un nouveau rendu pour CHAQUE carte affichée.
export const QRCard = memo(QRCardImpl)
