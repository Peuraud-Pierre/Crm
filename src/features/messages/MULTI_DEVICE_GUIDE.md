# 📱 Guide Multi-Appareils - Messagerie Chiffrée

## Comment ça fonctionne ?

La messagerie chiffrée utilise un système similaire à **WhatsApp** qui te permet d'accéder à tes messages depuis plusieurs appareils tout en gardant un chiffrement de bout en bout.

## 🔑 Concept Principal : Une Clé par Utilisateur

### ✅ CE QUI EST FAIT

**Tes clés privées sont uniques à ton compte, pas à ton appareil :**

- Une seule paire de clés par utilisateur
- Sauvegardée de manière chiffrée dans le cloud (bundle chiffré)
- Protégée par ton code PIN à 6 chiffres
- Synchronisée automatiquement entre tes appareils

### 🔐 Comment c'est sécurisé ?

1. **Chiffrement Local** : Ton code PIN ne quitte jamais ton appareil en clair
2. **PBKDF2** : Ton code PIN est transformé en clé cryptographique (100,000 itérations)
3. **Bundle Chiffré** : Tes clés privées sont chiffrées avec cette clé dérivée
4. **Cloud Storage** : Le serveur stocke le bundle mais ne peut pas le déchiffrer
5. **Zero Knowledge** : Même nous ne pouvons pas lire tes messages

## 📲 Utilisation Multi-Appareils

### Premier Appareil (Nouveau Compte)

```
1. Tu te connectes pour la première fois
2. Le système génère automatiquement tes clés de chiffrement
3. Tu choisis un code PIN à 6 chiffres
4. Tes clés sont chiffrées et sauvegardées dans le cloud
✅ Prêt à envoyer des messages !
```

### Deuxième Appareil (Récupération)

```
1. Tu te connectes sur un nouvel appareil
2. Le système détecte que tu as déjà un bundle cloud
3. Tu entres ton code PIN à 6 chiffres
4. Tes clés sont récupérées et déchiffrées
✅ Tu peux lire tous tes anciens messages !
```

## 🆚 Différences avec d'autres systèmes

| Fonctionnalité            | Notre Système | Signal        | WhatsApp  | Telegram       |
| ------------------------- | ------------- | ------------- | --------- | -------------- |
| Chiffrement E2EE          | ✅            | ✅            | ✅        | ❌ (optionnel) |
| Multi-appareils           | ✅            | ✅            | ✅        | ✅             |
| Sauvegarde cloud chiffrée | ✅            | ❌            | ✅        | ❌             |
| Code PIN simple           | ✅ 6 chiffres | ❌ Passphrase | ✅        | ✅             |
| Zero-knowledge            | ✅            | ✅            | ⚠️ Backup | ❌             |

## 🔄 Flow Technique

### Première Connexion

```typescript
// 1. Génération des clés
const keyPair = generateKeyPairBase64()
const ratchetKeyPair = generateKeyPairBase64()
const signKeyPair = generateSignKeyPairBase64()

// 2. L'utilisateur choisit un code PIN
const userPin = "123456"

// 3. Dérivation sécurisée (PBKDF2)
const salt = generateSalt() // 32 bytes aléatoires
const derivedKey = await deriveSessionKey(userPin, salt, 100000)

// 4. Chiffrement du bundle
const bundle = { keyPair, ratchetKeyPair, signKeyPair }
const encrypted = await encryptKeyBundle(bundle, userPin)

// 5. Sauvegarde cloud
await saveRemoteBundle(userId, encrypted)

// ✅ Les clés sont maintenant disponibles pour tous les appareils
```

### Connexion sur Nouvel Appareil

```typescript
// 1. Détection du nouvel appareil
const isNewDevice = isFirstUse()

// 2. Récupération du bundle cloud
const encryptedBundle = await fetchRemoteBundle(userId)

// 3. L'utilisateur entre son code PIN
const userPin = "123456"

// 4. Déchiffrement du bundle
const bundle = await decryptKeyBundle(encryptedBundle, userPin)

// 5. Stockage local temporaire (session)
writeSessionKeys(JSON.stringify(bundle))

// ✅ L'appareil peut maintenant lire/envoyer des messages
```

## 🛡️ Sécurité

### Ce qui est stocké où

| Donnée         | Local (localStorage) | Local (sessionStorage) | Cloud (chiffré) |
| -------------- | -------------------- | ---------------------- | --------------- |
| Code PIN       | ❌ JAMAIS            | ❌ JAMAIS              | ❌ JAMAIS       |
| Clé dérivée    | ❌                   | ✅ (session)           | ❌              |
| Clés privées   | ❌                   | ✅ (déchiffrées)       | ✅ (chiffrées)  |
| Bundle chiffré | ✅                   | ❌                     | ✅              |
| ID appareil    | ✅                   | ❌                     | ❌              |

### Protection des données

```
Code PIN (6 chiffres)
    ↓ PBKDF2 (100,000 itérations)
Clé dérivée (256 bits)
    ↓ AES-GCM
Bundle chiffré
    ↓ Stockage cloud
❌ Serveur ne peut PAS déchiffrer
```

## 📱 Interface Utilisateur

### Nouveaux Composants

1. **DeviceInfoPanel** : Affiche l'appareil actuel avec possibilité de renommer
2. **MultiDeviceExplainer** : Explique le système avec des visuels clairs
3. **Messages améliorés** :
    - "🔐 Code PIN requis pour déverrouiller tes clés"
    - "💡 Même code PIN sur tous tes appareils"
    - "☁️ Récupération de tes clés depuis le cloud..."

### Options Utilisateur

