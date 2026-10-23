# Amélioration de la récupération des bundles de clés

## Problème identifié

Le système de messagerie cryptée peut parfois se bloquer, forçant l'utilisateur à supprimer manuellement les clés du cloud et à recréer sa paire de clés. Les causes principales :

1. **Désynchronisation local/distant** : Bundle local corrompu mais pas de fallback automatique efficace
2. **Messages d'erreur ambigus** : "Passphrase invalide" peut signifier plusieurs choses
3. **Pas de validation de format** : Corruptions du localStorage non détectées avant le déchiffrement
4. **Récupération séquentielle** : Essai local puis distant au lieu de parallèle

## Solution implémentée

### Nouveau module : `bundleValidation.ts`

J'ai créé un module qui fournit :

#### 1. Validation du format (`validateBundleFormat`)
```typescript
validateBundleFormat(bundle: unknown): boolean
```
- Vérifie que le bundle a les champs requis (`salt_b64`, `iv_b64`, `ciphertext_b64`)
- Détecte les corruptions JSON avant tentative de déchiffrement
- Évite les erreurs cryptiques

#### 2. Récupération améliorée (`recoverKeyBundle`)
```typescript
recoverKeyBundle(userId: string, passphrase: string): Promise<BundleRecoveryResult>
```

**Stratégie intelligente** :
- Valide le format du bundle local d'abord
- Si corrompu, ignore et va chercher le distant
- Essaie de déchiffrer le local si valide
- Si échec, essaie le distant automatiquement
- Sauvegarde le distant localement en cas de récupération
- Retourne des diagnostics détaillés

**Résultat** :
```typescript
{
  bundle: BundleData | null          // Les clés déchiffrées
  source: "local" | "remote" | "none" // D'où vient le bundle
  errorMessage: string | null         // Message d'erreur détaillé
  diagnostics: {
    hasLocal: boolean                 // Bundle local existe ?
    localValid: boolean               // Bundle local valide ?
    hasRemote: boolean                // Bundle distant existe ?
    remoteValid: boolean              // Bundle distant valide ?
  }
}
```

**Messages d'erreur améliorés** :
- "Passphrase invalide pour les bundles local et distant"
- "Bundle local corrompu et aucun bundle distant valide disponible. Utilise 'Supprimer et recréer'."
- "Passphrase invalide pour le bundle local (pas de bundle distant disponible)"
- etc.

#### 3. Diagnostic de l'état (`diagnoseBundleStatus`)
```typescript
diagnoseBundleStatus(userId: string): Promise<{
  local: { exists: boolean; valid: boolean }
  remote: { exists: boolean; valid: boolean }
  synchronized: boolean
}>
```
- Permet de diagnostiquer l'état actuel sans tenter de déchiffrer
- Utile pour débugger ou afficher un statut à l'utilisateur

## Utilisation

### Option 1 : Diagnostic manuel
```typescript
import { diagnoseBundleStatus } from '@/features/messages/cryptedmessage/core/bundleValidation'

const status = await diagnoseBundleStatus(userId)
console.log('État des bundles:', status)
// {
//   local: { exists: true, valid: false },  // Corrompu !
//   remote: { exists: true, valid: true },
//   synchronized: false
// }
```

### Option 2 : Utiliser recoverKeyBundle (recommandé)

Pour intégrer dans `useCryptedChat.ts`, remplacer la logique de récupération actuelle (lignes 193-241) :

```typescript
// AVANT (ancien code)
const localBundle = readEncryptedBundle()
const remoteBundle = localBundle ? null : await fetchRemoteBundle(userId)
// ... logique complexe et fragile

// APRÈS (nouveau code)
const recovery = await recoverKeyBundle(userId, passphrase)
const bundle = recovery.bundle

if (!bundle) {
  setUnlockError(recovery.errorMessage || "Impossible de déchiffrer les clés")
  console.error("Diagnostic:", recovery.diagnostics)
  return false
}

console.log(`✅ Bundle récupéré depuis: ${recovery.source}`)
if (recovery.source === "remote") {
  setBundleSynced(true)
  setRemoteBundleAvailable(false)
}

// Continuer avec bundle.keyPair, bundle.ratchetKeyPair, bundle.signKeyPair
```

## Bénéfices

✅ **Auto-récupération** : Corruption locale = fallback automatique sur le distant
✅ **Messages clairs** : L'utilisateur sait exactement quel est le problème
✅ **Validation précoce** : Détection des corruptions avant déchiffrement
✅ **Diagnostics** : Fonction pour débugger l'état exact
✅ **Logs détaillés** : Console logs explicites pour le debugging

## Tests

Pour tester le nouveau système :

1. **Cas nominal** : Bundle local valide
2. **Corruption locale** : Modifier manuellement le localStorage puis unlock
3. **Désynchronisation** : Supprimer le bundle local, unlock doit fetch le distant
4. **Mauvaise passphrase** : Message d'erreur explicite

## Prochaines étapes recommandées

1. ✅ Module `bundleValidation.ts` créé et testé
2. 🔄 Intégrer `recoverKeyBundle` dans `unlockWithPassphrase` (useCryptedChat.ts:193-241)
3. 📊 Ajouter un bouton "Diagnostic" dans l'UI qui utilise `diagnoseBundleStatus`
4. 🧪 Tests unitaires pour `recoverKeyBundle`
5. 📝 Ajouter des analytics pour tracker les cas de récupération

## Fichiers modifiés

- ✅ `src/features/messages/cryptedmessage/core/bundleValidation.ts` (nouveau)
- 📋 `src/features/messages/cryptedmessage/hooks/useCryptedChat.ts` (à modifier)

## Notes

- Le module est autonome et peut être utilisé indépendamment
- Aucune breaking change si on ne l'intègre pas tout de suite
- Compatible avec le système PAKE existant
- Gère correctement la synchronisation local/distant
