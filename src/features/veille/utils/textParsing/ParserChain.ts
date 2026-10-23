import type { TextParser, ParseContext, ParseResult } from "./types"

export class ParserChain {
    private parsers: TextParser[] = []

    constructor(parsers: TextParser[] = []) {
        // Sort by priority (highest first)
        this.parsers = [...parsers].sort(
            (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        )
    }

    addParser(parser: TextParser): ParserChain {
        this.parsers.push(parser)
        // Re-sort after adding
        this.parsers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        return this
    }

    parse(context: ParseContext): ParseResult {
        // Try each parser in order until one succeeds
        for (const parser of this.parsers) {
            if (parser.canParse(context.text)) {
                const result = parser.parse(context)
                if (result.success) {
                    return result
                }
            }
        }

        // Should never reach here if PlainTextParser is included
        return { success: false, content: null }
    }
}
