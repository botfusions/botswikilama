import os from "os";
import path from "path";
import fs from "fs";

const VAULT_FOLDERS = [
  "raw/articles",
  "raw/papers",
  "raw/assets",
  "sources",
  "entities",
  "concepts",
  "decisions",
  "syntheses",
  "archive",
];

export function validateVaultPath(vaultPath: string): string {
  const homeDir = os.homedir();
  const absolutePath = path.resolve(vaultPath);

  if (vaultPath.includes("..")) {
    throw new Error("Security: Path traversal sequences ('..') are not allowed");
  }

  if (!absolutePath.startsWith(homeDir + path.sep)) {
    throw new Error(`Security: Vault must be located within user home directory: ${homeDir}`);
  }

  return absolutePath;
}

export function detectVault(vaultPath: string): boolean {
  return fs.existsSync(path.join(vaultPath, "index.md"));
}

export function setupVault(vaultPath: string, projectName: string, language: string): { folders: number; files: number } {
  fs.mkdirSync(vaultPath, { recursive: true });

  let folderCount = 0;
  for (const folder of VAULT_FOLDERS) {
    const dir = path.join(vaultPath, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".gitkeep"), "");
      folderCount++;
    }
  }

  let fileCount = 0;

  const indexPath = path.join(vaultPath, "index.md");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, generateIndexTemplate(projectName, language));
    fileCount++;
  }

  const logPath = path.join(vaultPath, "log.md");
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, generateLogTemplate());
    fileCount++;
  }

  const claudePath = path.join(vaultPath, "CLAUDE.md");
  if (!fs.existsSync(claudePath)) {
    fs.writeFileSync(claudePath, generateClaudeMd(projectName, language));
    fileCount++;
  }

  return { folders: folderCount, files: fileCount };
}

function generateIndexTemplate(projectName: string, language: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `---
title: ${projectName} — İçerik Kataloğu
date: ${date}
---

# ${projectName} — İçerik Kataloğu

## Kaynaklar (Sources)

## Entity'ler

## Kavramlar (Concepts)

## Kararlar (Decisions)

## Sentezler (Syntheses)
`;
}

function generateLogTemplate(): string {
  return `# Wiki Log

<!-- Format: ## [YYYY-MM-DD] operation | description -->
`;
}

function generateClaudeMd(projectName: string, language: string): string {
  return `# ${projectName} — Wiki Şeması

## Amaç
${projectName} için kalıcı bilgi arşivi. LLM ile artımlı olarak inşa edilir.

## Dil
Tüm wiki sayfaları ${language}. Teknik terimler İngilizce kalabilir.

## Sayga Formatı
Her sayfa şu yapıyı takip eder:
- YAML frontmatter: title, tags, source, date, status
- H1 başlık
- İçerik
- ## Sources
- ## Related

## Naming
kebab-case dosya adları.

## Hard Rules
1. raw/ IMMUTABLE — sadece okunur, asla yazılmaz
2. Kaynaksız iddia yasaktır
3. Sayfa silinmez, archive/ altına taşınır
4. Çelişkiler "## ÇELİŞKİ" başlığıyla işaretlenir
5. Çift yönlü bağlantı korunur
6. Her operasyon log.md'ye kaydedilir
`;
}

export function readPage(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function writePage(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function listFiles(dir: string, extension: string = ".md"): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(extension))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export function listRawFiles(rawDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(rawDir)) return files;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (!entry.name.startsWith(".")) {
        files.push(fullPath);
      }
    }
  }

  walk(rawDir);
  return files;
}

export function getIngestedFiles(vaultPath: string): Set<string> {
  const logPath = path.join(vaultPath, "log.md");
  const ingested = new Set<string>();

  if (!fs.existsSync(logPath)) return ingested;

  const logContent = fs.readFileSync(logPath, "utf-8");
  const lines = logContent.split("\n");

  for (const line of lines) {
    if (line.startsWith("## [") && line.includes("ingest |")) {
      const match = line.match(/file:\s*(.+)/);
      if (match) {
        ingested.add(path.basename(match[1].trim()));
      }
    }
  }

  return ingested;
}

export function findNewSources(vaultPath: string): string[] {
  const rawDir = path.join(vaultPath, "raw");
  const allFiles = listRawFiles(rawDir);
  const ingested = getIngestedFiles(vaultPath);

  return allFiles.filter((f) => !ingested.has(path.basename(f)));
}

export function appendToLog(vaultPath: string, entry: string): void {
  const logPath = path.join(vaultPath, "log.md");
  fs.appendFileSync(logPath, `\n${entry}\n`, "utf-8");
}

export function updateIndex(vaultPath: string, category: string, title: string, filePath: string): void {
  const indexPath = path.join(vaultPath, "index.md");
  if (!fs.existsSync(indexPath)) return;

  let content = fs.readFileSync(indexPath, "utf-8");
  const link = `  - [[${path.basename(filePath, ".md")}]] ${title}`;

  const sectionHeader = `## ${category}`;
  if (content.includes(sectionHeader)) {
    content = content.replace(sectionHeader, `${sectionHeader}\n${link}`);
  } else {
    content += `\n${sectionHeader}\n${link}\n`;
  }

  fs.writeFileSync(indexPath, content, "utf-8");
}

