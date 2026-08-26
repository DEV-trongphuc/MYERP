// backend/test_find_lines.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../src/pages/ProjectsPage.tsx');

if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found at ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== Searching for remindersConfig useState ===");
lines.forEach((line, idx) => {
    if (line.includes('const [remindersConfig') || line.includes('remindersConfig =') || line.includes('interface Reminder') || line.includes('type Reminder')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
