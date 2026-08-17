const fs = require('fs');

function toBoldUnicode(text) {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120211);
    if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120205);
    if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120764);
    return char;
  }).join('');
}

function formatLinkedInText(text) {
  return (text || '').replace(/\*\*(.*?)\*\*/g, (m, p1) => toBoldUnicode(p1));
}

const data = require('./last_posts.json');
const res = data[0].results.find(r => r.id === '8e070f4a-c563-4d70-92e7-e6c367df6160');
const original = res.content_edited;
const formatted = formatLinkedInText(original);

console.log("Original length:", original.length);
console.log("Formatted length:", formatted.length);
console.log("Formatted text end:");
console.log(formatted.slice(-200));

