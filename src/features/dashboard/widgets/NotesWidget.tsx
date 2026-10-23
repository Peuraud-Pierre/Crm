import { useEffect, useRef, useState } from "react"
import type { WidgetProps } from "@/shared/types/widget.types"
import { SETTINGS_TEXT_MAX } from "../constants"

/** Au-delà, on affiche le compteur : avant, il ne fait que du bruit. */
const COUNTER_THRESHOLD = SETTINGS_TEXT_MAX - 500

/** Le texte n'est enregistré qu'une fois la frappe retombée. */
const SAVE_DEBOUNCE_MS = 800

/**
 * Bloc-notes personnel.
 *
 * Son contenu vit dans les réglages de l'instance, donc dans la même
 * ligne que la disposition : pas de table, pas de service, et deux
 * blocs-notes posés sur la même page ont chacun leur texte.
 *
 * Le champ n'a ni cadre ni fond propre — la carte en tient déjà lieu.
 * Un `<textarea>` bordé à l'intérieur d'une carte bordée donne deux
 * rectangles concentriques et un module qui a l'air d'un formulaire.
 *
 * Le réglage `title` n'est pas rendu ici : c'est `WidgetCard` qui
 * l'affiche dans l'en-tête de la carte, là où se trouve déjà le nom du
 * module. Le bloc ne le reprend que pour son étiquette d'accessibilité —
 * sans quoi trois blocs-notes s'annonceraient tous « Bloc-notes » à un
 * lecteur d'écran.
 */
export default function NotesWidget({
    settings,
    compact,
    onSettingsChange,
}: WidgetProps) {
    // Valeur initiale seulement : le champ est ensuite la source de
    // vérité de ce qu'on est en train d'écrire. Une réinitialisation du
    // tableau de bord remonte de nouvelles instances, donc un nouveau
    // `key` de carte, donc un composant neuf — pas besoin de
    // resynchroniser en cours de route.
    const [text, setText] = useState(() =>
        typeof settings.text === "string" ? settings.text : ""
    )

    const title =
        typeof settings.title === "string" && settings.title.trim() !== ""
            ? settings.title.trim()
            : "Bloc-notes"
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
        }
    }, [])

    function handleChange(value: string) {
        setText(value)

        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            onSettingsChange({ text: value })
        }, SAVE_DEBOUNCE_MS)
    }

    function flush() {
        if (timerRef.current === null) return
        clearTimeout(timerRef.current)
        timerRef.current = null
        onSettingsChange({ text })
    }

    return (
        <div className="flex h-full flex-col">
            <textarea
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={flush}
                maxLength={SETTINGS_TEXT_MAX}
                aria-label={title}
                placeholder="Ce que vous ne voulez pas oublier…"
                spellCheck
                className={
                    "min-h-0 flex-1 resize-none bg-transparent px-4 pb-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 " +
                    (compact ? "pt-0" : "pt-1")
                }
            />

            {text.length > COUNTER_THRESHOLD && (
                <p className="px-4 pb-2 text-right text-3xs text-muted-foreground">
                    {text.length} / {SETTINGS_TEXT_MAX}
                </p>
            )}
        </div>
    )
}
