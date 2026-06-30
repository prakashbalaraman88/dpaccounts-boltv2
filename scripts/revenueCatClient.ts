/**
 * RevenueCat API client for server-side seed scripts.
 * Uses the Replit connectors proxy — do NOT import this in the app.
 *
 * The proxy injects OAuth tokens automatically via @replit/connectors-sdk.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

const BASE = "https://api.revenuecat.com/v2";
const connectors = new ReplitConnectors();

export type ApiResult<T = any> = { data: T; error: null } | { data: null; error: any };

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const opts: any = { method };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers = { "Content-Type": "application/json" };
  }

  const fullPath = path.startsWith("http") ? path : `/v2${path}`;
  const response = await connectors.proxy("revenuecat", fullPath, opts);
  const json = await response.json() as any;

  if (!response.ok) {
    return { data: null, error: json };
  }
  return { data: json as T, error: null };
}

export const rcApi = {
  get:    <T = any>(path: string) =>               request<T>("GET",    path),
  post:   <T = any>(path: string, body?: unknown) => request<T>("POST",   path, body),
  put:    <T = any>(path: string, body?: unknown) => request<T>("PUT",    path, body),
  patch:  <T = any>(path: string, body?: unknown) => request<T>("PATCH",  path, body),
  delete: <T = any>(path: string) =>               request<T>("DELETE", path),
};
