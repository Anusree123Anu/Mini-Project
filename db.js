const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/loginapp");

    console.log("MongoDB Connected to LoginApp database");
  } catch (err) {
    console.error("DB connection failed", err);
    process.exit(1);
  }
};

module.exports = connectDB;
