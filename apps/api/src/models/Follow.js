import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    followerUid: { type: String, required: true, index: true },
    followingUid: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

followSchema.index({ followerUid: 1, followingUid: 1 }, { unique: true });

export const Follow = mongoose.model('Follow', followSchema);
