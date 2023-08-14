import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  address: { type: String, required: true },
  pair: { type: String, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  decimals: { type: Number, required: true },
  totalSupply: { type: Number, required: true },
  holders: { type: Number, required: true },
});

const Token = mongoose.model("Token", tokenSchema);

export default Token;
