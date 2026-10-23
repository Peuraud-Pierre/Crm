// Main exports
export { formatText } from "./formatText"
export { renderBold } from "./renderBold"
export { ParserChain } from "./ParserChain"

// Type exports
export type { TextParser, ParseContext, ParseResult, ThemeConfig } from "./types"
export type { ColorTheme } from "./themes"
export { COLOR_THEMES } from "./themes"

// Parser exports (for extensibility)
export { JsonParser } from "./parsers/JsonParser"
export { NumberedListParser } from "./parsers/NumberedListParser"
export { HyphenListParser } from "./parsers/HyphenListParser"
export { PlainTextParser } from "./parsers/PlainTextParser"
