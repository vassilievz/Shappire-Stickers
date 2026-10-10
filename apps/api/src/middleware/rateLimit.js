import rateLimit from 'express-rate-limit';

/**
 * Limites por usuário autenticado (§26). A key é o uid do token — os limiters
 * só são montados depois do requireAuth.
 */
function buildLimiter({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.uid ?? req.ip,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisições. Tente novamente em instantes.',
      });
    },
  });
}

export const profileReadLimiter = buildLimiter({ windowMs: 60_000, limit: 60 });
export const profileWriteLimiter = buildLimiter({ windowMs: 60_000, limit: 20 });
export const imageUploadLimiter = buildLimiter({ windowMs: 60_000, limit: 10 });
export const donationCreateLimiter = buildLimiter({ windowMs: 60_000, limit: 10 });
export const donationStatusLimiter = buildLimiter({ windowMs: 60_000, limit: 60 });

