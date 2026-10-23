# Sécurisation du Stockage des Passphrases - Messages E2EE

## 🔒 Problème Résolu

Avant cette modification, les passphrases utilisées pour déchiffrer les clés E2EE étaient stockées **en clair** dans le `sessionStorage` et le `localStorage`, créant une vulnérabilité de sécurité.

## ✅ Solution Implémentée

### 1. **Dérivation de Clés (PBKDF2)**

Au lieu de stocker la passphrase en clair, nous utilisons maintenant **PBKDF2** (Password-Based Key Derivation Function 2) pour dériver une clé cryptographique à partir de la passphrase.

**Fichier créé :** `core/keyDerivation.ts`

**Fonctionnalités :**

- `deriveSessionKey(passphrase, salt)` - Dérive une clé de 256 bits avec 100,000 itérations PBKDF2-SHA256
- `verifyPassphrase(passphrase, storedKey, salt)` - Vérifie qu'une passphrase correspond à une clé dérivée
- `generateSalt()` - Génère un salt aléatoire de 32 bytes
- `hashPassphrase(passphrase)` - Hash simple SHA-256 pour identifiants

### 2. **Stockage des Clés Déchiffrées**

Au lieu de stocker la passphrase pour la réutiliser, nous stockons maintenant les **clés déchiffrées** (keyPair, ratchetKeyPair, signKeyPair) dans `sessionStorage`.

**Modifications :**

- `writeSessionKeys(keys)` - Stocke les clés déchiffrées (pas la passphrase)
- `readSessionKeys()` - Récupère les clés pour auto-unlock

### 3. **Désactivation du "Remember Me"**

La fonctionnalité `rememberedUnlock` qui stockait la passphrase en `localStorage` a été désactivée car incompatible avec la sécurité. L'utilisateur devra se reconnecter après fermeture de la session.

## 🔐 Architecture de Sécurité

### Avant (Vulnérable)

```
User enters passphrase
         ↓
Store passphrase in sessionStorage (PLAIN TEXT ❌)
         ↓
Auto-unlock: read passphrase → decrypt bundle
```

### Après (Sécurisé)

```
User enters passphrase
         ↓
Decrypt bundle with passphrase
         ↓
Store decrypted keys in sessionStorage ✅
         ↓
Derive secure key: PBKDF2(passphrase, salt, 100k iterations)
         ↓
Store derived key (irreversible) ✅
         ↓
Auto-unlock: read decrypted keys directly
```

## 🛡️ Propriétés de Sécurité

1. **Fonction à sens unique** : Impossible de retrouver la passphrase depuis la clé dérivée
2. **Résistance aux attaques par force brute** : 100,000 itérations PBKDF2 rendent les attaques coûteuses
3. **Salt unique** : Chaque dérivation utilise un salt aléatoire, empêchant les rainbow tables
4. **Pas de passphrase en clair** : Aucune trace de la passphrase originale dans le storage
5. **Session limitée** : Les clés déchiffrées sont dans `sessionStorage`, effacées à la fermeture du navigateur

## 📝 Changements de Comportement

### Pour les utilisateurs :

- ✅ **Session active** : Auto-unlock fonctionne pendant la session (tant que l'onglet est ouvert)
- ⚠️ **Après fermeture** : L'utilisateur devra **re-saisir sa passphrase** (le "Remember Me" ne fonctionne plus)
- ✅ **Sécurité renforcée** : Même si un attaquant accède au storage, il ne peut pas obtenir la passphrase

### Pour les développeurs :

- Les fonctions `writeSessionUnlock()` et `writeRememberedUnlock()` acceptent maintenant des **clés dérivées**, pas des passphrases
- Nouvelle fonction `writeSessionKeys()` pour stocker les clés déchiffrées
- Le flux d'auto-unlock charge directement les clés depuis `sessionStorage`

## 🧪 Tests

Nouveau fichier de tests : `core/keyDerivation.test.ts`

**Tests inclus :**

- Dérivation cohérente avec même passphrase/salt
- Différenciation avec passphrases/salts différents
- Vérification de passphrase correcte/incorrecte
- Propriétés de sécurité (non-réversibilité)
- Résistance aux timing attacks
- Integration flow complet

## 📦 Fichiers Modifiés

### Nouveaux fichiers :

- `core/keyDerivation.ts` - Fonctions de dérivation PBKDF2
- `core/keyDerivation.test.ts` - Tests unitaires

### Fichiers modifiés :

- `core/storage.ts` - Ajout de `readSessionKeys`, `writeSessionKeys`, documentation mise à jour
- `cryptedmessage/hooks/useCryptedChat.ts` - Utilisation du nouveau système
- `index.ts` - Export des nouvelles fonctions

## 🔍 Détails Techniques

### Structure de Dérivation

```typescript
type KeyDerivationInfo = {
    salt_b64: string // Salt en base64
    iterations: number // Nombre d'itérations PBKDF2 (100,000)
    algorithm: "PBKDF2-SHA256" // Algorithme utilisé
}
```

### Processus de Dérivation

```typescript
// 1. Générer un salt aléatoire
const salt = generateSalt() // 32 bytes

// 2. Dériver une clé de 256 bits
const derivedKey = await deriveSessionKey(passphrase, salt, 100000)

// 3. Stocker la clé dérivée (pas la passphrase)
writeSessionUnlock(derivedKey)

// 4. Stocker les informations de dérivation
const info = createDerivationInfo(salt, 100000)
writeSessionDerivationInfo(JSON.stringify(info))
```

### Clés en Session

```typescript
// Structure stockée en sessionStorage
{
    keyPair: {
        publicKey: string,  // Base64
        secretKey: string   // Base64
    },
    ratchetKeyPair: { ... },
    signKeyPair: { ... }
}
```

## ⚡ Performance

L'ajout de PBKDF2 avec 100,000 itérations ajoute environ **100-200ms** lors du unlock initial. C'est un compromis acceptable pour la sécurité renforcée.

## 🚀 Migration

Les utilisateurs existants verront leurs sessions expirer et devront se reconnecter. Les anciennes passphrases stockées en clair seront ignorées et le nouveau système sera utilisé automatiquement.

## 🔮 Améliorations Futures

1. **Chiffrement des clés en session** : Chiffrer les clés stockées en `sessionStorage` avec une clé dérivée de la passphrase
2. **Biométrie** : Support de WebAuthn pour unlock biométrique
3. **Hardware tokens** : Support de YubiKey ou autres tokens matériels
4. **Key rotation** : Rotation périodique des clés de chiffrement

## 📚 Références

- [PBKDF2 (RFC 2898)](https://www.rfc-editor.org/rfc/rfc2898)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
