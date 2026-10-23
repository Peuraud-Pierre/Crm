import { createContext, type ReactNode, use, useState } from "react";

interface SessionKeyContextValue {
	cryptoKey: CryptoKey | null;
	setCryptoKey: (key: CryptoKey | null) => void;
}

const SessionKeyContext = createContext<SessionKeyContextValue | undefined>(
	undefined
);

export const SessionKeyProvider = ({ children }: { children: ReactNode }) => {
	const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

	return (
		<SessionKeyContext value={{ cryptoKey, setCryptoKey }}>
			{children}
		</SessionKeyContext>
	);
};

 
export const useSessionKeyContext = () => {
	const context = use(SessionKeyContext);
	if (!context)
		throw new Error(
			"useSessionKeyContext must be used within a SessionKeyProvider"
		);
	return context;
};
