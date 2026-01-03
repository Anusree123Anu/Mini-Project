// settings.js
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  preferenceDeadline: Date
});

module.exports = mongoose.model("Settings", settingsSchema);
