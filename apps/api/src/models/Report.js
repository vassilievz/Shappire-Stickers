import mongoose from 'mongoose';
import { MAX_REPORT_DETAILS_LENGTH, REPORT_REASONS, REPORT_TARGET_TYPES } from '@shappire/contracts';

const reportSchema = new mongoose.Schema(
  {
    reporterUid: { type: String, required: true, index: true },
    targetType: {
      type: String,
      required: true,
      enum: Object.values(REPORT_TARGET_TYPES),
    },
    targetId: { type: String, required: true, index: true },
    reason: { type: String, required: true, enum: REPORT_REASONS },
    details: { type: String, default: '', trim: true, maxlength: MAX_REPORT_DETAILS_LENGTH },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reportSchema.index({ reporterUid: 1, targetType: 1, targetId: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