export function searchWiki(vaultPath: string, query: string): { file: string; title: string; matches: string[] }[] {
  const queryLower = query.toLowerCase();
  const results: { file: string; title: string; matches: string[] }[] = [];

  const dirs = ["sources", "entities", "concepts", "decisions", "syntheses"];
  for (const dir of dirs) {
    const fullDir = path.join(vaultPath, dir);
    const files = listFiles(fullDir);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8").toLowerCase();
      if (content.includes(queryLower)) {
        const title = extractTitle(fs.readFileSync(file, "utf-8"));
        const lines = fs.readFileSync(file, "utf-8").split("\n");
        const matches = lines
          .filter((l) => l.toLowerCase().includes(queryLower))
          .slice(0, 3)
          .map((l) => l.trim());
        results.push({ file: path.relative(vaultPath, file), title, matches });
      }
    }
  }

  return results;
}

function extractTitle(content: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) return titleMatch[1];

  const fmMatch = content.match(/^title:\s*(.+)$/m);
  if (fmMatch) return fmMatch[1];

  return "Untitled";
}

export interface LintFinding {
  category: string;
  file: string;
  description: string;
  suggestion: string;
  priority: string;
}

export function lintWiki(vaultPath: string): LintFinding[] {
  const findings: LintFinding[] = [];

  const allFiles: Map<string, string> = new Map();
  const dirs = ["sources", "entities", "concepts", "decisions", "syntheses"];

  for (const dir of dirs) {
    const fullDir = path.join(vaultPath, dir);
    for (const file of listFiles(fullDir)) {
      const content = fs.readFileSync(file, "utf-8");
      allFiles.set(path.relative(vaultPath, file), content);
    }
  }

  const allLinks = new Map<string, Set<string>>();
  const allMentions = new Map<string, number>();

  for (const [relPath, content] of allFiles) {
    const links = extractWikiLinks(content);
    allLinks.set(relPath, links);

    for (const link of links) {
      allMentions.set(link, (allMentions.get(link) || 0) + 1);
    }

    for (const [otherPath, otherContent] of allFiles) {
      if (relPath === otherPath) continue;
      const otherTitle = extractTitle(otherContent).toLowerCase();
      if (otherTitle.length > 3 && content.toLowerCase().includes(otherTitle)) {
        allMentions.set(otherPath, (allMentions.get(otherPath) || 0) + 1);
      }
    }
  }

  for (const [relPath] of allFiles) {
    let isIncoming = false;
    for (const [, links] of allLinks) {
      if (links.has(relPath)) {
        isIncoming = true;
        break;
      }
    }
    if (!isIncoming) {
      findings.push({
        category: "orphan",
        file: relPath,
        description: "Hiçbir sayfadan link almayan yetim sayfa",
        suggestion: `Başka bir sayfaya [[${path.basename(relPath, ".md")}]] linki ekle`,
        priority: "medium",
      });
    }
  }

  for (const [relPath, links] of allLinks) {
    for (const link of links) {
      if (!allFiles.has(link) && !allFiles.has(link + ".md")) {
        findings.push({
          category: "broken-link",
          file: relPath,
          description: `Kırık link: [[${link}]] — hedef sayfa yok`,
          suggestion: `Hedef sayfa oluştur veya linki kaldır`,
          priority: "high",
        });
      }
    }
  }

  for (const [relPath, content] of allFiles) {
    if (!content.includes("## Sources") && !content.includes("## Kaynaklar")) {
      findings.push({
        category: "missing-sources",
        file: relPath,
        description: "Kaynak referansı eksik",
        suggestion: "## Sources bölümü ekle",
        priority: "medium",
      });
    }
  }

  const sourceCounts = new Map<string, number>();
  for (const [, content] of allFiles) {
    const srcMatch = content.match(/## Sources\s*\n([\s\S]*?)(?=\n##|$)/);
    if (srcMatch) {
      const sourceLines = srcMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of sourceLines) {
        const src = line.replace(/^-\s*/, "").trim();
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
      }
    }
  }

  return findings;
}

function extractWikiLinks(content: string): Set<string> {
  const links = new Set<string>();
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.add(match[1]);
  }
  return links;
}

export function getVaultStats(vaultPath: string): Record<string, number> {
  const stats: Record<string, number> = { total: 0 };

  const dirs = ["sources", "entities", "concepts", "decisions", "syntheses", "archive"];
  for (const dir of dirs) {
    const files = listFiles(path.join(vaultPath, dir));
    stats[dir] = files.length;
    stats.total += files.length;
  }

  const rawFiles = listRawFiles(path.join(vaultPath, "raw"));
  stats["raw"] = rawFiles.length;

  return stats;
}
