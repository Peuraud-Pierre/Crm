// La logique Realtime vit dans la couche service (règle : pas d'accès
// Supabase direct hors services). Ré-export conservé pour compatibilité.
export { waitForNewVideo } from "@/features/content/services/contentGenerationService"
