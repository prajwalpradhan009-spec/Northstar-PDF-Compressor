const mongoose = require('mongoose');

/**
 * One row per completed tool run, used to power the dashboard counters.
 * Only metadata is kept — never the file contents.
 */
const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['pdf-merge', 'image-compress'],
      index: true,
    },
    fileCount: { type: Number, default: 1, min: 0 },
    // Combined size of the inputs, in bytes.
    inputBytes: { type: Number, default: 0, min: 0 },
    // Combined size of the outputs, in bytes (0 when the user was anonymous).
    outputBytes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Dashboard reads are always "this user's counters", newest first.
activitySchema.index({ user: 1, createdAt: -1 });

activitySchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    type: this.type,
    fileCount: this.fileCount,
    inputBytes: this.inputBytes,
    outputBytes: this.outputBytes,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
