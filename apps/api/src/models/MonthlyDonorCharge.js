import mongoose from 'mongoose';

const monthlyDonorChargeSchema = new mongoose.Schema(
  {
    chargeId: {
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
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      default: 'Doador Mensal Shappire Stickers (30 dias)',
    },
    goatpayId: {
      type: String,
      sparse: true,
      index: true,
    },
    copyPaste: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    rawStatus: {
      type: String,
      default: 'PENDING',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    benefitGranted: {
      type: Boolean,
      default: false,
    },
    badgeGranted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const MonthlyDonorCharge = mongoose.model('MonthlyDonorCharge', monthlyDonorChargeSchema);
