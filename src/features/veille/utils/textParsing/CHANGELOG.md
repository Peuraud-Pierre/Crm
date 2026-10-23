# Changelog - Text Parsing System

## 🎉 Version 2.0.0 - Refactorisation complète

### ✨ Nouvelles fonctionnalités

#### Architecture modulaire
- **Strategy Pattern** : Chaque format de texte est géré par un parser dédié
- **Chain of Responsibility** : Les parsers sont organisés en chaîne avec priorités
- **Extensibilité** : Ajout de nouveaux formats sans modifier le code existant

#### Parsers indépendants
- `JsonParser` : Parse les arrays et objets JSON
- `NumberedListParser` : Parse les listes numérotées (1. 2. 3.)
- `HyphenListParser` : Parse les listes à tirets (-, –, —)
- `PlainTextParser` : Fallback pour tout texte non structuré

### 🐛 Bug fixes majeurs

#### 1. Tirets et retours à ligne ✅ RÉSOLU
**Avant** :
```typescript
// ❌ Ne fonctionnait qu'avec " - " (espaces requis)
const items = text.split(" - ")
```

**Après** :
```typescript
// ✅ Supporte tous les formats de tirets et retours à ligne
const regex = /^[-–—]\s+(.+?)(?=\n[-–—]\s+|\n*$)/gms
```

**Exemples supportés** :
- `"- Item 1\n- Item 2"` → Liste à 2 items
- `"– Item avec en dash"` → Support Unicode
- `"— Item avec em dash"` → Support Unicode
- `"- Item multiligne\n  suite du texte\n- Item 2"` → Items multilignes

**Non plus considéré comme liste** :
- `"long-term strategy"` → Texte normal (tiret inline)
- `"Some text - more text"` → Texte normal (pas en début de ligne)

#### 2. Word-wrapping amélioré

**CSS optimisé** :
```css
/* Avant : Potentiel conflit */
.text { break-words hyphens-auto }

/* Après : Plus cohérent */
.text { break-words }
.url { break-all }  /* Spécifique aux URLs */
```

**Note importante** : `hyphens-auto` nécessite `lang="fr"` sur l'élément `<html>`.

### 🚀 Améliorations de performance

1. **Singleton pattern** : Instance unique de `ParserChain`
2. **Lazy evaluation** : Les parsers ne s'exécutent que si nécessaire
3. **Early exit** : Dès qu'un parser réussit, la chaîne s'arrête

### 📊 Comparaison avant/après

#### Ligne de code
- **Avant** : 1 fichier monolithique de 377 lignes
- **Après** : 10 fichiers modulaires (moy. 60 lignes/fichier)

#### Testabilité
- **Avant** : Impossible de tester les stratégies individuellement
- **Après** : Chaque parser est testable indépendamment

#### Extensibilité
- **Avant** : Modifier la fonction `formatText` de 130 lignes
- **Après** : Créer une classe de ~50 lignes et l'enregistrer

### 🎨 Améliorations visuelles

#### Listes à tirets
**Avant** :
```
- Item 1
- Item 2
```

**Après** :
```
• Item 1
• Item 2
```
Utilisation du bullet point (•) pour éviter la confusion avec les tirets dans le texte.

#### URLs
Meilleure gestion du word-breaking avec `break-all` pour éviter le débordement.

### 📁 Structure de fichiers

```
Avant:
└── VeilleCardSimple.tsx (377 lignes)

Après:
├── VeilleCardSimple.tsx (200 lignes, simplifié)
└── utils/textParsing/
    ├── index.ts
    ├── types.ts
    ├── themes.ts
    ├── renderBold.tsx
    ├── ParserChain.ts
    ├── formatText.tsx
    ├── README.md
    ├── CHANGELOG.md
    ├── __tests__/
    │   └── HyphenListParser.test.tsx
    └── parsers/
        ├── JsonParser.tsx
        ├── NumberedListParser.tsx
        ├── HyphenListParser.tsx
        └── PlainTextParser.tsx
```

### 🧪 Tests

Ajout d'un exemple de suite de tests pour `HyphenListParser` :
- Detection heuristics
- Parsing logic
- Edge cases
- CSS classes
- Bold formatting

### 📚 Documentation

- **README.md** : Guide complet d'utilisation et architecture
- **CHANGELOG.md** : Historique des modifications
- **Tests** : Exemples de tests unitaires

### ⚡ Migration

**Pas de breaking changes !**

L'API publique reste identique :
```typescript
// Fonctionne exactement comme avant
formatText(text, "blue")
```

### 🔮 Prochaines étapes suggérées

1. **Tests E2E** : Tester avec des données réelles de l'API
2. **Support Markdown** : Ajouter un `MarkdownListParser`
3. **Attribut lang** : Ajouter `lang="fr"` sur `<html>` pour `hyphens-auto`
4. **Performance monitoring** : Mesurer les gains de performance
5. **Documentation interactive** : Storybook pour les différents formats

### 👥 Crédits

Refactorisation complète par l'équipe d'agents Claude :
- Agent d'analyse du bug des tirets
- Agent de révision CSS
- Agent d'architecture logicielle
- Agent de développement principal

---

## Version 1.0.0 (Ancienne version)

- Fonction monolithique `formatText` avec logique inline
- Support basique des formats JSON, numérotés, tirets et texte brut
- Bug : tirets ne fonctionnaient pas correctement avec retours à ligne
