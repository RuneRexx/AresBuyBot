import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
  userId: { type: Number, required: true, unique: true },
  username: { type: String },
  messageId: { type: Number },
  tokensSet: [{ type: Schema.Types.ObjectId, ref: "Settings" }],
});

const User = mongoose.model("User", userSchema);

export default User;
