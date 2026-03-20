import fs from "fs";
import path from "path";
import os from "os";
import { getDynamicSystemPrompt } from "./src/server/system-prompt.js";
import { setMemoryDir } from "./src/memory/index.js";

async function runTest() {
  const tempDir = path.join(os.tmpdir(), "lemma-test-final-" + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  
  const memoryFile = path.join(tempDir, "memory.jsonl");
  const mockMemory = [
    { id: "m1", title: "Global Fact", description: "This is global", fragment: "Detailed global info", project: null, confidence: 0.9, accessed: 1, source: "ai", created: "2026-03-20", lastAccessed: new Date().toISOString() }
  ];
  
  fs.writeFileSync(memoryFile, mockMemory.map(m => JSON.stringify(m)).join("\n"));
  
  console.log("--- Final Verification ---");
  setMemoryDir(tempDir);
  
  try {
    const prompt = await getDynamicSystemPrompt(null);
    
    // Check new condition
    console.log("Repeating tasks condition exists:", prompt.includes("Repeating or potentially repetitive tasks (SOPS)"));
    
    // Check general structure
    console.log("Identity revitalized:", prompt.includes("Recursive Cognitive Engine"));
    console.log("Workflow action-oriented:", prompt.includes("Operational Loop"));
    console.log("Retrieval strategy present:", prompt.includes("Retrieval Strategy"));

  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
  }
}

runTest().catch(error => {
  console.error("Test failed:", error);
  process.exit(1);
});
