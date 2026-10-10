import mongoose from 'mongoose';

const userBlockSchema = new mongoose.Schema(
  {
    blockerUid: { type: String, required: true, index: true },
    blockedUid: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userBlockSchema.index({ blockerUid: 1, blockedUid: 1 }, { unique: true });

export const UserBlock = mongoose.model('UserBlock', userBlockSchema);
