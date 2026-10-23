import type { ReactNode } from "react"
import { ParserChain } from "./ParserChain"
import { JsonParser } from "./parsers/JsonParser"
import { NumberedListParser } from "./parsers/NumberedListParser"
import { HyphenListParser } from "./parsers/HyphenListParser"
import { PlainTextParser } from "./parsers/PlainTextParser"
import { COLOR_THEMES, type ColorTheme } from "./themes"

// Singleton instance for performance
let parserChain: ParserChain | null = null

function getParserChain(): ParserChain {
    if (!parserChain) {
        parserChain = new ParserChain([
            new JsonParser(),
            new NumberedListParser(),
            new HyphenListParser(),
            new PlainTextParser(), // Fallback
        ])
    }
    return parserChain
}

/**
 * Formats text by detecting its structure and rendering accordingly.
 * Supports: JSON arrays, numbered lists, hyphen lists, and plain text.
 *
 * @param text - The text to format
 * @param color - The color theme to apply
 * @returns Formatted React nodes
 */
export function formatText(
    text: string | undefined,
    color: ColorTheme = "muted"
): ReactNode {
    if (!text) return null

    const chain = getParserChain()
    const theme = COLOR_THEMES[color]

    const result = chain.parse({
        text: text.trim(),
        theme,
    })

    return result.content
}
