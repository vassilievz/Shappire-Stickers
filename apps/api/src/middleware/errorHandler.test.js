import { describe, it, expect, vi } from 'vitest';
import multer from 'multer';
import mongoose from 'mongoose';
import { errorHandler } from './errorHandler.js';
import { ApiError } from '../utils/apiError.js';

function buildRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('errorHandler', () => {
  it('devolve status, código estável e mensagem para ApiError', () => {
    const res = buildRes();

    errorHandler(new ApiError(409, 'USERNAME_TAKEN', 'Este username já está em uso.'), {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'USERNAME_TAKEN',
      message: 'Este username já está em uso.',
    });
  });

  it('mapeia MulterError LIMIT_FILE_SIZE para 413 PAYLOAD_TOO_LARGE', () => {
    const res = buildRes();

    errorHandler(new multer.MulterError('LIMIT_FILE_SIZE'), {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'PAYLOAD_TOO_LARGE', message: 'Arquivo muito grande.' });
  });

  it('mapeia corpo JSON grande (entity.too.large) para 413', () => {
    const res = buildRes();

    errorHandler({ type: 'entity.too.large' }, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição muito grande.' });
  });

  it('mapeia ValidationError do Mongoose para 400 VALIDATION_ERROR', () => {
    const res = buildRes();
    const validation = new mongoose.Error.ValidationError();
    validation.addError('username', new mongoose.Error.ValidatorError({ message: 'Username inválido' }));

    errorHandler(validation, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'VALIDATION_ERROR', message: 'Username inválido' });
  });

  it('mapeia duplicidade de username (E11000) para 409 USERNAME_TAKEN', () => {
    const res = buildRes();

    errorHandler({ code: 11000, keyPattern: { username: 1 } }, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'USERNAME_TAKEN', message: 'Este username já está em uso.' });
  });

  it('mapeia outras duplicidades para 409 VALIDATION_ERROR', () => {
    const res = buildRes();

    errorHandler({ code: 11000, keyPattern: { email: 1 } }, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'VALIDATION_ERROR', message: 'Registro duplicado.' });
  });

  it('erro desconhecido vira 500 INTERNAL_ERROR sem vazar detalhes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = buildRes();
    const erro = new Error('ECONNREFUSED mongodb+srv://usuario:senha@host');

    errorHandler(erro, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' });
    const corpo = res.json.mock.calls[0][0];
    expect(Object.keys(corpo)).toEqual(['error', 'message']);
    expect(JSON.stringify(corpo)).not.toContain('ECONNREFUSED');
    consoleError.mockRestore();
  });
});
