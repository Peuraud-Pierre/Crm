import type { ReactNode } from "react"

/**
 * Rendu d'un markdown volontairement restreint.
 *
 * Pas de dépendance, et surtout **pas de `dangerouslySetInnerHTML`** : le
 * corps d'une annonce est saisi par un humain dans une console
 * d'administration, mais il finit affiché à toute l'entreprise. Le seul
 * moyen sûr de rendre du texte d'origine humaine est de produire des
 * nœuds React, jamais du HTML. Tout ce qui n'est pas reconnu ci-dessous
 * est rendu littéralement — un `<script>` tapé dans le champ s'affiche
 * comme le texte « <script> ».
 *
 * Ce qui est reconnu, et rien d'autre :
 *
 *   ## Intertitre
 *   - élément de liste
 *   **gras**, *italique*
 *   [texte](https://exemple.fr)
 *
 * Le sous-ensemble est petit à dessein. Une annonce est un article court ;
 * lui donner des tableaux et du code serait l'inviter à devenir autre
 * chose.
 */
export function renderMarkdown(source: string): ReactNode {
    const blocks: ReactNode[] = []
    const lines = source.replace(/\r\n/g, "\n").split("\n")

    let paragraph: string[] = []
    let list: string[] = []

    function flushParagraph() {
        if (paragraph.length === 0) return
        blocks.push(
            <p key={`b${blocks.length}`} className="leading-7">
                {renderInline(paragraph.join(" "))}
            </p>
        )
        paragraph = []
    }

    function flushList() {
        if (list.length === 0) return
        blocks.push(
            <ul key={`b${blocks.length}`} className="ml-5 list-disc space-y-1">
                {list.map((entry, index) => (
                    <li
                        // eslint-disable-next-line react-x/no-array-index-key -- deux éléments de liste peuvent être identiques ; l'indice les distingue
                        key={index}
                        className="leading-7"
                    >
                        {renderInline(entry)}
                    </li>
                ))}
            </ul>
        )
        list = []
    }

    for (const line of lines) {
        const trimmed = line.trim()

        if (trimmed === "") {
            flushParagraph()
            flushList()
            continue
        }

        const heading = /^#{2,3}\s+(.*)$/.exec(trimmed)
        if (heading) {
            flushParagraph()
            flushList()
            blocks.push(
                <h3
                    key={`b${blocks.length}`}
                    className="pt-2 text-lg font-semibold tracking-tight text-foreground"
                >
                    {renderInline(heading[1])}
                </h3>
            )
            continue
        }

        const bullet = /^[-*]\s+(.*)$/.exec(trimmed)
        if (bullet) {
            flushParagraph()
            list.push(bullet[1])
            continue
        }

        flushList()
        paragraph.push(trimmed)
    }

    flushParagraph()
    flushList()

    return blocks
}

/** `**gras**`, `*italique*`, `[texte](url)`. Le reste est du texte. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g

function renderInline(text: string): ReactNode[] {
    return text.split(INLINE).map((part, index) => {
        // Les fragments peuvent être identiques d'une occurrence à
        // l'autre ; leur position est ce qui les distingue.
        const key = index

        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
        if (link) {
            const href = safeHref(link[2])
            if (!href) return <span key={key}>{link[1]}</span>

            return (
                <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                >
                    {link[1]}
                </a>
            )
        }

        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={key} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                </strong>
            )
        }

        if (part.startsWith("*") && part.endsWith("*")) {
            return <em key={key}>{part.slice(1, -1)}</em>
        }

        return <span key={key}>{part}</span>
    })
}

/**
 * Normalise une URL saisie, et refuse tout ce qui n'est pas du web.
 *
 * `javascript:` et `data:` sont les deux schémas par lesquels un lien
 * devient une exécution : ils sont écartés, et le lien retombe alors sur
 * son libellé en texte simple.
 */
export function safeHref(url: string): string | null {
    const value = url.trim()
    if (!value) return null

    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`

    try {
        const parsed = new URL(candidate)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? parsed.toString()
            : null
    } catch {
        return null
    }
}
