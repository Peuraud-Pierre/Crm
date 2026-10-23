import type { TextParser, ParseContext, ParseResult } from "../types"
import { renderBold } from "../renderBold"

export class HyphenListParser implements TextParser {
    priority = 70

    canParse(text: string): boolean {
        const trimmed = text.trim()
        // Check if text starts with hyphen (including Unicode variants)
        const startsWithHyphen = /^[-–—]\s/.test(trimmed)
        // Check for multiple hyphen-separated lines
        const hasMultipleHyphenLines = (trimmed.match(/\n[-–—]\s/g) || [])
            .length >= 1

        return startsWithHyphen || hasMultipleHyphenLines
    }

    parse(context: ParseContext): ParseResult {
        const items = this.extractHyphenItems(context.text)

        if (items.length === 0) {
            return { success: false, content: null }
        }

        return {
            success: true,
            content: (
                <ul className="list-none pl-0 space-y-2">
                    {items.map((item) => (
                        <li
                            key={item}
                            className="text-sm leading-relaxed flex items-start gap-2"
                        >
                            <span className="flex-shrink-0 text-muted-foreground select-none">
                                •
                            </span>
                            <div className="flex-1 min-w-0 break-words">
                                {renderBold(item, context.theme.bold)}
                            </div>
                        </li>
                    ))}
                </ul>
            ),
        }
    }

    private extractHyphenItems(text: string): string[] {
        const trimmed = text.trim()
        const items: string[] = []

        // Try regex-based extraction for line-start hyphens (handles multiline items)
        const hyphenListRegex = /^[-–—]\s+(.+?)(?=\n[-–—]\s+|\n*$)/gms
        let match

        while ((match = hyphenListRegex.exec(trimmed)) !== null) {
            const content = match[1].trim()
            // Only add if content is not empty and not just hyphens
            if (content && !/^[-–—\s]*$/.test(content)) {
                items.push(content)
            }
        }

        // If regex extraction worked, return those items
        if (items.length > 0) {
            return items
        }

        // Fallback: split on " - " for inline hyphen-separated format
        const fallbackItems = trimmed
            .split(" - ")
            .map((s) => s.trim())
            .filter(Boolean)

        // Clean up first item if string starts with hyphen
        if (fallbackItems.length > 0 && /^[-–—]/.test(fallbackItems[0])) {
            fallbackItems[0] = fallbackItems[0].replace(/^[-–—]\s*/, "").trim()
        }

        // Filter out empty items and items that are only hyphens/whitespace
        return fallbackItems.filter(item => item && !/^[-–—\s]*$/.test(item))
    }
}
