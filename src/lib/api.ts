import { NextResponse } from 'next/server';

/**
 * Normalized API error — every route handler throws / returns these,
 * and the frontend data layer maps `code` to human messages.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const ERR = {
  UNAUTHORIZED: () => new ApiError(401, 'UNAUTHORIZED', 'Требуется вход в кабинет организатора'),
  FORBIDDEN: (m = 'Недостаточно прав для этого действия') => new ApiError(403, 'FORBIDDEN', m),
  NOT_FOUND: (m = 'Не найдено') => new ApiError(404, 'NOT_FOUND', m),
  VALIDATION: (details: unknown, m = 'Проверьте правильность заполнения формы') =>
    new ApiError(400, 'VALIDATION_ERROR', m, details),
  REGISTRATION_CLOSED: () =>
    new ApiError(403, 'REGISTRATION_CLOSED', 'Регистрация на это соревнование завершена'),
  DUPLICATE: (details: unknown) =>
    new ApiError(409, 'DUPLICATE_APPLICATION', 'У вас уже есть заявка на это соревнование', details),
  RATE_LIMITED: () => new ApiError(429, 'RATE_LIMITED', 'Слишком много попыток. Попробуйте позже'),
  EMAIL_TAKEN: () =>
    new ApiError(409, 'EMAIL_TAKEN', 'Этот e-mail уже зарегистрирован. Войдите в кабинет'),
  EMAIL_CLAIMED: () =>
    new ApiError(
      409,
      'EMAIL_CLAIMED',
      'Этот e-mail уже привязан к другому аккаунту. Войдите или используйте другой e-mail'
    ),
  PAYLOAD_TOO_LARGE: (maxMb: number) =>
    new ApiError(413, 'PAYLOAD_TOO_LARGE', `Файл слишком большой. Максимум — ${maxMb} МБ`),
  UNSUPPORTED_FILE: () =>
    new ApiError(415, 'UNSUPPORTED_FILE', 'Формат файла не поддерживается. Разрешены PDF, JPG, PNG, WEBP'),
  INTERNAL: (m = 'Временная ошибка сервера. Попробуйте позже') =>
    new ApiError(500, 'INTERNAL', m),
};

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a handler body so thrown ApiErrors become clean JSON responses. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, details: e.details ?? null } },
        { status: e.status }
      );
    }
    console.error('[api] unexpected error:', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Временная ошибка сервера. Попробуйте позже' } },
      { status: 500 }
    );
  });
}

// ------------------------------------------------------------
// Simple in-memory rate limiter (per IP, sliding window).
// Enough for the demo scale; replace with Redis/Upstash for prod.
// ------------------------------------------------------------
const buckets = new Map<string, number[]>();

export function rateLimit(req: Request, key: string, limit: number, windowMs: number) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const stamps = (buckets.get(bucketKey) || []).filter((t) => now - t < windowMs);
  stamps.push(now);
  buckets.set(bucketKey, stamps);
  if (stamps.length > limit) throw ERR.RATE_LIMITED();
  // opportunistic cleanup so the map does not grow forever
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  );
}
