#!/usr/bin/env node
import { startServer } from "./server/index.js";

startServer().catch((error: Error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
