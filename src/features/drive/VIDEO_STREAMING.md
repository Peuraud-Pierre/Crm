# Streaming Vidéo par Chunks (HTTP Range Requests)

## 📋 Vue d'ensemble

Le système de streaming vidéo utilise les **HTTP Range Requests** pour charger les vidéos par segments plutôt que de télécharger le fichier complet. Cela améliore considérablement les performances et l'expérience utilisateur.

## 🏗️ Architecture

### Backend (Go)
Le backend utilise `http.ServeContent` qui gère automatiquement :
- Headers `Accept-Ranges: bytes`
- Headers `Range: bytes=0-1023` dans les requêtes
- Réponses HTTP 206 Partial Content
- Lecture efficace par segments du fichier

```go
// cypher_go/backend/internal/handlers/gallery.go:379
http.ServeContent(c.Writer, c.Request, filename, fileInfo.ModTime(), file)
```

### Frontend (React)
Le composant `StreamingVideo` optimise la lecture :
- `preload="metadata"` : Charge uniquement les métadonnées (durée, dimensions)
- `playsInline` : Lecture inline sur mobile
- Gestion d'erreurs pour tokens expirés
- Logs de débogage pour le chargement

## 🔄 Fonctionnement

1. **Initialisation** : Le lecteur vidéo charge uniquement les métadonnées (~100-200 KB)
2. **Premier chunk** : Quand l'utilisateur clique sur Play, le navigateur demande le premier segment
3. **Buffering progressif** : Les segments suivants sont chargés au fur et à mesure
4. **Seeking** : Si l'utilisateur saute à 2:30, seul ce segment est téléchargé

### Exemple de requêtes HTTP

```http
# Requête initiale (métadonnées)
GET /api/video/abc123.mp4?token=xyz
Range: bytes=0-1023

# Réponse serveur
HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-1023/50000000
Content-Length: 1024

# Requête suivante (lecture)
GET /api/video/abc123.mp4?token=xyz
Range: bytes=1024-262143
```

## 📊 Avantages

| Aspect | Avant | Après |
|--------|-------|-------|
| **Chargement initial** | Fichier complet | ~100 KB métadonnées |
| **Délai avant lecture** | 10-30 secondes | <1 seconde |
| **Bande passante** | 100% du fichier | 5-20% en moyenne |
| **Seeking** | Déjà chargé | Instantané |
| **Mobile 4G** | Impossible | Fluide |

## 🔧 Configuration

### Composant StreamingVideo

```tsx
import StreamingVideo from "@/features/drive/components/StreamingVideo"

<StreamingVideo
  src={videoUrl}
  className="max-h-[70vh] rounded-2xl"
/>
```

### Attributs HTML5 importants

- `preload="metadata"` : Charge uniquement les métadonnées
- `preload="auto"` : Charge autant que possible (éviter pour grandes vidéos)
- `preload="none"` : Ne charge rien jusqu'au play (trop restrictif)

## 🐛 Debugging

### Vérifier que Range Requests fonctionne

1. Ouvrir DevTools > Network
2. Lire une vidéo
3. Chercher les requêtes avec :
   - Headers `Range: bytes=...`
   - Status `206 Partial Content`

### Console logs

Le composant StreamingVideo log :
```
📥 Début du chargement de la vidéo (streaming par chunks)
✅ Métadonnées chargées, prêt pour la lecture
```

### Problèmes courants

| Erreur | Cause | Solution |
|--------|-------|----------|
| `CORS error` | Backend ne retourne pas les headers CORS | Vérifier `Access-Control-*` headers |
| `Token expired` | Lien temporaire expiré | Rafraîchir la page ou implémenter auto-refresh |
| `Full download` | `http.ServeContent` non utilisé | Vérifier backend Go |

## 📝 Tests

### Test manuel
```bash
# Tester Range Request avec curl
curl -H "Range: bytes=0-1023" \
  "http://localhost:8080/api/video/test.mp4?token=xyz" \
  -v
```

Vérifier la réponse :
```
< HTTP/1.1 206 Partial Content
< Accept-Ranges: bytes
< Content-Range: bytes 0-1023/50000000
```

## 🚀 Optimisations futures

1. **Token refresh automatique** : Renouveler le token avant expiration
2. **Adaptive bitrate** : Multiple qualités (360p, 720p, 1080p)
3. **HLS/DASH** : Protocoles de streaming avancés
4. **CDN** : Cache des segments fréquemment demandés
5. **Thumbnails** : Générer des aperçus pour la timeline

## 📚 Références

- [MDN: HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [Go http.ServeContent](https://pkg.go.dev/net/http#ServeContent)
- [HTML5 Video Preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#preload)
