const { execSync } = require('child_process');
const fs = require('fs');
try {
  const query = "SELECT media_base64 FROM posts WHERE id = '8e070f4a-c563-4d70-92e7-e6c367df6160'";
  const result = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --command="${query}" --json`, { stdio: 'pipe' }).toString();
  fs.writeFileSync('media_output.json', result);
  console.log("Saved to media_output.json");
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
