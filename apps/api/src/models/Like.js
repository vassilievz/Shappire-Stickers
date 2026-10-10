import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    userUid: { type: String, required: true, index: true },
    publicationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Publication' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

likeSchema.index({ userUid: 1, publicationId: 1 }, { unique: true });

export const Like = mongoose.model('Like', likeSchema);
