import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import * as React from "react";

export type MockUser = {
	id: number;
	email: string;
	name: string;
	is_admin: boolean;
	is_jcrc: boolean;
	is_culture_sports_admin: boolean;
};

const MockAuthContext = React.createContext<{
	user: MockUser | null;
	loading: boolean;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
} | null>(null);

export function useMockAuth() {
	const ctx = React.useContext(MockAuthContext);
	if (!ctx) throw new Error("useMockAuth used outside MockAuthProvider");
	return ctx;
}

type RenderWithProvidersOptions = RenderOptions & {
	user?: MockUser | null;
};

export function renderWithProviders(
	ui: React.ReactElement,
	options: RenderWithProvidersOptions = {},
): RenderResult {
	const { user = null, ...renderOptions } = options;

	const noop = async () => {};

	function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
				<MockAuthContext.Provider value={{ user, loading: false, signIn: noop, signOut: noop }}>
					{children}
				</MockAuthContext.Provider>
			</ThemeProvider>
		);
	}

	return render(ui, { wrapper: Wrapper, ...renderOptions });
}
