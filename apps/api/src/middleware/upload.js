import multer from 'multer';
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  PUBLICATION_COVER_MAX_BYTES,
  PUBLICATION_STICKER_MAX_BYTES,
} from '@shappire/contracts';
import { ApiError } from '../utils/apiError.js';

/**
 * Uploads em memória (buffer) com limite de tamanho por slot e pré-filtro de
 * MIME declarado. A checagem real de conteúdo (magic bytes) acontece no
 * profileService — o MIME declarado pelo cliente não é confiável (§15).
 */
function buildUpload(maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      if (PROFILE_IMAGE_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formato de imagem não suportado.'));
      }
    },
  });
}

export const avatarUpload = buildUpload(PROFILE_IMAGE_MAX_BYTES.avatar);
export const bannerUpload = buildUpload(PROFILE_IMAGE_MAX_BYTES.banner);
export const publicationStickerUpload = buildUpload(PUBLICATION_STICKER_MAX_BYTES);
export const publicationCoverUpload = buildUpload(PUBLICATION_COVER_MAX_BYTES);
