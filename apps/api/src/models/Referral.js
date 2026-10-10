import mongoose from 'mongoose';
import { REFERRAL_STATUSES } from '@shappire/contracts';

const referralSchema = new mongoose.Schema(
  {
    inviterUid: {
      type: String,
      required: true,
      index: true,
    },
    inviteeUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    inviteCode: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(REFERRAL_STATUSES),
      default: REFERRAL_STATUSES.qualified,
      index: true,
    },
    qualifiedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: true },
);

export const Referral = mongoose.model('Referral', referralSchema);
