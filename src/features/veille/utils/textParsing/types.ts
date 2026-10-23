import type { ReactNode } from "react"

export interface ParseContext {
    text: string
    theme: ThemeConfig
}

export interface ThemeConfig {
    num: string
    bold: string
}

export interface ParseResult {
    success: boolean
    content: ReactNode | null
}

export interface TextParser {
    // Returns true if this parser can handle the text
    canParse(text: string): boolean

    // Parses the text and returns formatted React nodes
    parse(context: ParseContext): ParseResult

    // Optional: priority for ordering parsers (higher = earlier)
    priority?: number
}
