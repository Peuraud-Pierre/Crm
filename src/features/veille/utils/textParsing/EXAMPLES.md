# Exemples de formats supportés

Ce document illustre tous les formats de texte supportés par le système de parsing.

## 📋 Format JSON

### Array standard
```json
["Premier élément", "Deuxième élément", "Troisième élément"]
```
**Rendu** :
- Premier élément
- Deuxième élément
- Troisième élément

### Objet JSON
```json
{"item1": "Première action", "item2": "Deuxième action", "item3": "Troisième action"}
```
**Rendu** :
- Première action
- Deuxième action
- Troisième action

### Format custom (legacy)
```
{Élément 1, Élément 2, Élément 3}
```
**Rendu** :
- Élément 1
- Élément 2
- Élément 3

---

## 🔢 Listes numérotées

### Format basique
```
1. Analyser le marché 2. Définir la stratégie 3. Implémenter la solution
```
**Rendu** :
1. Analyser le marché
2. Définir la stratégie
3. Implémenter la solution

### Avec retours à ligne
```
1. Premier point important
2. Deuxième point à considérer
3. Troisième action recommandée
```
**Rendu** :
1. Premier point important
2. Deuxième point à considérer
3. Troisième action recommandée

### Items longs (multiligne)
```
1. Ce premier point contient beaucoup de texte et peut s'étendre sur plusieurs lignes pour expliquer en détail 2. Le deuxième point est plus court 3. Et voici le troisième
```
**Rendu** :
1. Ce premier point contient beaucoup de texte et peut s'étendre sur plusieurs lignes pour expliquer en détail
2. Le deuxième point est plus court
3. Et voici le troisième

---

## 🔹 Listes à tirets

### Format ligne par ligne (recommandé)
```
- Premier risque identifié
- Deuxième risque potentiel
- Troisième élément à surveiller
```
**Rendu** :
• Premier risque identifié
• Deuxième risque potentiel
• Troisième élément à surveiller

### Tirets Unicode (en dash)
```
– Élément avec en dash
– Autre élément
– Dernier élément
```
**Rendu** :
• Élément avec en dash
• Autre élément
• Dernier élément

### Tirets Unicode (em dash)
```
— Item avec em dash
— Autre item
— Dernier item
```
**Rendu** :
• Item avec em dash
• Autre item
• Dernier item

### Format inline (fallback)
```
Item 1 - Item 2 - Item 3
```
**Rendu** :
• Item 1
• Item 2
• Item 3

### Items multilignes
```
- Premier point qui peut contenir
  plusieurs lignes de texte pour
  expliquer en détail
- Deuxième point plus court
- Troisième et dernier point
```
**Rendu** :
• Premier point qui peut contenir plusieurs lignes de texte pour expliquer en détail
• Deuxième point plus court
• Troisième et dernier point

---

## 📝 Texte brut

### Paragraphe simple
```
Ceci est un texte simple sans structure particulière qui sera affiché tel quel.
```
**Rendu** :
Ceci est un texte simple sans structure particulière qui sera affiché tel quel.

### Texte avec tirets inline (NON considéré comme liste)
```
Les stratégies long-term et court-term doivent être alignées.
```
**Rendu** :
Les stratégies long-term et court-term doivent être alignées.

### Texte avec tiret au milieu (NON liste)
```
L'entreprise X - leader du marché - a annoncé une nouvelle stratégie.
```
**Rendu** :
L'entreprise X - leader du marché - a annoncé une nouvelle stratégie.

---

## 💪 Formatage gras

Tous les formats supportent la syntaxe `**texte**` pour le gras.

### Dans une liste à tirets
```
- **Risque élevé** : Perte de parts de marché
- **Risque moyen** : Augmentation des coûts
- **Risque faible** : Retard de livraison
```
**Rendu** :
• **Risque élevé** : Perte de parts de marché
• **Risque moyen** : Augmentation des coûts
• **Risque faible** : Retard de livraison

### Dans une liste numérotée
```
1. **Analyser** le contexte actuel 2. **Définir** les objectifs clés 3. **Mettre en œuvre** les actions
```
**Rendu** :
1. **Analyser** le contexte actuel
2. **Définir** les objectifs clés
3. **Mettre en œuvre** les actions

### Dans du texte brut
```
La **révolution numérique** transforme profondément les **modèles économiques** traditionnels.
```
**Rendu** :
La **révolution numérique** transforme profondément les **modèles économiques** traditionnels.

---

## 🎨 Thèmes de couleurs

### Thème "muted" (par défaut)
```typescript
formatText("- Item 1\n- Item 2", "muted")
```
Gris/ardoise, neutre

### Thème "blue"
```typescript
formatText("1. Action 1 2. Action 2", "blue")
```
Bleu, pour informations générales et recommandations

### Thème "red"
```typescript
formatText("- Risque 1\n- Risque 2", "red")
```
Rouge, pour les risques et alertes

### Thème "green"
```typescript
formatText("- Opportunité 1\n- Opportunité 2", "green")
```
Vert, pour les opportunités et aspects positifs

---

## ⚠️ Cas limites et edge cases

### Liste avec un seul élément
```
- Item unique
```
**Rendu** :
• Item unique
✅ Considéré comme une liste (commence par tiret)

### Texte vide
```
""
```
**Rendu** :
(rien)

### Mélange de formats (NON supporté)
```
1. Premier point
- Deuxième point avec tiret
2. Troisième point numéroté
```
**Rendu** :
Sera parsé comme liste numérotée (priorité plus élevée), résultat peut être inattendu.
⚠️ **Ne pas mélanger les formats dans un même bloc**

### Très long texte sans structure
```
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
```
**Rendu** :
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
✅ Word-wrapping automatique avec `break-words`

### URLs longues
```
https://www.example.com/very/long/path/to/resource?param1=value1&param2=value2&param3=value3
```
**Rendu** :
https://www.example.com/very/long/path/to/resource?param1=value1&param2=value2&param3=value3
✅ Utilise `break-all` pour éviter le débordement

---

## 🔄 Ordre de priorité des parsers

Le système teste les formats dans cet ordre :

1. **JSON** (priorité 100)
   - Si le texte commence par `[` ou `{`

2. **Liste numérotée** (priorité 80)
   - Si le texte contient `\d+\.`

3. **Liste à tirets** (priorité 70)
   - Si le texte commence par `-` ou contient `\n-`

4. **Texte brut** (priorité 0)
   - Fallback pour tout le reste

### Exemple d'ambiguïté
```
["1. Item", "2. Item"]
```
**Sera parsé comme** : JSON (car priorité plus élevée)
**Rendu** :
- 1. Item
- 2. Item

Pour forcer le parsing en liste numérotée, utiliser du texte brut :
```
1. Item 2. Item
```

---

## 📱 Responsive design

Tous les formats utilisent des classes CSS adaptées :
- `break-words` : Word-wrapping intelligent
- `min-w-0` : Permet le shrinking dans flexbox
- `flex-1` : Prend tout l'espace disponible
- `space-y-N` : Espacement vertical cohérent

Fonctionne parfaitement sur mobile, tablette et desktop ! 📱💻🖥️
