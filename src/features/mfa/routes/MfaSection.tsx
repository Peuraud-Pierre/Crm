import { Button } from "@/shared/ui/atoms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card";
import { Input } from "@/shared/ui/atoms/input";
import {
	challengeMfaFactor,
	enrollTotpFactor,
	listMfaFactors,
	unenrollMfaFactor,
	verifyMfaChallenge,
} from "@/features/mfa/services/mfaService";
import type { Factor } from "@supabase/supabase-js";
import { RefreshCw, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type TotpFactor =
	| {
			id: string;
			factor_type: "totp";
			status: "verified" | "unverified";
	  }
	| undefined;

export default function MfaSection() {
	const [loading, setLoading] = useState(false);
	const [mfaEnabled, setMfaEnabled] = useState(false);
	const [currentTotp, setCurrentTotp] = useState<TotpFactor>(undefined);

	const [factorId, setFactorId] = useState<string | null>(null);
	const [otpUri, setOtpUri] = useState<string | null>(null);
	const [otpSecret, setOtpSecret] = useState<string | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [code, setCode] = useState("");

	/** Génère le QR code (lib qrcode sinon fallback) */
	const makeQr = async (uri: string) => {
		try {
			const QR = await import("qrcode");
			const dataUrl = await QR.toDataURL(uri);
			setQrDataUrl(dataUrl);
		} catch {
			setQrDataUrl(
				`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
					uri
				)}`
			);
		}
	};

	/** Vérifie l’état MFA (et récupère le facteur TOTP si présent) */
	const checkMfaStatus = async () => {
		try {
			const { data, error } = await listMfaFactors();
			if (error) throw error;

			const totp = data?.all?.find(
				(f: Factor) => f.factor_type === "totp"
			) as TotpFactor;

			setCurrentTotp(totp);
			setMfaEnabled(!!totp && totp.status === "verified");
		} catch (err) {
			console.error("Erreur listFactors:", err);
		}
	};

	/** Démarre l’enrôlement TOTP */
	const enableMfa = async () => {
		setLoading(true);
		try {
			const { data, error } = await enrollTotpFactor();
			if (error) throw error;

			type EnrollResult = {
				id?: string;
				totp?: { uri?: string; secret?: string };
				factor?: {
					id?: string;
					totp?: { uri?: string; secret?: string };
				};
			};
			const enrollData = data as EnrollResult | null;
			const id = enrollData?.id || enrollData?.factor?.id;
			const totpInfo = enrollData?.totp || enrollData?.factor?.totp;

			setFactorId(id ?? null);
			setOtpUri(totpInfo?.uri ?? null);
			setOtpSecret(totpInfo?.secret ?? null);
			if (totpInfo?.uri) await makeQr(totpInfo.uri);

			toast.message(
				"Scannez le QR code avec votre app d’authentification"
			);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Impossible d’activer la 2FA"
			);
		} finally {
			setLoading(false);
		}
	};

	/** Vérifie le code TOTP */
	const verifyMfa = async () => {
		if (!factorId || code.trim().length < 6) return;
		setLoading(true);
		try {
			const { data: challenge } = await challengeMfaFactor(factorId);
			// Garde null : sans challenge, la vérification est impossible
			if (!challenge) throw new Error("Échec du challenge MFA");

			const { error } = await verifyMfaChallenge(
				factorId,
				challenge.id,
				code
			);
			if (error) throw error;

			toast.success("Double authentification activée ✅");
			setOtpUri(null);
			setCode("");
			setFactorId(null);
			await checkMfaStatus();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Code invalide");
		} finally {
			setLoading(false);
		}
	};

	/** Désactive le facteur TOTP (nécessite OTP valide) */
	const disableMfa = async () => {
		if (!currentTotp?.id) return;
		const otpCode = prompt("Entrez votre code 2FA pour désactiver :");
		if (!otpCode) return;

		setLoading(true);
		try {
			const { data: challenge } = await challengeMfaFactor(currentTotp.id);
			// Garde null : sans challenge, la vérification est impossible
			if (!challenge) throw new Error("Échec du challenge MFA");

			const { error: verifyError } = await verifyMfaChallenge(
				currentTotp.id,
				challenge.id,
				otpCode
			);
			if (verifyError) throw verifyError;

			const { error: unenrollError } = await unenrollMfaFactor(
				currentTotp.id
			);
			if (unenrollError) throw unenrollError;

			toast.success("2FA désactivée avec succès");
			await checkMfaStatus();
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Erreur lors de la désactivation"
			);
		} finally {
			setLoading(false);
		}
	};

	const cancelEnroll = () => {
		setFactorId(null);
		setOtpUri(null);
		setOtpSecret(null);
		setQrDataUrl(null);
		setCode("");
	};

	useEffect(() => {
		checkMfaStatus();
	}, []);

	return (
		<Card className="border-primary/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg font-semibold">
					<Shield className="w-5 h-5 text-primary" />
					Sécurité du compte
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* État actuel */}
				{mfaEnabled ? (
					<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
						<div>
							<p className="font-medium">
								Double authentification (TOTP)
							</p>
							<p className="text-sm text-muted-foreground">
								✅ Activée pour ce compte.
							</p>
						</div>
						<Button
							variant="outline"
							onClick={disableMfa}
							disabled={loading}
						>
							<X className="w-4 h-4 mr-2" />
							Désactiver
						</Button>
					</div>
				) : (
					<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
						<div>
							<p className="font-medium">
								Double authentification (TOTP)
							</p>
							<p className="text-sm text-muted-foreground">
								Ajoutez une vérification via application (Google
								Authenticator, Authy…)
							</p>
						</div>
						<Button onClick={enableMfa} disabled={loading}>
							{loading
								? "Activation..."
								: "Activer la double authentification"}
						</Button>
					</div>
				)}

				{/* QR + vérification */}
				{otpUri && (
					<div className="rounded-md border p-4 space-y-3">
						<p className="text-sm text-muted-foreground">
							Scannez ce QR code, puis entrez le code à 6 chiffres
							:
						</p>
						{qrDataUrl ? (
							<img
								src={qrDataUrl}
								alt="QR Code MFA"
								className="w-[220px] h-[220px] mx-auto"
							/>
						) : (
							<p className="text-xs text-center text-muted-foreground">
								Génération du QR…
							</p>
						)}
						<div className="text-xs text-muted-foreground text-center">
							Clé secrète :{" "}
							<code className="px-1 py-0.5 bg-muted rounded">
								{otpSecret}
							</code>
						</div>
						<div className="flex gap-2 items-center justify-center">
							<Input
								placeholder="Code à 6 chiffres"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								maxLength={6}
								className="max-w-[180px] text-center tracking-widest"
							/>
							<Button
								onClick={verifyMfa}
								disabled={loading || code.length < 6}
							>
								Vérifier
							</Button>
							<Button variant="ghost" onClick={cancelEnroll}>
								<X className="w-4 h-4 mr-1" />
								Annuler
							</Button>
						</div>
					</div>
				)}

				<div className="flex justify-end">
					<Button
						variant="ghost"
						size="sm"
						onClick={checkMfaStatus}
						disabled={loading}
					>
						<RefreshCw className="w-4 h-4 mr-2" />
						Re-vérifier le statut
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
