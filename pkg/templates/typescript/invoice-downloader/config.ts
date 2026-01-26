export const PORTAL_URL = process.env.PORTAL_URL;
export const PORTAL_USERNAME = process.env.PORTAL_USERNAME;
export const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

export function validateEnvironment(): void {
  if (!PORTAL_URL) {
    throw new Error("PORTAL_URL is required in environment variables");
  }
  if (!PORTAL_USERNAME || !PORTAL_PASSWORD) {
    throw new Error("PORTAL_USERNAME and PORTAL_PASSWORD are required in environment variables");
  }
}
