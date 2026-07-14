import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const patternDefinitions = {
  patternCount_rawControls: {
    label: "raw form controls outside src/components/ui/",
    check: (file, relativePath, content) => {
      if (!relativePath.startsWith("src/components/") || relativePath.startsWith("src/components/ui/") || !relativePath.endsWith(".tsx")) return [];
      const matches = [];
      const regex = /<(?:button|input|select|textarea)\b/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split("\n").length;
        matches.push({ line, match: match[0] });
      }
      return matches;
    },
  },
  patternCount_arbitraryDesignValues: {
    label: "arbitrary visual Tailwind values outside src/components/ui/",
    check: (file, relativePath, content) => {
      if (!relativePath.startsWith("src/components/") || relativePath.startsWith("src/components/ui/") || !relativePath.endsWith(".tsx")) return [];
      const matches = [];
      const regex = /\b(?:text|rounded|shadow|duration|ease|bg|border|max-w|w|h)-\[[^\]]+\]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split("\n").length;
        matches.push({ line, match: match[0] });
      }
      return matches;
    },
  },
  patternCount_localCssVisualDeclarations: {
    label: "local visual declarations outside src/index.css",
    check: (file, relativePath, content) => {
      if (!relativePath.endsWith(".css") || relativePath === "src/index.css") return [];
      const matches = [];
      const regex = /\b(?:font-family|font-size|border-radius|box-shadow|transition|animation)\s*:/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split("\n").length;
        matches.push({ line, match: match[0] });
      }
      return matches;
    },
  },
};

function walk(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        list = list.concat(walk(filePath));
      }
    } else {
      if (/\.(ts|tsx|js|jsx|css)$/.test(file)) {
        list.push(filePath);
      }
    }
  }
  return list;
}

const allFiles = walk(path.join(root, "src"));

console.log("Searching for frontend ratchet violations...");

for (const key of Object.keys(patternDefinitions)) {
  console.log(`\n=== Violations for: ${patternDefinitions[key].label} ===`);
  let count = 0;
  for (const file of allFiles) {
    const relativePath = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const violations = patternDefinitions[key].check(file, relativePath, content);
    if (violations.length > 0) {
      console.log(`\nFile: ${relativePath}`);
      for (const v of violations) {
        console.log(`  Line ${v.line}: ${v.match}`);
        count++;
      }
    }
  }
  console.log(`Total violations: ${count}`);
}
