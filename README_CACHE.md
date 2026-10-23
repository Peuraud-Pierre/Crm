# 🚀 Système de Cache Intelligent CI/CD

## 📖 Comment ça marche ?

### 1️⃣ Sur ton PC (développement)

```bash
git commit -m "feat: nouvelle fonctionnalité"
git push origin preprod
```

**Le hook pre-push** :
- ✅ Exécute les tests sur ton PC (plus rapide)
- ✅ Crée un marker `.ci-cache/{commit-hash}.tested`
- ✅ Le marker est versionné dans le repo

### 2️⃣ Sur le VPS (CI/CD)

**Le CI détecte** :
1. Si `.ci-cache/{commit-hash}.tested` existe → **Skip les tests** ✨
2. Sinon, vérifie `/cache/test-cache/{commit-hash}.success` (cache VPS)
3. Si aucun cache → Exécute les tests

---

## ⚡ Gains de performance

### Avant
```
Setup : 30s (npm install)
Build : 15s
Tests : 12s ← VPS lent
Deploy: 5s
Total : 62s
```

### Après (cache chaud)
```
Setup : 2s  (cache npm détecté)
Build : 15s
Tests : 1s  (marker local détecté, skip)
Deploy: 5s
Total : 23s

Gain : 39 secondes (63% plus rapide) 🚀
```

---

## 🔧 Installation

### Première utilisation
```bash
./scripts/setup-hooks.sh
```

### Désactiver temporairement
```bash
git push --no-verify  # Skip le hook
```

---

## 📁 Fichiers importants

- `.githooks/pre-push` - Hook qui exécute les tests localement
- `.ci-cache/` - Markers de tests validés (versionné)
- `.git/test-cache/` - Cache local (non versionné)
- `ci.yaml` - Pipeline CI optimisé

---

## 🐛 Dépannage

### Les tests ne se lancent plus
```bash
# Supprimer le cache local
rm -rf .git/test-cache

# Réinstaller les hooks
./scripts/setup-hooks.sh
```

### Forcer les tests sur le VPS
```bash
# Supprimer le marker local avant de commit
rm -rf .ci-cache/
```

---

## 📊 Statistiques

- **Cache npm** : Hash du `package-lock.json`
- **Cache tests** : Hash du commit Git
- **Persistance** : Entre tous les builds sur le même commit

---

## 🎯 Architecture

```
[PC Local]
   ↓ commit + push
   ↓ pre-push hook → Tests (8s) → .ci-cache/{hash}.tested
   ↓
[GitHub]
   ↓ webhook
   ↓
[VPS CI]
   ↓ git clone
   ↓ Détecte .ci-cache/{hash}.tested
   ↓ Skip tests ✨
   ↓ Build + Deploy (23s)
```

Gain total : **~40 secondes par build** 🚀
