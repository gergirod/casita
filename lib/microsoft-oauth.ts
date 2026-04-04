import { encrypt, decrypt } from "@/lib/encrypt";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const SCOPES = ["https://graph.microsoft.com/Mail.Read", "offline_access", "openid", "email"];

function getCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required");
  }
  return { clientId, clientSecret };
}

function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/auth/microsoft-email/callback`;
}

export function buildMicrosoftAuthUrl(workspaceId: string): string {
  const { clientId } = getCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    response_mode: "query",
    prompt: "consent",
    state: workspaceId,
  });

  return `${MS_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeMsCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  email: string;
}> {
  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MS token exchange failed: ${err}`);
  }

  const data = (await response.json()) as TokenResponse;

  if (!data.refresh_token) {
    throw new Error("No refresh token returned from Microsoft.");
  }

  const email = await getEmailFromToken(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email,
  };
}

export async function refreshMsAccessToken(encryptedRefreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getCredentials();
  const refreshToken = decrypt(encryptedRefreshToken);

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPES.join(" "),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MS token refresh failed: ${err}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

export function encryptMsRefreshToken(token: string): string {
  return encrypt(token);
}

async function getEmailFromToken(accessToken: string): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Could not fetch Microsoft profile");

  const profile = (await res.json()) as { mail?: string; userPrincipalName: string };
  return profile.mail ?? profile.userPrincipalName;
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}
