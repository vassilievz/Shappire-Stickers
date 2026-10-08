import mongoose from 'mongoose';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@shappire/contracts';

/**
 * Metadados de imagem hospedada no V0X. O MongoDB guarda SOMENTE estes
 * metadados — nunca binário (§13).
 */
const profileImageSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: { type: String, required: true },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_DISPLAY_NAME_LENGTH,
    },
    // Sempre normalizado (minúsculo, sem acentos). `sparse` permite vários
    // perfis sem username (null).
    username: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      minlength: USERNAME_MIN_LENGTH,
      maxlength: USERNAME_MAX_LENGTH,
      match: USERNAME_PATTERN,
    },
    bio: { type: String, default: '', trim: true, maxlength: MAX_BIO_LENGTH },
    avatar: { type: profileImageSchema, default: null },
    banner: { type: profileImageSchema, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
