# 🚀 Démarrage Rapide - Cache de Tests

## Installation (2 minutes)

### 1. Installer les hooks Git
```bash
./scripts/setup-hooks.sh
```

### 2. (Optionnel) Activer la synchronisation automatique

**Si tu veux synchroniser automatiquement le cache avec le VPS :**

```bash
# Copier la config d'exemple
cp .env.example .env

# Éditer et activer la synchronisation
nano .env
# PUSH_TEST_CACHE=true

# Configurer l'accès SSH (une seule fois)
ssh-copy-id root@nokk-project.example
```

**Sinon, le cache restera local** (toujours utile pour éviter de relancer les tests après un amend par exemple).

---

## Utilisation

### Workflow normal
```bash
git add .
git commit -m "feat: new feature"
git push origin preprod  # ← Les tests s'exécutent automatiquement ici
```

**Ce qui se passe :**
1. Le hook `pre-push` détecte le push
2. Il lance les tests sur **ton PC** (plus rapide)
3. Si succès → Sauvegarde du résultat
4. Le push continue
5. Sur le VPS, le CI **skip les tests** (déjà validés)

### Bypass temporaire (déconseillé)
```bash
git push --no-verify  # Skip le hook
```

---

## Bénéfices

### Avant
```
VPS : Setup (30s) + Build (15s) + Tests (12s) + Deploy (5s) = 62s
```

### Après
```
PC local : Tests (8s) ← Ton PC est plus puissant
VPS : Setup skip (2s) + Build (15s) + Tests skip (1s) + Deploy (5s) = 23s
```

**Gain total : ~31 secondes par build** 🚀

---

## Vérification

### Voir les caches locaux
```bash
ls -lh .git/test-cache/
```

### Tester le hook manuellement
```bash
# Simuler un push
.githooks/pre-push
```

---

## Dépannage

### Le hook ne se lance pas
```bash
# Vérifier la config Git
git config core.hooksPath

# Réinstaller
./scripts/setup-hooks.sh
```

### Forcer la réexécution des tests
```bash
# Supprimer le cache local
rm -rf .git/test-cache
```

---

## Documentation complète

Voir [TESTS_CACHE.md](./TESTS_CACHE.md) pour plus de détails.
