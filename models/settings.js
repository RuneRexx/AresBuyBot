import mongoose from 'mongoose';

const { Schema } = mongoose;

const settingsSchema = new Schema({
  groupId: { type: Number },
  tokenId: { type: Schema.Types.ObjectId, ref: 'Token' },
  minBuy: { type: Number },
  step: { type: Number },
  emoji: { type: String },
  charts: {
    type: String,
    enum: ['Geckoterminal', 'Dextools', 'Dexscreener', 'Coinscan'],
  },
  paused: { type: Boolean },
  mediaEnabled: { type: Boolean },
  mediaImage: { type: String },
  mediaThreshold: { type: Number },
  socialLinks: {
    Telegram: { type: String },
    Website: { type: String },
    Twitter: { type: String },
  },
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
