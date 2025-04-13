const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const uri = process.env.MONGO_URI;
const backupFolder = process.env.BACKUP_FOLDER || "./backup";

const connectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
};

const restoreBackup = async (req, res) => {
  if (!fs.existsSync(backupFolder)) {
    return res.status(404).send("Backup folder not found.");
  }

  const files = fs
    .readdirSync(backupFolder)
    .filter((file) => file.endsWith(".gz") || file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return res.status(404).send("No backup files found.");
  }

  const backupFile = req.body?.file || files[0];
  if (!files.includes(backupFile)) {
    return res.status(404).send(`Backup file ${backupFile} not found.`);
  }

  const backupPath = path.join(backupFolder, backupFile);

  if (backupPath.endsWith(".json")) {
    try {
      await connectDB();

      const rawData = fs.readFileSync(backupPath, "utf8");
      const json = JSON.parse(rawData);
      const collections = json.collections || {};

      for (const collectionName in collections) {
        const documents = collections[collectionName];
        if (!Array.isArray(documents) || documents.length === 0) continue;

        const newCollectionName = `restore-${collectionName}`;

        const existing = await mongoose.connection.db
          .listCollections({ name: newCollectionName })
          .toArray();

        if (existing.length > 0) {
          await mongoose.connection.db.dropCollection(newCollectionName);
          console.log(`Dropped existing collection: ${newCollectionName}`);
        }

        await mongoose.connection.db
          .collection(newCollectionName)
          .insertMany(documents);

        console.log(`Inserted ${documents.length} into ${newCollectionName}`);
      }

      return res
        .status(200)
        .send(`Restored collections with 'restor-' prefix from ${backupFile}`);
    } catch (err) {
      console.error("JSON Restore Failed:", err);
      return res.status(500).send("Restore failed: " + err.message);
    }
  }

  const cmd = `mongorestore --uri="${uri}" --archive="${backupPath}" --gzip --drop`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("mongorestore failed:", error);
      return res.status(500).send("Restore failed: " + error.message);
    }
    console.log("mongorestore output:", stdout);
    return res
      .status(200)
      .send(`Restore completed from archive: ${backupFile}`);
  });
};

module.exports = restoreBackup;
