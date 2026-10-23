# Text Parsing System

Ce module fournit un système modulaire et extensible pour parser et formater différents types de texte structuré.

## 🎯 Fonctionnalités

- **Parser JSON** : Arrays et objets JSON, y compris le format custom `{item1, item2, item3}`
- **Parser de listes numérotées** : Format `1. Item 2. Item 3. Item`
- **Parser de listes à tirets** : Format `- Item\n- Item` avec support des tirets Unicode (–, —)
- **Parser de texte brut** : Fallback pour tout texte non structuré
- **Support du formatage gras** : Syntaxe `**texte en gras**`

## 🏗️ Architecture

### Pattern Strategy + Chain of Responsibility

Chaque type de texte est géré par un parser dédié qui implémente l'interface `TextParser` :

```typescript
interface TextParser {
    canParse(text: string): boolean
    parse(context: ParseContext): ParseResult
    priority?: number
}
```

Les parsers sont organisés en chaîne et testés par ordre de priorité décroissante.

## 📁 Structure des fichiers

```
textParsing/
├── index.ts                    # Exports publics
├── types.ts                    # Interfaces TypeScript
├── themes.ts                   # Configurations de couleurs
├── renderBold.tsx              # Utilitaire pour le gras
├── ParserChain.ts              # Orchestrateur des parsers
├── formatText.tsx              # API principale
└── parsers/
    ├── JsonParser.tsx          # Parse les arrays/objets JSON
    ├── NumberedListParser.tsx  # Parse les listes numérotées
    ├── HyphenListParser.tsx    # Parse les listes à tirets
    └── PlainTextParser.tsx     # Fallback pour texte brut
```

## 🚀 Utilisation

### Usage basique

```typescript
import { formatText } from '@/features/veille/utils/textParsing'

// Texte simple
formatText("Un texte avec **du gras**", "muted")

// Liste à tirets
formatText("- Premier item\n- Deuxième item\n- Troisième item", "blue")

// Liste numérotée
formatText("1. Étape un 2. Étape deux 3. Étape trois", "green")

// JSON
formatText('["Item 1", "Item 2", "Item 3"]', "red")
```

### Thèmes disponibles

- `"muted"` : Gris/ardoise (par défaut)
- `"blue"` : Bleu
- `"red"` : Rouge
- `"green"` : Vert

## 🔧 Extensibilité

### Ajouter un nouveau parser

1. Créer un fichier dans `parsers/` :

```typescript
// parsers/MarkdownListParser.tsx
import type { TextParser, ParseContext, ParseResult } from "../types"
import { renderBold } from "../renderBold"

export class MarkdownListParser implements TextParser {
    priority = 75 // Entre NumberedList (80) et HyphenList (70)

    canParse(text: string): boolean {
        return /^\s*[\*\+]\s+/m.test(text)
    }

    parse(context: ParseContext): ParseResult {
        // Votre logique de parsing...
        return { success: true, content: <YourJSX /> }
    }
}
```

2. L'enregistrer dans la chaîne :

```typescript
// formatText.tsx
import { MarkdownListParser } from "./parsers/MarkdownListParser"

const chain = new ParserChain([
    new JsonParser(),
    new NumberedListParser(),
    new MarkdownListParser(), // 👈 Nouveau parser
    new HyphenListParser(),
    new PlainTextParser(),
])
```

## 🐛 Bug fixes

### Problème résolu : Tirets et retours à la ligne

**Ancien code** :
```typescript
const items = text.split(" - ") // ❌ Ne fonctionne qu'avec " - "
```

**Nouveau code** :
```typescript
const hyphenListRegex = /^[-–—]\s+(.+?)(?=\n[-–—]\s+|\n*$)/gms
// ✅ Supporte les tirets Unicode et les retours à ligne
```

### Améliorations CSS

- **Retiré** : `hyphens-auto` (nécessite `lang="fr"` sur `<html>`)
- **Conservé** : `break-words` pour le word-wrapping
- **Amélioré** : URLs utilisent maintenant `break-all` pour un meilleur rendu

## 🧪 Tests (à implémenter)

```typescript
describe('HyphenListParser', () => {
    it('parse les listes à tirets avec retours à ligne', () => {
        const parser = new HyphenListParser()
        const result = parser.parse({
            text: "- Item 1\n- Item 2\n- Item 3",
            theme: COLOR_THEMES.muted
        })
        expect(result.success).toBe(true)
    })
})
```

## 📊 Priorités des parsers

| Parser | Priorité | Raison |
|--------|----------|--------|
| JsonParser | 100 | Format le plus spécifique |
| NumberedListParser | 80 | Structure claire et explicite |
| HyphenListParser | 70 | Peut avoir des faux positifs |
| PlainTextParser | 0 | Fallback universel |

## 🔍 Détection intelligente

Le `HyphenListParser` utilise une heuristique pour éviter les faux positifs :

```typescript
canParse(text: string): boolean {
    const startsWithHyphen = /^[-–—]\s/.test(trimmed)
    const hasMultipleHyphenLines = (trimmed.match(/\n[-–—]\s/g) || []).length >= 1

    return startsWithHyphen || hasMultipleHyphenLines
    // ✅ Ne se déclenche pas pour "texte-avec-tirets"
}
```

## 💡 Avantages de cette architecture

1. **Séparation des responsabilités** : Chaque parser gère un seul format
2. **Testabilité** : Tests unitaires faciles pour chaque parser
3. **Extensibilité** : Ajout de nouveaux formats sans modifier l'existant
4. **Performance** : Singleton et évaluation lazy des parsers
5. **Maintenabilité** : Code modulaire et bien organisé

## 📚 Références

- **Strategy Pattern** : Design pattern pour algorithmes interchangeables
- **Chain of Responsibility** : Pattern pour déléguer les requêtes
- **Tailwind CSS** : `break-words`, `break-all` pour le word-wrapping
