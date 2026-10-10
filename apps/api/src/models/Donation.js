import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
  {
    donationId: {
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
      default: 'Apoio voluntário Shappire Stickers',
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
    badgeGranted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Donation = mongoose.model('Donation', donationSchema);
