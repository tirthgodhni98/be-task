const express = require("express");
const cron = require("cron");
const cors = require("cors");
const { runBackup, getBackup } = require("./backup");
const restoreBackup = require("./restore");
const { connectDB } = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const backupSchedule = process.env.BACKUP_FREQUENCY_DAYS;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mockResponse = {
  status: (code) => ({
    send: (message) => {
      console.log(`[Mock Response] Status: ${code}, Message: ${message}`);
    },
  }),
};

const job = new cron.CronJob(backupSchedule, () => {
  runBackup({ body: { type: "Automatic" } }, mockResponse);
});

job.start();

app.get("/", (req, res) => res.send("MongoDB Backup Service Running"));
app.post("/backup", runBackup);
app.get("/backups", getBackup);
app.post("/restore", restoreBackup);

app.listen(PORT, async () => {
  console.log(`Server started at http://localhost:${PORT}`);
  try {
    await connectDB();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error.message);
  }
});
