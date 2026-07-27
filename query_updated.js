const { execSync } = require('child_process');
try {
  const query = "SELECT id, updated_at, substr(media_base64, 1, 30) FROM posts WHERE id = '8e070f4a-c563-4d70-92e7-e6c367df6160'";
  const result = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --command="${query}"`, { stdio: 'pipe' }).toString();
  console.log(result);
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
