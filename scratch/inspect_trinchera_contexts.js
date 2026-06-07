const { execSync } = require('child_process');

try {
  const output = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "SELECT id, content, content_edited FROM posts WHERE content LIKE \'%trinchera%\' OR content_edited LIKE \'%trinchera%\'"', { 
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10 // 10MB
  });
  const data = JSON.parse(output);
  const rows = data[0].results || [];
  
  const sentences = new Set();
  rows.forEach(row => {
    const text = row.content_edited || row.content;
    const matches = text.match(/[^\n.]*trinchera[^\n.]*/gi);
    if (matches) {
      matches.forEach(m => sentences.add(m.trim()));
    }
  });
  
  console.log("Found sentences containing 'trinchera':");
  sentences.forEach(s => console.log(`- ${s}`));
} catch (err) {
  console.error("Error:", err.message);
}
