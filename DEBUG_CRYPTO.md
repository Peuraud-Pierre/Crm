# 🐛 Debug des Opérations Cryptographiques

## Activer les logs de débogage

Par défaut, tous les logs de débogage cryptographiques (PAKE, dérivation de clés, chiffrement, etc.) sont **désactivés** pour garder la console propre en production.

### Comment activer

1. Créez un fichier `.env` à la racine du projet (si pas déjà fait)
2. Ajoutez cette ligne :

```bash
PUBLIC_ENABLE_CRYPTO_DEBUG=true
```

3. Redémarrez le serveur de développement :

```bash
npm run dev
```

4. 🎉 Les logs détaillés apparaissent maintenant dans la console !

### Ce qui sera loggé

Quand `PUBLIC_ENABLE_CRYPTO_DEBUG=true`, vous verrez :

- 🔐 Dérivation des clés PBKDF2
- 💾 Sauvegarde/récupération de l'exportKey partagée
- 📥 Tentatives de déchiffrement des bundles
- 🔄 Opérations PAKE (login, register)
- ✅ Succès des opérations crypto
- ❌ Échecs des opérations crypto

### Logs toujours affichés

Certains événements importants sont **toujours affichés** même sans debug activé :

- ✅ Succès critiques (PIN créé, bundle sauvegardé, etc.)
- ❌ Erreurs bloquantes
- ⚠️ Avertissements de sécurité

## Exemple de sortie console

### Mode Production (debug désactivé)
```
✅ ExportKey partagée sauvegardée
✅ Configuration PIN terminée avec succès
```

### Mode Debug (debug activé)
```
🔐 Dérivation de la clé depuis la passphrase... 476847
💾 Sauvegarde de l'exportKey partagée...
✅ ExportKey partagée sauvegardée
📝 Enregistrement du PIN via PAKE...
🔐 Dérivation de la clé depuis la passphrase... QT5Uu3W8n-clclQVek...
✅ decryptKeyBundle: Déchiffrement réussi {...}
✅ Configuration PIN terminée avec succès
```

## Désactiver les logs

Pour revenir au mode production (console propre) :

1. Éditez `.env` :
```bash
PUBLIC_ENABLE_CRYPTO_DEBUG=false
```

2. Ou supprimez complètement la ligne
3. Redémarrez le serveur

## En production

**Important** : En production (build), assurez-vous que `PUBLIC_ENABLE_CRYPTO_DEBUG` est à `false` ou absent pour :
- Performances optimales
- Console propre pour les utilisateurs
- Pas de fuite d'informations sensibles

## Fichiers concernés

Le gate est implémenté une seule fois dans `src/features/messages/core/logger.ts` (`cryptoLogger`/`eventLogger`, méthodes `log`/`info`/`success` — `warn`/`error` restent toujours actifs) et consommé par tous les appelants :
- `src/features/messages/core/sharedExportKey.ts`
- `src/features/messages/core/bundleValidation.ts`
- `src/features/messages/core/pake.ts` (gate dédié pour le log de configuration au chargement du module)
- `src/features/messages/hooks/usePinManager.ts`

Note : ce document faisait auparavant référence à `VITE_ENABLE_CRYPTO_DEBUG`, un flag documenté mais jamais câblé (aucune référence dans le code) — corrigé le flag et le préfixe (`PUBLIC_*` est le seul exposé côté client par rsbuild, voir `docs/PLAN_ASSAINISSEMENT.md` §7.3), et le gate est maintenant réellement implémenté.
