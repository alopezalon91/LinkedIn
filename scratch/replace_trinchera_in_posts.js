const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runWranglerCommand(args) {
  try {
    const output = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "${args.replace(/"/g, '\\"')}"`, { 
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    return JSON.parse(output);
  } catch (err) {
    console.error(`Wrangler command failed for query: ${args}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

function runWranglerFile(sql) {
  const tempFile = path.join(__dirname, 'update_temp.sql');
  fs.writeFileSync(tempFile, sql, 'utf-8');
  try {
    execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --file=scratch/update_temp.sql`, { 
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10 
    });
  } catch (err) {
    console.error(`Wrangler file execution failed.`);
    console.error(err.stderr || err.message);
    throw err;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function replaceTrinchera(text) {
  if (!text) return text;
  
  let replaced = text;
  replaced = replaced.replace(/enfoques? de trinchera/gi, (match) => match.toLowerCase().includes('enfoques') ? 'enfoques prácticos' : 'enfoque práctico');
  replaced = replaced.replace(/estrategias? de trinchera/gi, (match) => match.toLowerCase().includes('estrategias') ? 'estrategias prácticas' : 'estrategia práctica');
  replaced = replaced.replace(/fiscalistas? de trinchera/gi, (match) => match.toLowerCase().includes('fiscalistas') ? 'fiscalistas prácticos' : 'fiscalista práctico');
  replaced = replaced.replace(/estrategia fiscal de trinchera/gi, 'estrategia fiscal práctica');
  replaced = replaced.replace(/trinchera del autónomo/gi, 'día a día del autónomo');
  replaced = replaced.replace(/en la trinchera/gi, 'a pie de calle');
  replaced = replaced.replace(/la trinchera de/gi, 'el día a día de');
  replaced = replaced.replace(/entendemos la trinchera/gi, 'entendemos el día a día');
  
  // Clean up any remaining isolated 'trinchera' words
  replaced = replaced.replace(/trinchera/gi, 'práctica');
  return replaced;
}

async function main() {
  console.log("Fetching all posts from D1 database...");
  const queryResult = runWranglerCommand("SELECT id, status, content, content_edited, media_base64 FROM posts");
  const rows = queryResult[0].results || [];
  console.log(`Found ${rows.length} posts. Scanning for 'trinchera'...`);

  let updatedCount = 0;
  for (const row of rows) {
    let newContent = row.content;
    let newContentEdited = row.content_edited;
    let newMediaB64 = row.media_base64;

    // 1. Process content
    if (row.content) {
      if (row.content.trim().startsWith('{')) {
        // Draft JSON
        try {
          const draftJson = JSON.parse(row.content);
          if (draftJson.prompt && draftJson.prompt.includes('trinchera')) {
            draftJson.prompt = replaceTrinchera(draftJson.prompt);
            newContent = JSON.stringify(draftJson);
          }
        } catch (e) {
          // Fallback to text replace if parse fails
          if (row.content.includes('trinchera')) {
            newContent = replaceTrinchera(row.content);
          }
        }
      } else {
        // Regular text
        if (row.content.includes('trinchera')) {
          newContent = replaceTrinchera(row.content);
        }
      }
    }

    // 2. Process content_edited
    if (row.content_edited && row.content_edited.includes('trinchera')) {
      newContentEdited = replaceTrinchera(row.content_edited);
    }

    // 3. Process media_base64 - ONLY if it is a carousel JSON
    if (row.media_base64) {
      try {
        const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
        if (decodedStr.startsWith("CAROUSEL:") && (decodedStr.includes('trinchera') || decodedStr.includes('TRINCHERA'))) {
          const replacedStr = replaceTrinchera(decodedStr);
          newMediaB64 = btoa(unescape(encodeURIComponent(replacedStr)));
        }
      } catch (e) {
        // Ignore decode errors for non-carousel media (PDF binary data, etc.)
      }
    }

    // Build dynamic update list
    const updateFields = [];
    if (newContent !== row.content) {
      updateFields.push(`content = '${newContent.replace(/'/g, "''")}'`);
    }
    if (newContentEdited !== row.content_edited) {
      const val = newContentEdited ? `'${newContentEdited.replace(/'/g, "''")}'` : 'NULL';
      updateFields.push(`content_edited = ${val}`);
    }
    if (newMediaB64 !== row.media_base64) {
      const val = newMediaB64 ? `'${newMediaB64.replace(/'/g, "''")}'` : 'NULL';
      updateFields.push(`media_base64 = ${val}`);
    }

    if (updateFields.length > 0) {
      console.log(`Updating post ${row.id} (${row.status})...`);
      const updateQuery = `UPDATE posts SET ${updateFields.join(', ')} WHERE id = '${row.id}';`;
      runWranglerFile(updateQuery);
      updatedCount++;
    }
  }

  console.log(`\nAll done! Updated ${updatedCount} posts in D1 database.`);
}

main();
