#!/bin/bash
# 🔧 Installation des hooks Git pour ce projet

set -e

echo "🔧 Installation des hooks Git..."

# Créer un lien symbolique vers les hooks partagés
if [ -d ".githooks" ]; then
    git config core.hooksPath .githooks
    echo "✅ Hooks configurés dans .githooks/"
else
    echo "⚠️  Dossier .githooks non trouvé"
    exit 1
fi

# Rendre les hooks exécutables
chmod +x .githooks/*

echo "✅ Hooks installés avec succès !"
echo ""
echo "📝 Hooks disponibles :"
ls -1 .githooks/
echo ""
echo "💡 Le hook pre-push exécutera automatiquement les tests avant chaque push"
echo "💡 Pour désactiver temporairement : git push --no-verify"
