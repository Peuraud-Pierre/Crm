# Scénarios de Chiffrement E2EE - Analyse Complète

## 🎯 Vue d'ensemble du système

Le système utilise trois niveaux de stockage:

- **localStorage**: Bundle chiffré (clés chiffrées par passphrase)
- **sessionStorage**: Clés déchiffrées (session courante uniquement)
- **Supabase**: Bundle cloud (synchronisation multi-appareils)
- **Backend PAKE**: Enregistrement PIN (authentification OPAQUE)

---

## 📊 Scénarios Complets

### **Scénario 1: Nouvel utilisateur, premier appareil**

**État initial:**

- ❌ Pas de bundle local
- ❌ Pas de bundle cloud
- ❌ Pas d'enregistrement PAKE
- ✅ `isFirstUse()` = true

**Comportement:**

1. Bootstrap se déclenche
2. Aucun bundle distant trouvé
3. Génère nouvelles clés (KeyPair, RatchetKeyPair, SignKeyPair)
4. Crée passphrase temporaire aléatoire
5. Chiffre et stocke localement
6. **Force la demande de PIN** (car `isFirstUse() = true`)
7. État: `needsPassphrase=true`, `locked=true`, `ready=true`

**Résultat attendu:**

- ✅ Clavier PIN visible
- ✅ Message: "Configure ton code PIN de 6 chiffres"
- ⏳ Attend saisie PIN

---

### **Scénario 2: Utilisateur avec messages, nouvel appareil**

**État initial:**

- ❌ Pas de bundle local
- ✅ Bundle cloud existe
- ✅ Enregistrement PAKE existe
- ✅ `isFirstUse()` = true

**Comportement:**

1. Bootstrap se déclenche
2. `fetchRemoteBundle()` trouve le bundle cloud
3. Télécharge et stocke localement
4. État: `needsPassphrase=true`, `locked=true`, `ready=true`

**Résultat attendu:**

- ✅ Clavier PIN visible
- ✅ Message: "Entre ton code PIN habituel"
- ⏳ Attend saisie PIN
- ✅ Après PIN: déchiffre et affiche anciens messages

---

### **Scénario 3: Retour sur appareil connu (même session)**

**État initial:**

- ✅ Bundle local existe
- ✅ Clés dans sessionStorage
- ✅ `isFirstUse()` = false

**Comportement:**

1. Auto-unlock depuis sessionStorage
2. Charge les clés déchiffrées
3. État: `locked=false`, `ready=true`

**Résultat attendu:**

- ✅ "Session ouverte sur cet appareil"
- ✅ Messages accessibles immédiatement
- ❌ Pas de PIN demandé (session active)

---

### **Scénario 4: Retour sur appareil connu (nouvelle session)**

**État initial:**

- ✅ Bundle local existe
- ❌ sessionStorage vidé (navigateur fermé)
- ✅ `isFirstUse()` = false

**Comportement:**

1. Auto-unlock NE se déclenche PAS (needsPassphrase=true)
2. Demande PIN via PAKE

**Résultat attendu:**

- ✅ Clavier PIN visible
- ✅ Message: "Entre ton code PIN"
- ✅ Après PIN: restaure session

---

### **Scénario 5: "Récupérer dans le cloud"** ☁️

**Action déclenchée:** `fetchAndMerge()`

**État initial:**

- ✅ Appareil avec clés locales
- ✅ Bundle cloud disponible

**Comportement:**

1. Télécharge bundle cloud
2. Remplace bundle local
3. **Force re-lock** avec `needsPassphrase=true`
4. Demande PIN pour déchiffrer

**Résultat attendu:**

- ✅ Ancien bundle écrasé
- ✅ Messages cloud récupérés
- ✅ PIN demandé pour accéder

**⚠️ Cas d'usage:**

- Récupérer messages d'un autre appareil
- Restaurer après suppression locale
- Synchroniser après longue absence

---

### **Scénario 6: "Supprimer du cloud"** 🗑️

**Action déclenchée:** `purgeRemoteBundle()`

**Comportement:**

1. Supprime `cryptedmessage_keybundles` (Supabase)
2. Supprime `cryptedmessage_userkeys` (Supabase)
3. Appelle backend PAKE `/delete` (supprime enregistrement PIN)
4. **Nettoie TOUT localement:**
    - `clearBundleStorage()` (localStorage bundle)
    - `clearLocalVaultStorage()` (clés déchiffrées)
    - `clearSessionUnlock()` (sessionStorage)
    - `clearRememberedUnlock()` (remembered passphrase)
    - `clearPendingAuthSecret()` (secrets temporaires)
5. Reset tous les states
6. **Le bootstrap se redéclenche** (car plus de bundle)
7. Comme "nouvel utilisateur" → demande PIN

**Résultat attendu:**

- ✅ Tout supprimé du cloud
- ✅ Tout nettoyé localement
- ✅ Bootstrap recréé coffre vide
- ✅ PIN demandé (car nouvel appareil)
- ❌ Anciens messages perdus (normal!)

**⚠️ Important:**

- Après purge = **départ de zéro**
- Équivalent à "nouvel utilisateur"
- Backend PAKE supprimé → nouveau PIN requis

---

### **Scénario 7: "Réinitialiser le coffre local"** 🔄

**Action déclenchée:** `resetLocalVault()`

**Comportement:**

