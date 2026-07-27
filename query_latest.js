const { execSync } = require('child_process');
try {
  const result = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --command="SELECT id, source_id, type FROM posts ORDER BY created_at DESC LIMIT 5"', { stdio: 'pipe' }).toString();
  console.log(result);
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
