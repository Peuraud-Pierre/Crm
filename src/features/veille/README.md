# Feature Veille Stratégique

## Description

Module de veille stratégique permettant d'afficher et de filtrer des rapports d'analyse automatisés sur les évolutions du management, droit du travail, et stratégie RH.

## Structure

```
veille/
├── components/
│   └── VeilleCard.tsx          # Composant d'affichage d'un rapport
├── hooks/
│   └── useVeilleReports.ts     # Hook pour récupérer les rapports
├── routes/
│   └── Veille.tsx              # Page principale
├── types/
│   └── veille.types.ts         # Types TypeScript
├── utils/
│   └── mockData.ts             # Données de test
├── index.ts                    # Exports
└── README.md                   # Documentation
```

## Composants

### VeilleCardAuto (Recommandé)

Composant intelligent qui détecte automatiquement le format de l'`executive_summary` et choisit le bon composant d'affichage :
- Si JSON structuré → utilise `VeilleCard`
- Si texte simple → utilise `VeilleCardSimple`
- Si aucune donnée → retourne `null`

**Props:**
- `item: VeilleItem` - Rapport à afficher

### VeilleCard

Composant mémoïsé pour afficher les rapports avec un `executive_summary` au format JSON structuré :
- Badge d'importance (Critique/Important/Normal)
- Badge de fréquence (Quotidien/Hebdomadaire/Mensuel)
- Liste des secteurs cibles
- Actualités principales
- Sections détaillées avec accordion
- Informations techniques (modèles source et analyse)

**Props:**
- `item: VeilleItem` - Rapport à afficher

### VeilleCardSimple

Composant mémoïsé pour afficher les rapports avec un `executive_summary` au format texte simple :
- Badge d'importance et fréquence
- Résumé exécutif (texte)
- Risques (avec style visuel rouge)
- Opportunités (avec style visuel vert)
- Actions recommandées (avec style visuel bleu)
- **Sources/Citations** (liens cliquables avec formatage intelligent)
- Recherche brute (collapsible)
- Tags

**Props:**
- `item: VeilleItem` - Rapport à afficher

### EmptyState

Composant pour afficher un état vide élégant.

**Props:**
- `type: "no-data" | "no-results" | "invalid-data"` - Type d'état vide
- `message?: string` - Message personnalisé (optionnel)

### Veille (Page)

Page principale avec :
- En-tête avec statistiques globales
- Filtres par fréquence et importance
- Liste des rapports
- Gestion des états de chargement et d'erreur
- Actualisation manuelle

## Hooks

### useVeilleReports

Hook personnalisé pour gérer les rapports de veille.

**Retour:**
```typescript
{
  reports: VeilleItem[]      // Liste des rapports
  loading: boolean           // État de chargement
  error: Error | null        // Erreur éventuelle
  refetch: () => Promise<void> // Fonction de rechargement
}
```

## Types

Voir [veille.types.ts](./types/veille.types.ts) pour la définition complète des types.

### VeilleItem

Type principal représentant un rapport de veille stocké dans Supabase.

### VeilleExecutiveSummary

Type représentant le résumé exécutif au format JSON, contenant :
- Date et période de veille
- Secteurs cibles
- Actualités principales
- Sections détaillées

## Base de données

### Table: ai_watch_reports

```sql
create table public.ai_watch_reports (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone null default now(),
  period_start date null,
  period_end date null,
  topic text not null,
  frequency text null,
  source_model text null,
  analysis_model text null,
  raw_research text null,
  executive_summary text null,
  risks text null,
  opportunities text null,
  recommended_actions text null,
  importance_score integer null,
  tags text[] null,
  metadata jsonb null,
  constraint ai_watch_reports_pkey primary key (id),
  constraint ai_watch_reports_frequency_check check (
    (frequency = any (array['daily'::text, 'weekly'::text, 'monthly'::text]))
  )
);
```

### Métadonnées (metadata)

Le champ `metadata` est un JSONB qui peut contenir des informations supplémentaires. Structure recommandée :

```typescript
{
  "citations": [
    "https://www.example.com/article1",
    "https://www.example.com/article2"
  ]
}
```

**Champs supportés :**
- `citations`: Array de strings (URLs des sources)
- Autres champs personnalisés possibles

**Affichage :**
- Les citations sont affichées comme liens cliquables
- URLs formatées intelligemment (domaine + chemin tronqué)
- Icône externe au survol
- Numérotation automatique [1], [2], etc.

## Optimisations

1. **Mémoïsation** : Composant `VeilleCard` mémoïsé avec `React.memo`
2. **useMemo** : Filtrage et calcul des statistiques optimisés
3. **useCallback** : Hook de récupération des données optimisé
4. **TypeScript strict** : Types stricts pour éviter les erreurs runtime
5. **Lazy rendering** : Accordion pour les sections détaillées

## Utilisation

```typescript
import { Veille } from '@/features/veille'

// Dans votre router
<Route path="/veille" element={<Veille />} />
```

## Améliorations futures possibles

- [ ] Pagination pour les listes longues
- [ ] Recherche full-text dans les rapports
- [ ] Export PDF des rapports
- [ ] Tri personnalisé (date, importance, fréquence)
- [ ] Favori et archivage de rapports
- [ ] Notifications pour nouveaux rapports critiques
- [ ] Graphiques de tendances
- [ ] Comparaison entre périodes