1. Nettoie uniquement le LOCAL:
    - `clearLocalVaultStorage()`
    - Reset clés (keyPair, ratchetKeyPair, signKeyPair)
    - `setLocked(true)`, `setReady(false)`
2. **NE touche PAS au cloud**
3. **NE touche PAS au PAKE**
4. Bootstrap se redéclenche
5. Si bundle cloud existe → le récupère
6. Sinon → crée nouveau coffre

**Résultat attendu:**

- ✅ Clés locales effacées
- ✅ Bundle cloud intact
- ✅ PIN intact (PAKE non touché)
- ✅ Peut récupérer messages du cloud

**⚠️ Cas d'usage:**

- Corruption locale
- Test/debug
- Forcer re-sync avec cloud

---

## 🔍 Analyse: Est-ce nécessaire de garder "Réinitialiser le coffre local" ?

### ✅ **OUI - Cas légitimes:**

1. **Corruption localStorage**
    - Bundle chiffré corrompu
    - Impossible de déchiffrer
    - Besoin de reconstruire depuis cloud

2. **Debug/Test**
    - Tester comportement "nouvel appareil"
    - Vérifier sync cloud
    - Sans perdre données cloud

3. **Réparation sans perte**
    - Problème local uniquement
    - Cloud OK, PIN OK
    - Juste besoin de réinitialiser local

### ❌ **Confusion possible:**

- Utilisateur ne comprend pas la différence entre:
    - "Réinitialiser local" (garde cloud/PIN)
    - "Supprimer cloud" (efface tout)

### 💡 **Recommandation:**

**GARDER** mais avec meilleure explication:

```tsx
// Proposition de texte plus clair:

"Réinitialiser le coffre local"
"Efface uniquement les clés de cet appareil. Tes messages dans le cloud restent intacts."

"Supprimer du cloud"
"⚠️ Supprime TOUT: messages cloud + enregistrement PIN. Départ à zéro!"
```

---

## 🐛 Problème Identifié et Corrigé

### **Symptôme:**

> "Je fais 'supprimer du cloud' et pourtant ça me dit 'Session ouverte sur cet appareil' sans demander de PIN"

### **Cause racine:**

1. `purgeRemoteBundle()` nettoyait cloud + local
2. Mettait `vaultPurged=true` pour bloquer bootstrap
3. **MAIS** ne nettoyait pas `sessionStorage`
4. Auto-unlock trouvait les clés en session
5. Déverrouillait sans PIN!

### **Fix appliqué:**

```typescript
// Dans purgeRemoteBundle():
clearSessionUnlock() // ✅ Ajouté
clearRememberedUnlock() // ✅ Ajouté
clearPendingAuthSecret() // ✅ Ajouté
// Ne bloque plus le bootstrap → laisse recréer proprement
```

### **Résultat:**

- ✅ Après purge: tout est nettoyé
- ✅ Bootstrap recréé coffre comme "nouvel appareil"
- ✅ PIN demandé systématiquement

---

## 🎨 Proposition UI améliorée

```tsx
// SecurityPanel.tsx - Boutons plus explicites:

<div className="space-y-2">
    <Button onClick={fetchAndMerge}>
        ☁️ Récupérer dans le cloud
        <span className="text-xs opacity-70">
            Synchronise avec tes autres appareils
        </span>
    </Button>

    <Button onClick={purgeRemoteBundle} variant="destructive">
        🗑️ Supprimer du cloud
        <span className="text-xs opacity-70">
            ⚠️ Efface TOUT: cloud + PIN (irréversible!)
        </span>
    </Button>
</div>
```

---

## 📋 Checklist de test

### Test 1: Nouveau compte

- [ ] PIN demandé à la première utilisation
- [ ] Message: "Configure ton code PIN"
- [ ] Après PIN: session ouverte

### Test 2: Nouvel appareil (compte existant)

- [ ] PIN demandé (ancien PIN)
- [ ] Anciens messages récupérés
- [ ] Sync bidirectionnelle

### Test 3: Purge cloud

- [ ] Tout supprimé (cloud + local + PAKE)
- [ ] PIN redemandé (nouveau PIN)
- [ ] Pas de messages récupérés (normal)

### Test 4: Reset local

- [ ] Local effacé, cloud intact
- [ ] Récupération auto depuis cloud
- [ ] PIN demandé (ancien PIN)

### Test 5: Session persistante

- [ ] Même session = pas de PIN
- [ ] Fermer/rouvrir navigateur = PIN demandé
- [ ] Déconnexion = PIN redemandé

---

## 🔐 Sécurité

**✅ Bonnes pratiques respectées:**

- Clés jamais en clair (chiffrées par passphrase)
- Passphrase dérivée de PIN via OPAQUE (PAKE)
- SessionStorage uniquement (pas de persistance long-terme)
- E2EE complet (serveur ne voit que données chiffrées)

**⚠️ Points d'attention:**

- PIN 6 chiffres = 1M combinaisons (OK pour usage perso)
- Pas de rate-limiting côté client (backend PAKE devrait)
- "Supprimer cloud" irréversible (confirmation importante)

---

## 📚 Conclusion

**Actions disponibles:**

1. **Récupérer cloud** → Sync multi-appareils
2. **Réinitialiser local** → Fix corruption locale
3. **Supprimer cloud** → Fresh start complet

**Tous sont nécessaires** mais nécessitent:

- Meilleurs labels/descriptions
- Confirmations claires (surtout purge)
- Icônes/couleurs différenciées
