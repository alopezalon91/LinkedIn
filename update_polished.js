const { execSync } = require('child_process');
const fs = require('fs');

const postId = '8e070f4a-c563-4d70-92e7-e6c367df6160';

const postData = JSON.parse(fs.readFileSync('polished_post.json', 'utf8'));
const postText = postData.post_linkedin;

const sqlText = postText.replace(/'/g, "''");

const query = `UPDATE posts SET content_edited = '${sqlText}' WHERE id = '${postId}';`;

fs.writeFileSync('query_update_polished.sql', query, 'utf8');

console.log("Running query via file...");
try {
  execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --file=query_update_polished.sql`, { stdio: 'inherit' });
  console.log("Success!");
} catch(e) {
  console.error("Error executing d1", e);
}
