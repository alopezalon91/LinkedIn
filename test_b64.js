const draftJson = { "title": "áéíóú" };
const jsonStr = JSON.stringify(draftJson);
const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
console.log('Encoded:', b64);
try {
  const decoded = decodeURIComponent(escape(atob(b64)));
  console.log('Decoded:', decoded);
  console.log('Parsed:', JSON.parse(decoded));
} catch(e) {
  console.error('Error:', e);
}
