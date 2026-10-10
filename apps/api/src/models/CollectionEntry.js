import mongoose from 'mongoose';

const collectionEntrySchema = new mongoose.Schema(
  {
    userUid: { type: String, required: true, index: true },
    publicationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Publication' },
    sourceOwnerUid: { type: String, required: true },
    localPackId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

collectionEntrySchema.index({ userUid: 1, publicationId: 1 }, { unique: true });

export const CollectionEntry = mongoose.model('CollectionEntry', collectionEntrySchema);
