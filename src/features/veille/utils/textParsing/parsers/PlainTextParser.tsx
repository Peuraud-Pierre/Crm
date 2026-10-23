import type { TextParser, ParseContext, ParseResult } from "../types"
import { renderBold } from "../renderBold"

export class PlainTextParser implements TextParser {
    priority = 0 // Lowest priority (fallback)

    canParse(): boolean {
        // Always returns true - this is the fallback parser
        return true
    }

    parse(context: ParseContext): ParseResult {
        return {
            success: true,
            content: (
                <div className="text-sm leading-relaxed break-words">
                    {renderBold(context.text.trim(), context.theme.bold)}
                </div>
            ),
        }
    }
}
