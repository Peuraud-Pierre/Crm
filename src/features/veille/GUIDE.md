# Guide d'utilisation - Module Veille Stratégique

## Vue d'ensemble

Le module de veille stratégique supporte **deux formats de données** pour le champ `executive_summary` :

### Format 1 : JSON Structuré (Recommandé)

```json
{
  "date_veille": "2026-02-10",
  "periode": "7 derniers jours",
  "secteurs_cibles": ["Management", "RH"],
  "actualites_principales": [
    {
      "titre": "...",
      "resume": "...",
      "date_publication": "2026-02-10",
      "urls": ["..."],
      "mots_cles": ["..."]
    }
  ],
  "sections": [
    {
      "titre": "...",
      "bullet_points": [...]
    }
  ]
}
```

**Avantages :**
- Affichage riche avec accordéons
- Navigation structurée
- Mots-clés et tags interactifs
- Dates formatées

### Format 2 : Texte Simple

```
executive_summary: "Résumé en texte simple..."
risks: "Risques identifiés..."
opportunities: "Opportunités..."
recommended_actions: "Actions recommandées..."
```

**Avantages :**
- Plus simple à générer
- Supporte le markdown
- Coloration par type (risques=rouge, opportunités=vert, etc.)

## Composants disponibles

### `<VeilleCardAuto />` ⭐ Recommandé

Détecte automatiquement le format et affiche le bon composant.

```tsx
import { VeilleCardAuto } from '@/features/veille'

<VeilleCardAuto item={report} />
```

### `<VeilleCard />`

Pour forcer l'affichage en format JSON structuré.

```tsx
import { VeilleCard } from '@/features/veille'

<VeilleCard item={report} />
```

### `<VeilleCardSimple />`

Pour forcer l'affichage en format texte simple.

```tsx
import { VeilleCardSimple } from '@/features/veille'

<VeilleCardSimple item={report} />
```

## Hook de données

### `useVeilleReports()`

```tsx
import { useVeilleReports } from '@/features/veille'

function MyComponent() {
  const { reports, loading, error, refetch } = useVeilleReports()

  if (loading) return <div>Chargement...</div>
  if (error) return <div>Erreur: {error.message}</div>

  return (
    <>
      {reports.map(report => (
        <VeilleCardAuto key={report.id} item={report} />
      ))}
    </>
  )
}
```

## Utilitaires de validation

### `parseExecutiveSummary()`

Parse et valide un executive_summary JSON.

```tsx
import { parseExecutiveSummary } from '@/features/veille'

const summary = parseExecutiveSummary(item.executive_summary)
if (summary) {
  console.log(summary.periode)
  console.log(summary.secteurs_cibles)
}
```

### `hasValidExecutiveSummary()`

Vérifie rapidement si un executive_summary est valide.

```tsx
import { hasValidExecutiveSummary } from '@/features/veille'

if (hasValidExecutiveSummary(item.executive_summary)) {
  // Afficher le format structuré
} else {
  // Afficher le format simple
}
```

## Structure de la base de données

### Table : `ai_watch_reports`

```sql
create table public.ai_watch_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  period_start date,
  period_end date,
  topic text not null,
  frequency text check (frequency in ('daily', 'weekly', 'monthly')),
  source_model text,
  analysis_model text,
  raw_research text,
  executive_summary text,  -- Format JSON ou texte
  risks text,
  opportunities text,
  recommended_actions text,
  importance_score integer,
  tags text[],
  metadata jsonb
);
```

## Gestion des erreurs

Le module gère automatiquement :

✅ `executive_summary` null ou vide
✅ JSON invalide ou malformé
✅ Champs manquants
✅ Tableaux vides
✅ Valeurs null dans les champs optionnels

**Comportement :**
- Si les données sont invalides → la carte n'est pas affichée (pas de crash)
- Les erreurs sont loggées dans la console pour debugging
- Messages utilisateur clairs en cas de liste vide

## Exemples d'usage

### Exemple 1 : Affichage simple

```tsx
import { Veille } from '@/features/veille'

export function MyApp() {
  return <Veille />
}
```

### Exemple 2 : Affichage personnalisé

```tsx
import { useVeilleReports, VeilleCardAuto } from '@/features/veille'

export function CustomVeille() {
  const { reports, loading } = useVeilleReports()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reports.map(report => (
        <VeilleCardAuto key={report.id} item={report} />
      ))}
    </div>
  )
}
```

### Exemple 3 : Filtrage personnalisé

```tsx
import { useVeilleReports, VeilleCardAuto } from '@/features/veille'

export function CriticalReports() {
  const { reports } = useVeilleReports()

  const criticalReports = reports.filter(r =>
    r.importance_score !== null && r.importance_score >= 7
  )

  return (
    <>
      {criticalReports.map(report => (
        <VeilleCardAuto key={report.id} item={report} />
      ))}
    </>
  )
}
```

## Bonnes pratiques

### 1. Toujours utiliser VeilleCardAuto

```tsx
// ✅ Bon - Détection automatique
<VeilleCardAuto item={report} />

// ❌ À éviter - Vous devez gérer le format manuellement
<VeilleCard item={report} />
```

### 2. Gérer les états de chargement

```tsx
// ✅ Bon
const { reports, loading, error } = useVeilleReports()

if (loading) return <Skeleton />
if (error) return <ErrorMessage error={error} />
if (reports.length === 0) return <EmptyState />

// ❌ À éviter - Pas de gestion des états
const { reports } = useVeilleReports()
return <>{reports.map(...)}</>
```

### 3. Mémoïser les filtres coûteux

```tsx
// ✅ Bon
const filteredReports = useMemo(() =>
  reports.filter(r => r.importance_score >= 5),
  [reports]
)

// ❌ À éviter - Recalcul à chaque render
const filteredReports = reports.filter(r => r.importance_score >= 5)
```

## Échelle d'importance

| Score | Label | Couleur | Usage |
|-------|-------|---------|-------|
| 7-10  | Critique | Rouge | Action immédiate requise |
| 5-6   | Important | Orange | Attention requise |
| 1-4   | Normal | Bleu | Information générale |
| null  | Non défini | Gris | Score non calculé |

## Performance

Le module est optimisé avec :
- `React.memo` sur tous les composants de carte
- `useMemo` pour les calculs de filtres et statistiques
- `useCallback` pour les fonctions de fetch
- Rendu conditionnel pour éviter les composants inutiles
- Lazy rendering avec accordéons

**Temps de rendu moyens :**
- 1-10 rapports : < 100ms
- 10-50 rapports : < 300ms
- 50-100 rapports : < 600ms

## Dépannage

### Problème : "Failed to parse executive_summary"

**Cause :** Le JSON est malformé ou contient des caractères spéciaux.

**Solution :**
1. Vérifier le contenu dans la console
2. Le module gère automatiquement ce cas en affichant le format texte
3. Si nécessaire, nettoyer les données en base

### Problème : Cartes vides

**Cause :** Tous les champs de contenu sont null.

**Solution :**
1. Vérifier que `executive_summary`, `risks`, `opportunities` ou `raw_research` contiennent des données
2. Le composant retourne `null` si aucune donnée n'est disponible (comportement normal)

### Problème : Styles cassés

**Cause :** Tailwind CSS n'a pas compilé les classes.

**Solution :**
1. Relancer le build : `npm run dev`
2. Vérifier que le chemin `src/features/veille/**/*.{ts,tsx}` est dans `tailwind.config.ts`

## Support

Pour toute question ou problème :
1. Consulter le [README.md](./README.md)
2. Vérifier les logs de la console
3. Créer une issue avec les détails de l'erreur
