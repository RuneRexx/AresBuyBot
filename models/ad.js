import mongoose from "mongoose";

const adSchema = new mongoose.Schema({
  tokenName: { type: String, required: true, default: "tokenName" },
  text: { type: String, required: true, default: "text" },
  startTime: { type: Date },
  endTime: { type: Date },
  isActive: { type: Boolean, default: false },
});

const Ad = mongoose.model("Ad", adSchema);

export default Ad;
