
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as handlers from '../src/server/handlers.js';
import * as wiki from '../src/wiki/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Wiki YAML Injection Protection', () => {
  const testVaultPath = path.join(os.homedir(), '.lemma-test-yaml-protection');

  beforeEach(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testVaultPath)) {
      fs.rmSync(testVaultPath, { recursive: true, force: true });
    }
  });

  it('should escape malicious input in wiki_ingest to prevent YAML injection', async () => {
    // Setup vault
    await handlers.handleWikiSetup({ vault_path: testVaultPath, project_name: 'Test Project' });

    const maliciousTitle = 'Normal Title\ninjected_key: injected_value';
    const maliciousSummary = 'Summary';

    await handlers.handleWikiIngest({
      vault_path: testVaultPath,
      title: maliciousTitle,
      summary: maliciousSummary
    });

    // Find the created source page
    const sourcesDir = path.join(testVaultPath, 'sources');
    const files = fs.readdirSync(sourcesDir);
    const sourceFile = files.find(f => f.endsWith('.md'));
    expect(sourceFile).toBeDefined();

    const content = fs.readFileSync(path.join(sourcesDir, sourceFile!), 'utf-8');

    // Split into frontmatter and body
    const parts = content.split('---\n');
    const frontmatter = parts[1];

    // Injected key should NOT be a top-level key in YAML
    expect(frontmatter).not.toContain('\ninjected_key: injected_value\n');
    // It should be part of the quoted title value
    expect(frontmatter).toContain('title: "Normal Title\\ninjected_key: injected_value"');
  });

  it('should sanitize project name in wiki_setup index template', async () => {
    const maliciousProjectName = 'Project\nkey: value';
    await handlers.handleWikiSetup({ vault_path: testVaultPath, project_name: maliciousProjectName });

    const indexContent = fs.readFileSync(path.join(testVaultPath, 'index.md'), 'utf-8');

    const parts = indexContent.split('---\n');
    const frontmatter = parts[1];

    expect(frontmatter).not.toContain('\nkey: value\n');
    expect(frontmatter).toContain('title: "Project\\nkey: value — İçerik Kataloğu"');
  });
});
