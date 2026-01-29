import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

export interface GuideMeta {
  name: string;
  description: string;
}

export interface Guide extends GuideMeta {
  content: string;
}

const GUIDES_DIR = path.join(
  os.homedir(),
  'Library/Application Support/RA-H/guides'
);

const BUNDLED_GUIDES_DIR = path.join(
  process.cwd(),
  'src/config/guides'
);

function ensureGuidesDir(): void {
  if (!fs.existsSync(GUIDES_DIR)) {
    fs.mkdirSync(GUIDES_DIR, { recursive: true });
  }
}

function seedDefaultGuides(): void {
  if (!fs.existsSync(BUNDLED_GUIDES_DIR)) return;

  const bundled = fs.readdirSync(BUNDLED_GUIDES_DIR).filter(f => f.endsWith('.md'));
  for (const file of bundled) {
    const dest = path.join(GUIDES_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(BUNDLED_GUIDES_DIR, file), dest);
    }
  }
}

function init(): void {
  ensureGuidesDir();
  const existing = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));
  if (existing.length === 0) {
    seedDefaultGuides();
  }
}

export function listGuides(): GuideMeta[] {
  init();
  const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
    const { data } = matter(raw);
    return {
      name: data.name || file.replace('.md', ''),
      description: data.description || '',
    };
  });
}

export function readGuide(name: string): Guide | null {
  init();
  // Try exact filename first, then lowercase
  const candidates = [
    `${name}.md`,
    `${name.toLowerCase()}.md`,
  ];

  for (const filename of candidates) {
    const filepath = path.join(GUIDES_DIR, filename);
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, 'utf-8');
      const { data, content } = matter(raw);
      return {
        name: data.name || name,
        description: data.description || '',
        content: content.trim(),
      };
    }
  }

  return null;
}

export function writeGuide(name: string, content: string): void {
  init();
  const filename = `${name.toLowerCase()}.md`;
  const filepath = path.join(GUIDES_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
}
