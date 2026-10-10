import mongoose from 'mongoose';

const referralRewardSchema = new mongoose.Schema(
  {
    redemptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    invitesConsumed: {
      type: Number,
      required: true,
      min: 1,
    },
    grantedExpiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

export const ReferralReward = mongoose.model('ReferralReward', referralRewardSchema);
