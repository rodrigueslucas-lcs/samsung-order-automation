const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_USERNAME = "admin.lucas.afonso";
const DEFAULT_FILE = path.resolve("playwright/.auth/backoffice-admin.json");

function readLocalCredentials(filePath = DEFAULT_FILE) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    username: typeof parsed.username === "string" ? parsed.username.trim() : undefined,
    password: typeof parsed.password === "string" ? parsed.password : undefined,
  };
}

function getBackOfficeAdminCredentials(environment = process.env) {
  const local = readLocalCredentials(
    environment.BACKOFFICE_ADMIN_CREDENTIALS_FILE
      ? path.resolve(environment.BACKOFFICE_ADMIN_CREDENTIALS_FILE)
      : DEFAULT_FILE
  );

  return {
    username: environment.BACKOFFICE_ADMIN_USERNAME || local.username || DEFAULT_USERNAME,
    password: environment.BACKOFFICE_ADMIN_PASSWORD || local.password || null,
  };
}

module.exports = {
  DEFAULT_USERNAME,
  DEFAULT_FILE,
  getBackOfficeAdminCredentials,
  readLocalCredentials,
};
