#!/usr/bin/env node
import { startServer } from "./server/index.js";

startServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
