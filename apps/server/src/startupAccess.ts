// FILE: startupAccess.ts
// Purpose: Classifies bind hosts and centralizes startup access decisions.
// Used by: CLI startup, runtime-state reporting, trusted-origin and auth policies.

export const isWildcardHost = (host: string | undefined): boolean =>
  host === "0.0.0.0" || host === "::" || host === "[::]";

export const isLoopbackHost = (host: string | undefined): boolean => {
  if (!host) return true;
  const normalized = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

/**
 * A non-loopback bind is remotely reachable and must not run without an auth
 * mechanism. An omitted host is remote because Node binds the unspecified
 * address when only a port is supplied.
 */
export const isRemoteReachableHost = (host: string | undefined): boolean =>
  host === undefined || isWildcardHost(host) || !isLoopbackHost(host);

/**
 * Pure decision for the startup fail-fast guard: a non-loopback bind is only
 * safe without a legacy auth token when running in `desktop` mode (where the
 * session-auth bootstrap policy applies instead of the legacy query token).
 */
export const requiresAuthTokenForBind = (input: {
  readonly host: string | undefined;
  readonly authToken: string | undefined;
  readonly mode: string;
}): boolean => isRemoteReachableHost(input.host) && !input.authToken && input.mode !== "desktop";

export const formatHostForUrl = (host: string): string =>
  host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

export const resolveListeningPort = (address: unknown, fallbackPort: number): number => {
  if (
    typeof address === "object" &&
    address !== null &&
    "port" in address &&
    typeof address.port === "number"
  ) {
    return address.port;
  }
  return fallbackPort;
};
