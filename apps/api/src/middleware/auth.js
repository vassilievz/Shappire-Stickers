import { getFirebaseAuth } from '../config/firebase.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Exige um Firebase ID Token válido em `Authorization: Bearer <token>`.
 * A identidade vem SEMPRE do token verificado — uid/email/username enviados
 * pelo cliente são ignorados (§10).
 */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Token de autenticação ausente.'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Token de autenticação ausente.'));
    return;
  }
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email ?? null };
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Token inválido ou expirado.'));
  }
}

/** Autentica quando há token válido; caso contrário `req.user` permanece null. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    next();
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    req.user = null;
    next();
    return;
  }
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    req.user = null;
  }
  next();
}
