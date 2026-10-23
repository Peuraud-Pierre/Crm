import { useEffect, useRef, useState } from "react"

/**
 * Détecte qu'une icône injectée par un gestionnaire de mots de passe
 * (Passbolt, 1Password, LastPass, Dashlane, Bitwarden, ...) recouvre la zone
 * droite d'un champ, là où vit notre bouton « œil ».
 *
 * Pourquoi on ne peut PAS se contenter de chercher des classes/iframes dans le
 * document : ces extensions rendent leur UI dans un **Shadow DOM** rattaché à
 * un hôte en `position: fixed` sur le <body> (ex. Passbolt). `querySelectorAll`
 * ne traverse pas le Shadow DOM, donc l'overlay reste invisible.
 *
 * La seule détection robuste qui traverse le Shadow DOM est
 * `document.elementFromPoint` : on regarde quel élément est réellement au-dessus
 * de l'emplacement de l'œil. Si ce n'est ni notre bouton ni notre champ, c'est
 * qu'un overlay externe le recouvre.
 *
 * Retourne une `ref` à poser sur le conteneur (`position: relative`) du champ
 * et un booléen `hasOverlay`.
 */

export function usePasswordManagerOffset<
    T extends HTMLElement = HTMLDivElement,
>() {
    const ref = useRef<T | null>(null)
    const [hasOverlay, setHasOverlay] = useState(false)

    useEffect(() => {
        const container = ref.current
        if (!container || typeof document === "undefined") return

        let frame = 0
        const timeouts: ReturnType<typeof setTimeout>[] = []

        const detect = () => {
            const input = container.querySelector("input")
            if (!input) return

            const rect = input.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) return

            const y = rect.top + rect.height / 2

            // On sonde plusieurs points dans la zone droite du champ (là où les
            // extensions et notre œil se disputent la place).
            const xs = [rect.right - 10, rect.right - 18, rect.right - 26]

            let covered = false
            for (const x of xs) {
                const topEl = document.elementFromPoint(x, y)
                if (!topEl) continue
                // Élément qui nous appartient (champ, bouton, leur contenu) :
                // pas d'overlay.
                if (container.contains(topEl)) continue
                if (topEl === container) continue
                // Sinon c'est un élément étranger posé par-dessus (l'hôte du
                // Shadow DOM de l'extension, son iframe, etc.).
                covered = true
                break
            }

            setHasOverlay((prev) => (prev === covered ? prev : covered))
        }

        const scheduleDetect = () => {
            if (frame) cancelAnimationFrame(frame)
            frame = requestAnimationFrame(detect)
        }

        scheduleDetect()
        // L'overlay est souvent injecté/positionné quelques centaines de ms
        // après le rendu : on re-sonde plusieurs fois.
        for (const delay of [150, 400, 900, 1800]) {
            // Nettoyé dans le cleanup via la boucle `clearTimeout` ci-dessous.
            // eslint-disable-next-line react-web-api/no-leaked-timeout
            const timeout = setTimeout(scheduleDetect, delay)
            timeouts.push(timeout)
        }

        // L'hôte de l'extension est ajouté au <body> et repositionné
        // dynamiquement : on observe l'arbre, ainsi que scroll / resize / focus.
        const observer = new MutationObserver(scheduleDetect)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class"],
        })

        window.addEventListener("resize", scheduleDetect)
        window.addEventListener("scroll", scheduleDetect, true)
        container.addEventListener("focusin", scheduleDetect)

        return () => {
            if (frame) cancelAnimationFrame(frame)
            for (const t of timeouts) clearTimeout(t)
            observer.disconnect()
            window.removeEventListener("resize", scheduleDetect)
            window.removeEventListener("scroll", scheduleDetect, true)
            container.removeEventListener("focusin", scheduleDetect)
        }
    }, [])

    return { ref, hasOverlay }
}
