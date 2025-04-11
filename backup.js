const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { connectDB, Backup } = require("./db");

const uri = process.env.MONGO_URI;
const backupFolder = process.env.BACKUP_FOLDER || "./backup";

const runBackup = async (req, res) => {
  console.log("Run Backup");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(backupFolder, `backup-${timestamp}`);

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  if (
    process.env.NODE_ENV === "development" ||
    process.env.MOCK_BACKUP === "true"
  ) {
    try {
      const mockData = {
        timestamp: new Date().toISOString(),
        database: uri.split("/").pop(),
        type: req.body?.type || "Automatic",
        mock: true,
      };

      const filePath = `${outDir}.json`;
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));

      await connectDB();
      const backupEntry = new Backup({
        filename: path.basename(filePath),
        path: filePath,
        timestamp: new Date(),
        database: mockData.database,
        type: mockData.type,
        mock: true,
        size: fs.statSync(filePath).size,
      });

      await backupEntry.save();
      console.log(`Mock backup created and saved to database: ${filePath}`);
      return res.status(200).send(`Mock backup successful: ${filePath}`);
    } catch (err) {
      console.error("Mock backup failed:", err);
      return res.status(500).send("Mock backup failed.");
    }
  }

  const cmd = `mongodump --uri="${uri}" --archive=${outDir}.gz --gzip`;

  exec(cmd, async (error, stdout, stderr) => {
    if (error) {
      console.error("Backup failed:", error);

      if (error.message && error.message.includes("not recognized")) {
        const errorMsg =
          "MongoDB tools not installed. Please install MongoDB Database Tools or set MOCK_BACKUP=true in .env file for development.";
        console.error(errorMsg);
        return res.status(500).send(errorMsg);
      }

      return res.status(500).send("Backup failed: " + error.message);
    } else {
      const filePath = `${outDir}.gz`;

      await connectDB();
      const backupEntry = new Backup({
        filename: path.basename(filePath),
        path: filePath,
        timestamp: new Date(),
        database: uri.split("/").pop(),
        type: req.body?.type || "Automatic",
        mock: false,
        size: fs.statSync(filePath).size,
      });

      await backupEntry.save();
      console.log(`Backup successful and saved to database: ${filePath}`);
      return res.status(200).send(`Backup successful: ${filePath}`);
    }
  });
};

const getBackup = async (req, res) => {
  try {
    const { Backup } = require("./db");
    const backups = await Backup.find().sort({ timestamp: -1 });
    res.status(200).json(backups);
  } catch (error) {
    console.error("Error fetching backups:", error);
    res.status(500).send("Failed to fetch backups");
  }
};

module.exports = { runBackup, getBackup };
