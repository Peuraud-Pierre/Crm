# 🧪 Guide de Test du Streaming Vidéo

## ✅ Vérification rapide

### 1. Test visuel dans le navigateur

1. **Démarrer l'application**
   ```bash
   npm run dev
   ```

2. **Ouvrir la galerie** et cliquer sur une vidéo

3. **Ouvrir DevTools** (F12) > Onglet **Network**

4. **Observer les requêtes** :
   - Filtrer par "video" ou ".mp4"
   - Chercher les colonnes :
     - **Status**: `206 Partial Content` ✅
     - **Size**: Petits chunks (quelques KB/MB) ✅
     - **Time**: Rapide (<500ms pour démarrage) ✅

### 2. Vérifier les Headers HTTP

Dans Network > Cliquer sur une requête vidéo :

**Request Headers** (ce que le navigateur envoie) :
```
Range: bytes=0-1048575
```

**Response Headers** (ce que le serveur renvoie) :
```
HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-1048575/52428800
Content-Length: 1048576
Content-Type: video/mp4
```

### 3. Test du chargement progressif

1. Ouvrir une vidéo longue (>1 min)
2. Cliquer sur Play immédiatement
   - ✅ **Attendu** : Lecture démarre en <2 secondes
   - ❌ **Échec** : Si attend de tout télécharger
3. Sauter à 75% de la vidéo (seeking)
   - ✅ **Attendu** : Nouvelle requête Range visible dans Network
   - ❌ **Échec** : Aucune nouvelle requête

### 4. Console Browser

Dans Console, vous devriez voir :
```
📥 Début du chargement de la vidéo (streaming par chunks)
✅ Métadonnées chargées, prêt pour la lecture
```

## 🔍 Tests avancés

### Test avec curl

```bash
# Remplacer VIDEO_URL par l'URL complète avec token
VIDEO_URL="http://localhost:8080/api/video/test.mp4?token=abc123"

# Test 1: Vérifier Accept-Ranges
curl -I "$VIDEO_URL"
# Attendu: Accept-Ranges: bytes

# Test 2: Demander les premiers 1024 bytes
curl -H "Range: bytes=0-1023" "$VIDEO_URL" -v 2>&1 | grep -E "(206|Content-Range)"
# Attendu:
#   < HTTP/1.1 206 Partial Content
#   < Content-Range: bytes 0-1023/52428800

# Test 3: Demander un segment au milieu
curl -H "Range: bytes=1000000-2000000" "$VIDEO_URL" -o /tmp/chunk.mp4
ls -lh /tmp/chunk.mp4
# Attendu: Fichier de ~1MB
```

### Test de performance

**Avant streaming (téléchargement complet)** :
- Vidéo 50MB → Temps de chargement : 10-30s
- Bande passante : 50MB

**Après streaming (chunks)** :
- Vidéo 50MB → Temps de démarrage : <2s
- Bande passante initiale : ~500KB
- Total si vue complète : ~5-10MB (buffering intelligent)

## 📊 Métriques à surveiller

| Métrique | Valeur attendue | Mauvais signe |
|----------|----------------|---------------|
| **Time to First Byte** | <200ms | >1s |
| **Délai avant lecture** | <2s | >5s |
| **Nombre de requêtes** | 5-20 | 1 seule (pas de chunking) |
| **Taille premier chunk** | ~1MB | Taille totale du fichier |
| **HTTP Status** | 206 | 200 (pas de Range) |

## 🐛 Debugging

### Problème : Status 200 au lieu de 206

**Cause** : Backend ne gère pas les Range Requests

**Solution** :
```go
// Vérifier que vous utilisez http.ServeContent
http.ServeContent(w, r, filename, modTime, file)
// PAS http.ServeFile ni io.Copy direct
```

### Problème : CORS error

**Cause** : Headers CORS manquants

**Solution** :
```go
c.Header("Access-Control-Allow-Origin", "*")
c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
c.Header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range")
```

### Problème : Token expired

**Cause** : Token temporaire (2 min) expiré pendant la lecture

**Solution temporaire** : Rafraîchir la page

**Solution permanente** : Implémenter auto-refresh :
```tsx
const refreshToken = async () => {
  // Appeler API pour nouveau token
  const newUrl = await fetchNewVideoUrl(videoId)
  setVideoSrc(newUrl)
}
```

## 📸 Screenshots attendus

### DevTools Network (bon état)
```
Name             Status   Type         Size       Time
video.mp4?token  206      video/mp4    1.0 MB     124ms
video.mp4?token  206      video/mp4    1.0 MB     98ms
video.mp4?token  206      video/mp4    1.0 MB     105ms
```

### DevTools Console (bon état)
```
📥 Début du chargement de la vidéo (streaming par chunks)
✅ Métadonnées chargées, prêt pour la lecture
```

## ✅ Checklist finale

- [ ] Build réussi sans erreurs TypeScript
- [ ] Vidéo se charge en <2s
- [ ] Status 206 visible dans Network
- [ ] Headers `Range` et `Content-Range` présents
- [ ] Seeking fonctionne instantanément
- [ ] Console logs apparaissent
- [ ] Pas d'erreur CORS
- [ ] Mobile fonctionne (playsInline)

## 🎯 Prochaines étapes

1. ✅ Streaming par chunks implémenté
2. 🔄 Implémenter refresh automatique du token
3. 📊 Ajouter métriques de performance (Analytics)
4. 🎨 Thumbnails sur la timeline
5. 🚀 CDN pour cache global
6. 📱 Adaptive bitrate (multiple qualités)
