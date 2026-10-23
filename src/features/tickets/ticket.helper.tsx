import { Bug, Circle, Sparkles, MessageSquare, FileText, CheckCircle2, XCircle, Clock, Archive } from "lucide-react";
import { TICKET_THEME } from "./ticket.theme";
import type { TicketCategory, TicketStatus } from "./components/types";
import { useProfilesCtx } from "@/shared/context/ProfilesProvider";

// Helper Date
export const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit", 
    minute: "2-digit"
  });
};

// Helper Catégorie (Icone + Style du Thème)
export const CategoryIcon = ({ category }: { category?: TicketCategory }) => {
  // Récupération des classes depuis le thème
  const themeClass = TICKET_THEME.colors.category[category as keyof typeof TICKET_THEME.colors.category] || TICKET_THEME.colors.category.autre;

  switch (category) {
    case 'bug':
      return (
        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${themeClass}`} title="Bug">
          <Bug size={14} />
        </div>
      );
    case 'amelioration':
      return (
        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${themeClass}`} title="Amélioration">
          <Sparkles size={14} />
        </div>
      );
    case 'feedback':
      return (
        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${themeClass}`} title="Feedback">
          <MessageSquare size={14} />
        </div>
      );
    default:
      return (
        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${themeClass}`} title="Autre">
          <FileText size={14} />
        </div>
      );
  }
};

// Helper Status Config (Label + Icon + Couleur Thème)
export const getStatusConfig = (status?: TicketStatus) => {
  // Récupération sécurisée du style depuis le thème statusBadge
  const style = TICKET_THEME.colors.statusBadge[status as keyof typeof TICKET_THEME.colors.statusBadge] || TICKET_THEME.colors.statusBadge.ouvert;

  switch (status) {
    case "ouvert": 
        return { label: "Ouvert", icon: Circle, style };
    case "en_cours": 
        return { label: "En cours", icon: Clock, style };
    case "résolu": 
        return { label: "Résolu", icon: CheckCircle2, style };
    case "clos": 
        return { label: "Clos", icon: Archive, style };
    default: 
        return { label: "Inconnu", icon: XCircle, style: "bg-gray-100 text-gray-500" };
  }
};

export const fetchTechTeam = async () => {
  try {
    const { profiles} = useProfilesCtx();
    // Filtrer les profils pour ne garder que ceux de l'équipe Tech
    const data = profiles?.filter(profile => profile.service?.nom === 'Tech');
    
    // On mappe pour correspondre au format attendu { id, name }
    return data?.map(u => ({
      id: u.id,
      name: u.full_name || u.email || "Utilisateur"
    })) || [];
  } catch (error) {
    console.error("Erreur lors de la récupération de l'équipe Tech:", error);
    return [];
  }
};