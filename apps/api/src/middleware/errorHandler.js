import multer from 'multer';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Handler central de erros (§24/§28). Nunca devolve stack trace, string de
 * conexão, token ou qualquer segredo — apenas código estável + mensagem.
 * O detalhe técnico fica no log do servidor, também sem segredos.
 */
export function errorHandler(error, _req, res, _next) {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Arquivo muito grande.',
    });
    return;
  }

  if (error?.type === 'entity.too.large' || error?.status === 413) {
    res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Corpo da requisição muito grande.',
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: first?.message ?? 'Dados inválidos.',
    });
    return;
  }

  if (error?.code === 11000) {
    const key = Object.keys(error.keyPattern ?? {})[0];
    if (key === 'username') {
      res.status(409).json({
        error: 'USERNAME_TAKEN',
        message: 'Este username já está em uso.',
      });
      return;
    }
    res.status(409).json({
      error: 'VALIDATION_ERROR',
      message: 'Registro duplicado.',
    });
    return;
  }

  console.error('[api] erro interno:', {
    message: error?.message,
    stack: env.isProduction ? undefined : error?.stack,
  });
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor.',
  });
}
