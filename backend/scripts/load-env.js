"use strict";

const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
}
