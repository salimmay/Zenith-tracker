const mongoose = require('mongoose');

/**
 * One row per watch: an episode, a movie, or (source "import"/"trakt") a batch
 * of episodes whose individual dates we don't know. Stats are built from this,
 * so "time watched this month" reflects when things were actually watched.
 */
const HistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tmdbId: { type: Number, required: true },
  mediaType: { type: String, enum: ['tv', 'movie'], required: true },
  season: { type: Number, default: null },
  episode: { type: Number, default: null },
  episodes: { type: Number, default: 1 }, // >1 only for batch rows
  minutes: { type: Number, default: 0 },
  watchedAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['app', 'trakt', 'import', 'guest'], default: 'app' },
});

HistorySchema.index({ userId: 1, watchedAt: -1 });
HistorySchema.index({ userId: 1, tmdbId: 1, mediaType: 1, season: 1, episode: 1 });

module.exports = mongoose.model('History', HistorySchema);
