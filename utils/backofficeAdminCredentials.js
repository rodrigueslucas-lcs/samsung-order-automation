const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_USERNAME = "admin.lucas.afonso";
const DEFAULT_FILE = path.resolve("playwright/.auth/backoffice-admin.json");

function resolveBackOfficeEnvironment(environment = process.env) {
  return String(environment.BACKOFFICE_ENV || environment.MX_QST_ENVIRONMENT || environment.PE_QST_ENVIRONMENT || "s1").toLowerCase();
}

function resolveCredentialsFile(environment = process.env) {
  const target = resolveBackOfficeEnvironment(environment);
  const environmentFile = environment[`BACKOFFICE_${target.toUpperCase()}_ADMIN_CREDENTIALS_FILE`];
  if (environmentFile) return path.resolve(environmentFile);
  if (environment.BACKOFFICE_ADMIN_CREDENTIALS_FILE) {
    return path.resolve(environment.BACKOFFICE_ADMIN_CREDENTIALS_FILE);
  }
  const targetFile = path.resolve(`playwright/.auth/backoffice-admin-${target}.json`);
  if (fs.existsSync(targetFile)) return targetFile;
  return DEFAULT_FILE;
}

function readLocalCredentials(filePath = DEFAULT_FILE) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    username: typeof parsed.username === "string" ? parsed.username.trim() : undefined,
    password: typeof parsed.password === "string" ? parsed.password : undefined,
  };
}

function getBackOfficeAdminCredentials(environment = process.env) {
  const target = resolveBackOfficeEnvironment(environment);
  const prefix = `BACKOFFICE_${target.toUpperCase()}_ADMIN`;
  const local = readLocalCredentials(resolveCredentialsFile(environment));

  return {
    environment: target,
    username: environment[`${prefix}_USERNAME`] || environment.BACKOFFICE_ADMIN_USERNAME || local.username || DEFAULT_USERNAME,
    password: environment[`${prefix}_PASSWORD`] || environment.BACKOFFICE_ADMIN_PASSWORD || local.password || null,
  };
}

module.exports = {
  DEFAULT_USERNAME,
  DEFAULT_FILE,
  getBackOfficeAdminCredentials,
  readLocalCredentials,
  resolveBackOfficeEnvironment,
  resolveCredentialsFile,
};
