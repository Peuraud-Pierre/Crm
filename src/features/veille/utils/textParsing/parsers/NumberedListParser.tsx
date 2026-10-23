import type { TextParser, ParseContext, ParseResult } from "../types"
import { renderBold } from "../renderBold"

export class NumberedListParser implements TextParser {
    priority = 80

    canParse(text: string): boolean {
        // Check if text contains numbered items (1. 2. 3.)
        const numberedListRegex = /^\s*\d+\.\s+/m
        return numberedListRegex.test(text)
    }

    parse(context: ParseContext): ParseResult {
        const sections = this.extractNumberedSections(context.text)

        if (sections.length === 0) {
            return { success: false, content: null }
        }

        return {
            success: true,
            content: (
                <div className="flex flex-col gap-4">
                    {sections.map((section) => (
                        <div
                            key={section.number}
                            className="flex gap-3 items-start"
                        >
                            <span
                                className={`flex-shrink-0 font-bold tabular-nums ${context.theme.num}`}
                            >
                                {section.number}.
                            </span>
                            <div className="flex-1 text-sm leading-relaxed min-w-0 break-words">
                                {renderBold(section.content, context.theme.bold)}
                            </div>
                        </div>
                    ))}
                </div>
            ),
        }
    }

    private extractNumberedSections(
        text: string
    ): Array<{ number: string; content: string }> {
        const sections: Array<{ number: string; content: string }> = []
        const numberedListRegex = /(\d+)\.\s*(.*?(?=\s*\d+\.\s*|$))/gs
        let match

        while ((match = numberedListRegex.exec(text)) !== null) {
            if (match[2]) {
                sections.push({
                    number: match[1],
                    content: match[2].trim(),
                })
            }
        }

        return sections
    }
}
