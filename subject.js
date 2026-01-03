const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
  department: { type: String, required: true },
  semester: { type: Number, required: true },
  name: { type: String, required: true }
});

module.exports = mongoose.model("Subject", SubjectSchema);
