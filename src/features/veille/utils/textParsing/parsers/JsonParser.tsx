import type { TextParser, ParseContext, ParseResult } from "../types"
import { renderBold } from "../renderBold"

export class JsonParser implements TextParser {
    priority = 100 // Highest priority

    canParse(text: string): boolean {
        const trimmed = text.trim()
        return (
            (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
            (trimmed.startsWith("{") && trimmed.endsWith("}"))
        )
    }

    parse(context: ParseContext): ParseResult {
        try {
            let textToParse = context.text.trim()

            // Handle custom format {item1, item2, item3}
            if (textToParse.startsWith("{") && textToParse.endsWith("}")) {
                textToParse = `[${textToParse.slice(1, -1)}]`
            }

            const parsed = JSON.parse(textToParse)
            const items = this.extractItems(parsed)

            if (items.length > 0) {
                return {
                    success: true,
                    content: (
                        <ul className="list-disc pl-5 space-y-2">
                            {items.map((item) => (
                                <li
                                    key={item}
                                    className="text-sm leading-relaxed break-words"
                                >
                                    {renderBold(item, context.theme.bold)}
                                </li>
                            ))}
                        </ul>
                    ),
                }
            }
        } catch {
            // Parsing failed, not JSON
        }

        return { success: false, content: null }
    }

    private extractItems(parsed: unknown): string[] {
        if (Array.isArray(parsed)) {
            return parsed.map(String)
        } else if (typeof parsed === "object" && parsed !== null) {
            return Object.values(parsed).map(String)
        }
        return []
    }
}
