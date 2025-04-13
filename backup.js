const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { connectDB, Backup } = require("./db");

const uri = process.env.MONGO_URI;
const backupFolder = process.env.BACKUP_FOLDER || "./backup";

const createBackupFolderIfNeeded = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

const saveBackupEntry = async (filePath, type, mock) => {
  await connectDB();
  const backupEntry = new Backup({
    filename: path.basename(filePath),
    path: filePath,
    timestamp: new Date(),
    database: uri.split("/").pop(),
    type,
    mock,
    size: fs.statSync(filePath).size,
  });

  await backupEntry.save();
};

const runBackup = async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(backupFolder, `backup-${timestamp}`);
  const type = req.body?.type || "Automatic";

  createBackupFolderIfNeeded(backupFolder);

  const isMock =
    process.env.NODE_ENV === "development" ||
    process.env.MOCK_BACKUP === "true";

  if (isMock) {
    try {
      await connectDB();
      const mongoose = require("mongoose");
      const db = mongoose.connection;

      const collections = await db.db.listCollections().toArray();
      const dbContent = {};

      for (const col of collections) {
        const collectionName = col.name;
        const data = await db.collection(collectionName).find().toArray();
        dbContent[collectionName] = data;
      }

      const mockData = {
        timestamp: new Date().toISOString(),
        database: uri.split("/").pop(),
        type,
        mock: true,
        collections: dbContent,
      };

      const filePath = `${outDir}.json`;
      const dirPath = path.dirname(filePath);
      createBackupFolderIfNeeded(dirPath);

      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
      await saveBackupEntry(filePath, type, true);

      return res.status(200).send(`Mock backup with DB data: ${filePath}`);
    } catch (err) {
      return res.status(500).send("Mock backup failed.");
    }
  }

  const filePath = `${outDir}.gz`;
  const cmd = `mongodump --uri="${uri}" --archive=${filePath} --gzip`;

  exec(cmd, async (error, stdout, stderr) => {
    if (error) {
      const errorMsg = error.message.includes("not recognized")
        ? "mongodump command not recognized. Is MongoDB installed?"
        : "Backup failed: " + error.message;
      return res.status(500).send(errorMsg);
    }

    try {
      await saveBackupEntry(filePath, type, false);
      return res.status(200).send(`Backup successful: ${filePath}`);
    } catch (err) {
      return res
        .status(500)
        .send("Backup created but failed to log in database.");
    }
  });
};

const getBackup = async (req, res) => {
  try {
    const backups = await Backup.find().sort({ timestamp: -1 });
    return res.status(200).json(backups);
  } catch (error) {
    return res.status(500).send("Failed to fetch backups");
  }
};

module.exports = { runBackup, getBackup };
