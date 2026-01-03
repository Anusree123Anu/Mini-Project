const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
  regNo: { type: String, unique: true },
  mobile: String,
  email: { type: String, unique: true, required: true },
  password: String
});

module.exports = mongoose.model("Student", studentSchema);
