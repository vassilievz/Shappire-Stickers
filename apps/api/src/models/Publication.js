import mongoose from 'mongoose';
import {
  MAX_ALBUM_DESCRIPTION_LENGTH,
  PUBLICATION_MAX_STICKERS,
  PUBLICATION_VISIBILITY,
} from '@shappire/contracts';

const hostedImageSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

const publicationStickerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    fileName: { type: String, required: true },
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    emojis: { type: [String], default: [] },
    accessibilityText: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    isAnimated: { type: Boolean, default: false },
    durationMs: { type: Number },
  },
  { _id: false },
);

const publicationSchema = new mongoose.Schema(
  {
    ownerUid: { type: String, required: true, index: true },
    localPackId: { type: String, default: null },
    title: { type: String, required: true, trim: true, maxlength: 128 },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: MAX_ALBUM_DESCRIPTION_LENGTH,
    },
    cover: { type: hostedImageSchema, default: null },
    stickers: {
      type: [publicationStickerSchema],
      default: [],
      validate: [(v) => v.length <= PUBLICATION_MAX_STICKERS, 'Limite de figurinhas excedido.'],
    },
    stickerCount: { type: Number, default: 0, min: 0 },
    visibility: {
      type: String,
      enum: Object.values(PUBLICATION_VISIBILITY),
      default: PUBLICATION_VISIBILITY.private,
      index: true,
    },
    isAdultContent: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    collectionCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'removed', 'moderated'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true },
);

publicationSchema.index({ ownerUid: 1, localPackId: 1 }, { unique: true, sparse: true });
publicationSchema.index({ visibility: 1, status: 1, publishedAt: -1, _id: -1 });
publicationSchema.index({ visibility: 1, status: 1, likeCount: -1, _id: -1 });
publicationSchema.index({ visibility: 1, status: 1, collectionCount: -1, _id: -1 });
publicationSchema.index({ title: 'text', description: 'text' });

export const Publication = mongoose.model('Publication', publicationSchema);
