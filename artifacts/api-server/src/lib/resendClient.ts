import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials() {
  const envKey = process.env.RESEND_API_KEY;
  const envFrom = process.env.RESEND_FROM_EMAIL;
  if (envKey && envFrom) {
    return { apiKey: envKey, fromEmail: envFrom };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found for repl/depl");

  const connectorName = "resend";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });

  const data = (await response.json()) as { items?: any[] };
  connectionSettings = data.items?.[0];

  const apiKey = connectionSettings?.settings?.api_key;
  const fromEmail = connectionSettings?.settings?.from_email;

  if (!connectionSettings || !apiKey || !fromEmail) {
    throw new Error(`Resend ${targetEnvironment} connection not found`);
  }

  return { apiKey: apiKey as string, fromEmail: fromEmail as string };
}

// WARNING: Never cache this client. Always call this fresh — tokens expire.
export async function getUncachableResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}
