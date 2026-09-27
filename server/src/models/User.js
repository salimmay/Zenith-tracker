const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // bcrypt hash. Field name kept as `password` so v1 accounts keep working.
    password: { type: String, required: true, select: false },

    settings: {
      // Count TMDB "Season 0" specials in Up Next and progress.
      includeSpecials: { type: Boolean, default: false },
    },

    // Hides every ad slot for this user. Nothing sets it yet — the hook for a
    // future "remove ads" purchase.
    adFree: { type: Boolean, default: false },

    trakt: {
      username: { type: String, default: null },
      connectedAt: { type: Date, default: null },
      lastSyncedAt: { type: Date, default: null },
      accessToken: { type: String, default: null, select: false },
      refreshToken: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },
  },
  { timestamps: true }
);

UserSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    createdAt: this.createdAt,
    settings: { includeSpecials: Boolean(this.settings?.includeSpecials) },
    adFree: Boolean(this.adFree),
    trakt: {
      connected: Boolean(this.trakt?.connectedAt),
      username: this.trakt?.username || null,
      lastSyncedAt: this.trakt?.lastSyncedAt || null,
    },
  };
};

module.exports = mongoose.model('User', UserSchema);
