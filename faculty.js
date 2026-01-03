const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  name: String,
  department: String,
  approved: { type: Boolean, default: false },

  // NEW
  subjectPreferences: [
    {
      subject: String,
      priority: Number
    }
  ]
});

module.exports = mongoose.model("Faculty", facultySchema);
