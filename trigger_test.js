const idTest = '7db97a63-2229-49c1-9516-3139a361a07b';

async function test() {
  console.log("Triggering generation for " + idTest);
  const res = await fetch(`https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts/${idTest}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e'
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log(text);
}

test();
