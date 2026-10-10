import mongoose from 'mongoose';
import { MAX_COMMENT_LENGTH } from '@shappire/contracts';

const commentSchema = new mongoose.Schema(
  {
    publicationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Publication' },
    authorUid: { type: String, required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: MAX_COMMENT_LENGTH },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    moderationStatus: {
      type: String,
      enum: ['visible', 'removed', 'moderated'],
      default: 'visible',
      index: true,
    },
  },
  { timestamps: true },
);

commentSchema.index({ publicationId: 1, createdAt: -1, _id: -1 });

export const Comment = mongoose.model('Comment', commentSchema);
