// Injected by Vite define at build time
declare const __COMMIT_HASH__: string;

export const COMMIT_HASH: string = typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev";

export const GITHUB_REPO_URL = "https://github.com/arthow4n/accordion-lead-sheet-companion";

export const COMMIT_URL = `${GITHUB_REPO_URL}/commit/${COMMIT_HASH}`;
