const mongoose = require('mongoose');

const STATUSES = ['watching', 'waiting', 'plan_to_watch', 'paused', 'completed', 'dropped'];
const MEDIA_TYPES = ['tv', 'movie'];

// One document per title in a user's library. Collection name (`shows`) is
// unchanged from v1 so existing libraries carry over.
const ShowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'tv' },

    showName: { type: String, required: true },
    posterPath: { type: String, default: null },
    backdropPath: { type: String, default: null },
    isAnime: { type: Boolean, default: false },
    runtime: { type: Number, default: 0 }, // minutes per episode, or movie length
    genres: [{ type: String }],
    year: { type: Number, default: null },
    totalEpisodes: { type: Number, default: 0 },
    tmdbStatus: { type: String, default: null }, // "Returning Series", "Ended", …

    status: { type: String, enum: STATUSES, default: 'watching' },
    // v1 flag: true when the user picked the status by hand.
    manualStatus: { type: Boolean, default: false },

    progress: {
      season: { type: Number, default: 1 },
      episode: { type: Number, default: 0 },
      totalEpisodesWatched: { type: Number, default: 0 },
    },

    // Movies
    isWatched: { type: Boolean, default: false },

    rating: { type: Number, min: 1, max: 10, default: null },
    lastWatchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ShowSchema.index({ userId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });
ShowSchema.index({ userId: 1, status: 1, lastWatchedAt: -1 });

ShowSchema.statics.STATUSES = STATUSES;
ShowSchema.statics.MEDIA_TYPES = MEDIA_TYPES;

module.exports = mongoose.model('Show', ShowSchema);
