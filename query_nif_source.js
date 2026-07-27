const { execSync } = require('child_process');
try {
  const query = "SELECT id, source_id, created_at FROM posts WHERE source_id LIKE '%nif%' ORDER BY created_at DESC LIMIT 5";
  const result = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --command="${query}"`, { stdio: 'pipe' }).toString();
  console.log(result);
} catch (e) {
  console.error(e.stdout ? e.stdout.toString() : e.message);
}
