# CLAUDE.md

Instructions pour Claude Code (et tout agent IA) travaillant sur Nokk_project.

## Documents de référence — lire avant de coder

- **`docs/Architecture_Feature.pdf`** — doctrine d'architecture (Vertical Slice / Feature-First) : structure d'une feature, conventions de nommage, rôle des hooks/context/services, checklist de revue, anti-patterns, arbre de décision « où je mets ce fichier ? ». C'est la source de vérité pour tout ce qui touche à `src/features/*`.
- **`docs/DESIGN_SYSTEM.md`** — conventions Atomic Design pour le socle UI partagé (`src/shared/ui`, `src/shared/components`). C'est la source de vérité pour tout ce qui touche au design system.
- **`docs/PLAN_ASSAINISSEMENT.md`** — plan de remédiation technique en cours (garde-fous, nettoyage, consolidation), avec tableau de suivi. Consulter avant de retoucher une zone identifiée comme dette active.
- **`docs/ROUTING.md`** — convention URL = source de vérité pour les features à onglets/sous-pages et deep-linking (notifications, sheets de détail). `stock`/`administration` en exemples de référence, `crm` en contre-exemple legacy à ne pas reproduire. Consulter avant d'ajouter des onglets ou une route de détail à une feature.

Ne pas dupliquer le contenu de ces documents ici. Ce fichier ne contient que ce qui n'est pas déjà couvert par eux.

## Alias et emplacements réels

- `@/*` → `src/*`.
- UI partagée : `src/shared/ui` (design system, voir `docs/DESIGN_SYSTEM.md`) et `src/shared/components` (dont app-shell : `layout/`, `sidebar/`).
- `components.json` (config CLI shadcn) a été corrigé pour pointer vers ces vrais chemins — ne jamais recréer `@/components/*`, `@/lib/*`, `@/hooks/*` à la racine de `src/` (chemins morts de l'ancien scaffold Lovable).
- Client Supabase : source unique `src/integrations/supabase/client.ts` (généré, ne pas éditer). Ne jamais appeler `createClient(` ailleurs.

## Règles non négociables

- **Couche service obligatoire** : aucun appel `supabase.from(...)` direct dans un composant ou un hook. Toujours passer par `services/<ressource>Service.ts` (modèle : `src/features/stock/services/arrivageService.ts`), orchestré par un hook `hooks/data/use<Ressource>()`. Voir `Architecture_Feature.pdf` §5.
- **Un seul module crypto autorisé** : `src/features/messages/core/crypto.ts`. Ne jamais créer d'implémentation crypto parallèle — un précédent existe (`cryptedmessage-cleanup.md`) où une implémentation abandonnée a coexisté avec l'actuelle avant d'être nettoyée ; ne pas répéter.
- **Préfixe env var unique : `PUBLIC_*`**. C'est le seul préfixe que rsbuild expose réellement côté client. Ne pas utiliser `VITE_*` (reliquat de migration, non fonctionnel). Toute nouvelle variable passe par `src/shared/lib/env.ts` (validation zod) — ne jamais lire `import.meta.env.` directement ailleurs (règle oxlint `nokk-project/no-restricted-syntax`, `.oxlintrc.json`). Déclarer aussi la variable dans `src/vite-env.d.ts` (`ImportMetaEnv`).
- **Pas de valeurs Tailwind arbitraires** (`w-[123px]`, `text-[11px]`...) sauf besoin réel documenté en commentaire. Utiliser les tokens `@theme` de `src/index.css`. Le module `src/features/stock` est identifié comme le pire contrevenant actuel — ne pas y ajouter de nouvelles valeurs arbitraires.
- **Atomic Design limité au design system partagé.** Ne jamais réorganiser les `components/` d'une feature en atoms/molecules/organisms — cette organisation reste par domaine métier (`Architecture_Feature.pdf` §4.1). L'Atomic Design ne s'applique qu'à `src/shared/ui` et `src/shared/components`, selon `docs/DESIGN_SYSTEM.md`.
- **God components** : seuil officiel 400 lignes (`Architecture_Feature.pdf` §15). Au-delà, splitter par sous-responsabilité plutôt que continuer à étendre le fichier.

## Structure d'une nouvelle feature

Ne pas réinventer — suivre exactement `Architecture_Feature.pdf` §2. Utiliser `src/features/stock/` comme exemple le plus proche de la cible actuelle.

## Avant de commiter

- `npm run lint` et `tsc --noEmit` doivent passer (gates CI en mode ratchet — ne pas faire augmenter le nombre d'erreurs existantes).
- Pour tout changement touchant une zone identifiée dans `docs/PLAN_ASSAINISSEMENT.md`, mettre à jour son tableau de suivi (§10 du document).
