# tests/

Ce dossier ne contient actuellement aucun test — les tests du projet sont colocalisés dans `src/` (`*.test.ts(x)` à côté du fichier testé), voir `Architecture_Feature.pdf` §10 pour la convention.

Runner : `rstest` (`rstest.config.ts`, jsdom + Testing Library). Commandes utiles :

```bash
npm run test          # rstest, une fois
npm run test:watch    # mode watch
npm run test:front    # équivalent utilisé en CI (rstest run src)
```

**Note historique** : ce fichier décrivait auparavant une suite d'intégration complète pour le module Veille (29 tests automatisés, checklist manuelle, rapports de sign-off QA/Tech Lead/PM...). Aucun des fichiers référencés (`MANUAL_TEST_CHECKLIST.md`, `TESTING_GUIDE.md`, `INTEGRATION_TEST_RESULTS.md`, `TEST_ARCHITECTURE.md`, `EXECUTIVE_SUMMARY.md`, `tests/features/veille/integration/...`) n'a jamais existé sur disque — contenu fictif, remplacé ici. Voir `docs/PLAN_ASSAINISSEMENT.md`.