Dans le panneau **Options** (SecurityPanel) :

- ✅ Voir les infos de l'appareil actuel
- ✅ Renommer l'appareil
- ✅ Récupérer depuis le cloud
- ✅ Supprimer la sauvegarde cloud
- ✅ Réinitialiser l'appareil local

## ⚠️ Limitations et Avertissements

### ❌ Pas de Récupération de Code PIN

**Important :** Si tu perds ton code PIN, **tu perds l'accès à tes messages**.

Il n'y a pas de "mot de passe oublié" car :

- Nous ne stockons pas ton code PIN
- Nous ne pouvons pas déchiffrer ton bundle
- C'est le principe du Zero-Knowledge

**Solution :** Note ton code PIN dans un endroit sûr !

### 🔄 Synchronisation

- ✅ **Clés** : Synchronisées via le cloud
- ✅ **Messages** : Stockés et chiffrés sur le serveur
- ❌ **Préférences locales** : Non synchronisées (nom d'appareil, etc.)

### 🆕 Nouvel Appareil

Si tu te connectes sur un nouvel appareil :

1. Le système détecte automatiquement que c'est nouveau
2. Tu vois un message explicatif
3. Tu entres ton code PIN
4. Tous tes messages s'affichent !

## 🔮 Améliorations Futures

### Possibles :

- [ ] **Liste des appareils connectés** : Voir tous tes appareils
- [ ] **Révocation d'appareil** : Déconnecter un appareil volé/perdu
- [ ] **Notifications inter-appareils** : Être alerté quand un nouvel appareil se connecte
- [ ] **Backup emergency** : Codes de récupération (comme Google Authenticator)
- [ ] **Biométrie** : Touch ID / Face ID pour unlock plus rapide
- [ ] **Auto-lock** : Verrouillage après X minutes d'inactivité

### Complexe :

- [x] **Session linking** : Scanner un QR code pour lier un appareil (comme WhatsApp Web) ✅ **IMPLÉMENTÉ**
- [ ] **Forward Secrecy amélioré** : Rotation des clés plus fréquente
- [ ] **Post-Quantum** : Algorithmes résistants aux ordinateurs quantiques

## 📱 Synchronisation par QR Code

### 🎯 Principe

Au lieu d'entrer manuellement le code PIN sur chaque appareil, tu peux **scanner un QR Code** depuis un appareil déjà déverrouillé pour synchroniser instantanément un nouvel appareil.

### Comment ça marche ?

**Appareil A (déjà configuré) :**
1. Ouvre le panneau "Options" (bouton sécurité)
2. Clique sur "Afficher QR Code"
3. Un QR Code s'affiche contenant ton exportKey PAKE

**Appareil B (nouveau) :**
1. Sur l'écran de déverrouillage, clique sur "Scanner QR Code"
2. Scanne le QR Code affiché sur l'Appareil A
3. 🎉 Automatiquement synchronisé !

### Sécurité du QR Code

- **Expiration** : Le QR Code expire après 10 minutes
- **Contenu** : Il contient l'exportKey PAKE (pas le code PIN)
- **Usage unique** : Recommandé de n'utiliser qu'une seule fois
- **Local** : Ne transite pas par le serveur

### Avantages vs Code PIN manuel

| Méthode       | Avantages                        | Inconvénients              |
|---------------|----------------------------------|----------------------------|
| QR Code       | ✅ Rapide<br>✅ Pas de typo<br>✅ UX fluide | ⚠️ Besoin accès physique aux 2 appareils |
| Code PIN      | ✅ Fonctionne à distance         | ⚠️ Plus long<br>⚠️ Risque d'erreur de frappe |

## 💡 Conseils Utilisateur

### ✅ À FAIRE

- **Note ton code PIN** dans un endroit sûr (physique, pas cloud)
- **Donne un nom reconnaissable** à tes appareils
- **Vérifie régulièrement** que la sauvegarde cloud est à jour
- **Utilise le même code PIN** sur tous tes appareils

### ❌ À ÉVITER

- **Partager ton code PIN** avec quelqu'un
- **Utiliser un code PIN facile** (comme 000000 ou 123456)
- **Supprimer la sauvegarde cloud** si tu as plusieurs appareils
- **Réinitialiser un appareil** sans être sûr d'avoir la sauvegarde

## 🐛 Dépannage

### Problème : "Je ne vois pas mes anciens messages"

**Solutions :**

1. Vérifie que tu es connecté avec le bon compte
2. Clique sur "📥 Récupérer depuis le cloud" dans Options
3. Entre ton code PIN correct
4. Attends quelques secondes pour la synchronisation

### Problème : "Code PIN invalide"

**Solutions :**

1. Vérifie que tu tapes le bon code (6 chiffres)
2. Essaie sur un autre appareil où ça marche
3. Si vraiment perdu, utilise "Réinitialiser" (⚠️ perte des messages)

### Problème : "Appareil bloqué en 'Préparation...'"

**Solutions :**

1. Attends 10 secondes (auto-resync)
2. Rafraîchis la page (F5)
3. Force la resync dans Options
4. Déconnecte/reconnecte ton compte

## 📚 Références

- **PBKDF2** : [RFC 2898](https://tools.ietf.org/html/rfc2898)
- **NaCl Crypto** : [TweetNaCl.js](https://github.com/dchest/tweetnacl-js)
- **Double Ratchet** : [Signal Protocol](https://signal.org/docs/)
- **Zero-Knowledge** : [Concept](https://en.wikipedia.org/wiki/Zero-knowledge_proof)

---

**Créé avec ❤️ pour une messagerie vraiment privée**
