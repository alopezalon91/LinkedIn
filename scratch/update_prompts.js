const fs = require('fs');
const path = 'config/prompts.py';

let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Let's do a regex search for the block inside NORMATIVA_PROMPT
// which has:
// Sector principal: {{sector}}
// Texto relevante:
// \"\"\"
// {{texto}}
// \"\"\"
//
// {BRANDING_RULES}

const target = 'Sector principal: {{sector}}\nTexto relevante:\n\\"\\"\\"\n{{texto}}\n\\"\\"\\"\n\n{BRANDING_RULES}';
const replacement = 'Sector principal: {{sector}}\nTexto relevante:\n\\"\\"\\"\n{{texto}}\n\\"\\"\\"\n\n{{sector_focus}}\n\n{BRANDING_RULES}';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log("Updated NORMATIVA_PROMPT successfully!");
} else {
  console.log("Could not find NORMATIVA_PROMPT target.");
  // Let's try matching with regex
  const regex = /Sector principal: \{\{sector\}\}\nTexto relevante:\n\\*\"\\*\"\\*\"\n\{\{texto\}\}\n\\*\"\\*\"\\*\"\n\n\{BRANDING_RULES\}/;
  if (regex.test(content)) {
    content = content.replace(regex, 'Sector principal: {{sector}}\nTexto relevante:\n\\"\\"\\"\n{{texto}}\n\\"\\"\\"\n\n{{sector_focus}}\n\n{BRANDING_RULES}');
    console.log("Updated NORMATIVA_PROMPT via regex successfully!");
  } else {
    console.log("Regex also failed to match NORMATIVA_PROMPT.");
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log("Done.");
