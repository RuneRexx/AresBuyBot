import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  username: { type: String },
});

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
