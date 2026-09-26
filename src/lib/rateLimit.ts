// Rate limiting basique en mémoire process : N requêtes / IP / fenêtre glissante.
// Suffisant pour un seul serveur Node (dev, petit déploiement mono-instance).
// Si l'app tourne un jour multi-instance, remplacer par un store partagé (Redis, etc.).

const WINDOW_MS = 60 * 60 * 1000; // 1 heure
const MAX_REQUESTS = 5;

type Hit = { count: number; windowStart: number };

const hits = new Map<string, Hit>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const existing = hits.get(identifier);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    hits.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterMs: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.windowStart + WINDOW_MS - now,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterMs: 0,
  };
}

export function getClientIdentifier(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
