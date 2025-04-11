const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const backupSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  database: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Automatic", "Manual"],
    default: "Manual",
  },
  mock: {
    type: Boolean,
    default: false,
  },
  size: {
    type: Number,
    default: 0,
  },
});

const Backup = mongoose.model("Backup", backupSchema);

module.exports = {
  connectDB,
  Backup,
};
