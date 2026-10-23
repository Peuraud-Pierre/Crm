import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";
import { useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import { useShellReady } from "@/features/auth/components/shell/shellReady";
import { env } from "@/shared/lib/env";

export interface TurnstileHandle {
	reset: () => void;
	/**
	 * Attend le jeton du widget (déjà résolu → immédiat). Rejette après
	 * `timeoutMs` si Cloudflare n'a pas répondu : l'appelant affiche alors
	 * une erreur au lieu de laisser le bouton tourner indéfiniment.
	 */
	getToken: (timeoutMs?: number) => Promise<string>;
}

interface Props {
	onVerify?: (token: string) => void;
	/** `true` quand Cloudflare affiche un défi à résoudre (case à cocher). */
	onInteractiveChange?: (interactive: boolean) => void;
	ref?: Ref<TurnstileHandle>;
}

// Clé de test Cloudflare (toujours valide) utilisée en fallback hors production
const TURNSTILE_SITE_KEY =
	env.PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

const DEFAULT_TIMEOUT_MS = 20_000;
/** Pas d'attente du widget quand il n'est pas encore monté (fin d'intro). */
const WIDGET_POLL_MS = 100;

/**
 * Captcha Turnstile en mode `interaction-only` : invisible tant que
 * Cloudflare n'a pas de doute, ce qui est le cas courant. Le formulaire ne
 * bloque plus son bouton sur le captcha : il appelle `getToken()` au clic.
 *
 * ⚠️ Côté dashboard Cloudflare, le widget doit être en mode « Managed » —
 * en mode « Non-interactive », il n'y a jamais d'interaction à montrer.
 *
 * Monté seulement quand l'écran d'auth est prêt (fin de l'intro, voir
 * shellReady.ts) : le script Cloudflare et son iframe ne se chargent plus
 * pendant l'animation, qu'ils faisaient saccader sur une connexion lente.
 */
export function TurnstileField({ onVerify, onInteractiveChange, ref }: Props) {
	const captchaRef = useRef<TurnstileInstance | null>(null);
	const { resolvedTheme } = useTheme();
	const ready = useShellReady();

	useImperativeHandle(ref, () => ({
		reset: () => {
			captchaRef.current?.reset();
		},
		getToken: async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
			// Envoi juste après la fin de l'intro : le widget est peut-être
			// encore en cours de montage. On l'attend, dans le même délai.
			const deadline = Date.now() + timeoutMs;
			while (!captchaRef.current) {
				if (Date.now() >= deadline) throw new Error("turnstile-not-ready");
				await new Promise((resolve) => setTimeout(resolve, WIDGET_POLL_MS));
			}
			return captchaRef.current.getResponsePromise(Math.max(1, deadline - Date.now()));
		},
	}));

	if (!ready) return null;

	return (
		// Le défi interactif fait 300px de large au minimum côté Cloudflare ;
		// size "flexible" le laisse suivre la largeur du formulaire et
		// max-w-full évite qu'il pousse la page en défilement horizontal à 320px.
		<div className="flex max-w-full justify-center overflow-hidden empty:hidden">
			<Turnstile
				siteKey={TURNSTILE_SITE_KEY}
				onSuccess={(token) => onVerify?.(token)}
				onExpire={() => onVerify?.("")}
				onError={() => onVerify?.("")}
				onBeforeInteractive={() => onInteractiveChange?.(true)}
				onAfterInteractive={() => onInteractiveChange?.(false)}
				ref={captchaRef}
				className="w-full"
				options={{
					language: "fr",
					appearance: "interaction-only",
					size: "flexible",
					theme: resolvedTheme === "dark" ? "dark" : "light",
				}}
			/>
		</div>
	);
}
