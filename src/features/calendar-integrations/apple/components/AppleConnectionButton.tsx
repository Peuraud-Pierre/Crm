/**
 * Component for connecting to Apple iCloud Calendar
 */

import { useState } from 'react';
import { Button } from '@/shared/ui/atoms/button';
import { Badge } from '@/shared/ui/atoms/badge';
import { Input } from '@/shared/ui/atoms/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/atoms/popover';
import { Apple, Loader2, ExternalLink, Info } from 'lucide-react';
import { useAppleAuth } from '../hooks/useAppleAuth';

export const AppleConnectionButton = () => {
  const {
    connection,
    isConnected,
    isConnecting,
    isLoading,
    connectToApple,
    disconnectApple,
  } = useAppleAuth();

  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const resetForm = () => {
    setShowHelp(false);
    setEmail('');
    setAppPassword('');
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (isConnected && connection) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{connection.email}</Badge>
        <Button size="sm" variant="destructive" onClick={disconnectApple}>
          Déconnecter
        </Button>
      </div>
    );
  }

  return (
    // Popover (déjà animé fade-in/zoom-in via l'atom partagé) plutôt qu'un
    // panneau qui s'ouvrait inline dans le header : ça évite de faire sauter
    // toute la mise en page du calendrier sans transition à l'ouverture.
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <PopoverTrigger asChild>
        <Button>
          <Apple className="mr-2 h-4 w-4" />
          Connecter Apple
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 flex flex-col gap-3" align="end">
        {/* Aide */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
          >
            <Info className="h-4 w-4 text-primary" />
            <span>Comment obtenir un mot de passe d'application ?</span>
          </button>

          {showHelp && (
            <div className="mt-3 text-xs text-muted-foreground space-y-2 animate-in fade-in slide-in-from-top-1 duration-base">
              <p className="font-semibold text-foreground">
                📱 Sur iPhone/iPad :
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  Ouvrez l'app <strong>Réglages</strong>
                </li>
                <li>Touchez votre nom en haut</li>
                <li>
                  Touchez <strong>Connexion et sécurité</strong>
                </li>
                <li>
                  Touchez <strong>Mots de passe d'app</strong>
                </li>
                <li>
                  Touchez <strong>+</strong> pour générer un nouveau mot de
                  passe
                </li>
                <li>Donnez-lui un nom (ex: "Nokk_project")</li>
                <li>Copiez le mot de passe et collez-le ici</li>
              </ol>

              <p className="font-semibold text-foreground mt-3">
                💻 Sur Mac/Web :
              </p>
              <a
                href="https://appleid.apple.com/account/manage/section/security"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                Ouvrir Identifiant Apple
                <ExternalLink className="h-3 w-3" />
              </a>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
                <li>Connectez-vous sur appleid.apple.com</li>
                <li>
                  Section <strong>Sécurité</strong>
                </li>
                <li>
                  <strong>Mots de passe d'app</strong>
                </li>
                <li>Générez un nouveau mot de passe</li>
              </ol>

              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                <p className="text-amber-800 dark:text-amber-200">
                  ⚠️ <strong>Important :</strong> L'authentification à deux
                  facteurs doit être activée sur votre compte Apple.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Champs du formulaire */}
        <Input
          placeholder="Email iCloud (ex: nom@icloud.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder="Mot de passe d'app (xxxx-xxxx-xxxx-xxxx)"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          autoComplete="off"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            disabled={!email || !appPassword}
            loading={isConnecting}
            onClick={async () => {
              try {
                await connectToApple(email, appPassword);
                setOpen(false);
                resetForm();
              } catch {
                // Error is already handled in the hook
              }
            }}
            className="flex-1"
          >
            {isConnecting ? "Connexion…" : "Valider"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isConnecting}
          >
            Annuler
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
