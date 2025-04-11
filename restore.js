const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const uri = process.env.MONGO_URI;
const backupFolder = process.env.BACKUP_FOLDER || "./backup";

const restoreBackup = (req, res) => {
  console.log("Restore Backup ==>");

  if (!fs.existsSync(backupFolder)) {
    return res.status(404).send("Backup folder not found.");
  }

  const files = fs
    .readdirSync(backupFolder)
    .filter((file) => file.endsWith(".gz") || file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return res.status(404).send("No backup found.");
  }

  let backupFile = req.body && req.body.file ? req.body.file : files[0];

  if (!files.includes(backupFile)) {
    return res.status(404).send(`Backup file ${backupFile} not found.`);
  }

  const backupPath = path.join(backupFolder, backupFile);

  if (backupPath.endsWith(".json")) {
    try {
      const mockData = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      console.log(`Mock restore from: ${backupPath}`);
      console.log("Mock data:", mockData);
      return res
        .status(200)
        .send(
          `Mock restore completed from ${backupFile}. In a real environment, this would restore the database ${mockData.database}.`
        );
    } catch (err) {
      console.error("Mock restore failed:", err);
      return res.status(500).send("Mock restore failed: " + err.message);
    }
  }

  const cmd = `mongorestore --uri="${uri}" --archive=${backupPath} --gzip --drop`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("Restore failed:", error);

      if (error.message && error.message.includes("not recognized")) {
        const errorMsg =
          "MongoDB tools not installed. Please install MongoDB Database Tools or use mock backups for development.";
        console.error(errorMsg);
        return res.status(500).send(errorMsg);
      }

      return res.status(500).send("Restore failed: " + error.message);
    } else {
      console.log(`✅ Restore successful from: ${backupPath}`);
      return res.status(200).send(`Restore completed from ${backupFile}`);
    }
  });
};

module.exports = restoreBackup;
