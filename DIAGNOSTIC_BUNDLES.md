# 🔧 Diagnostic et Résolution des Problèmes de Bundles

## Problème

Les utilisateurs sont parfois bloqués et doivent supprimer manuellement leurs clés du cloud puis recréer leur paire de clés.

## Solution Rapide - Diagnostic dans la Console

### Étape 1 : Ouvrir la Console

1. Ouvre ton app dans le navigateur
2. Appuie sur F12 (ou Cmd+Option+I sur Mac)
3. Va dans l'onglet "Console"

### Étape 2 : Exécuter le Diagnostic

Copie-colle ce code dans la console :

```javascript
async function diagnoseBundles(userId) {
    console.log("🔍 === DIAGNOSTIC DES BUNDLES DE CLÉS ===\\n")

    // 1. Check localStorage
    const localBundle = localStorage.getItem('cryptedmessage:keybundle:v1')
    console.log("📦 Bundle local:")
    if (localBundle) {
        console.log("  ✅ Existe")
        try {
            const parsed = JSON.parse(localBundle)
            const hasFields = !!(parsed?.salt_b64 && parsed?.iv_b64 && parsed?.ciphertext_b64)
            console.log(hasFields ? "  ✅ Format valide" : "  ❌ Format invalide")
            console.log("  📏 Taille:", localBundle.length, "caractères")
            if (!hasFields) {
                console.log("  📄 Contenu:", parsed)
            }
        } catch(e) {
            console.log("  ❌ JSON corrompu:", e.message)
        }
    } else {
        console.log("  ❌ N'existe pas")
    }

    // 2. Check remote (adapte selon ton setup Supabase)
    console.log("\\n🌐 Vérification cloud...")
    console.log("⚠️  Pour vérifier le bundle distant, va dans Supabase dashboard:")
    console.log("   → Table: cryptedmessage_keybundles")
    console.log("   → Filter: user_id =", userId)

    console.log("\\n🔍 === FIN DU DIAGNOSTIC ===")
}

// Remplace 'YOUR_USER_ID' par ton vrai user ID
await diagnoseBundles('YOUR_USER_ID')
```

### Étape 3 : Interpréter les Résultats

**Si tu vois :**
- `✅ Bundle local existe + ✅ Format valide` → Tout est OK côté local
- `❌ Bundle local n'existe pas` → Normal si nouveau navigateur/appareil
- `❌ JSON corrompu` → **Problème !** Le localStorage est corrompu

## Solutions Selon les Cas

### Cas 1 : Bundle Local Corrompu
```javascript
// Dans la console
localStorage.removeItem('cryptedmessage:keybundle:v1')
// Puis recharge la page et unlock avec ta passphrase
// → Le bundle distant sera automatiquement récupéré
```

### Cas 2 : Bundles Désynchronisés
Si tu as des bundles différents local/distant :
```javascript
// Option A : Utiliser le bundle distant (recommandé)
localStorage.removeItem('cryptedmessage:keybundle:v1')
// Recharge et unlock

// Option B : Forcer resync depuis l'app
// Utilise la fonction forceBundleResync() dans l'UI
```

### Cas 3 : Tout est Corrompu
Dernière option - reset complet :
```javascript
// ⚠️  ATTENTION : Tu perdras tes anciens messages si tu n'as pas de backup
localStorage.clear() // Nettoie tout le localStorage
// Puis utilise purgeRemoteBundle() dans l'app
// Recrée un nouveau bundle avec ta nouvelle passphrase
```

## Module de Récupération Automatique

J'ai créé un module `bundleValidation.ts` qui améliore la récupération automatique :

**Fonctionnalités** :
- ✅ Validation du format avant déchiffrement
- ✅ Fallback automatique local → distant
- ✅ Messages d'erreur détaillés
- ✅ Fonction de diagnostic

**Fichiers créés** :
1. `src/features/messages/cryptedmessage/core/bundleValidation.ts` - Module principal
2. `src/features/messages/cryptedmessage/core/diagnosticScript.ts` - Utilitaires de diagnostic
3. `src/features/messages/cryptedmessage/core/BUNDLE_RECOVERY.md` - Documentation technique

## Pour Intégrer la Récupération Automatique

Pour éviter que les utilisateurs aient à faire ces manipulations, il faudrait intégrer `recoverKeyBundle()` dans `useCryptedChat.ts`. Voir `BUNDLE_RECOVERY.md` pour les détails techniques.

## Prévention

Pour éviter ces problèmes à l'avenir :
1. ✅ Toujours sauvegarder le bundle distant après création
2. ✅ Valider le format du bundle avant stockage
3. ✅ Implémenter la récupération automatique
4. 🔄 Ajouter un bouton "Diagnostic" dans l'UI

## Logs Utiles

Ajoute ces logs dans ta console pour suivre le flux :
- 🔐 Décryptage bundle
- ✅ Succès
- ❌ Échec + raison
- 🔄 Fallback distant
- 📦 Sauvegarde locale

## Besoin d'Aide ?

Si le problème persiste après diagnostic :
1. Copie les logs de la console
2. Note le scénario exact (nouvel appareil, changement de passphrase, etc.)
3. Vérifie le contenu de la table `cryptedmessage_keybundles` dans Supabase
