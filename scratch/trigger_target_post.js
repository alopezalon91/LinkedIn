async function test() {
  const postId = '6e881c82-1ada-48a8-ae92-909afa5d668a';
  console.log("Triggering generation/regeneration for post " + postId);
  
  const res = await fetch(`https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts/${postId}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e'
    }
  });
  
  const status = res.status;
  const text = await res.text();
  console.log("Response Status:", status);
  try {
    const data = JSON.parse(text);
    console.log("=== GENERATED POST TEXT ===");
    console.log(data.content);
    console.log("=== FIRST COMMENT ===");
    console.log(data.first_comment);
    if (data.media_base64) {
      console.log("=== CAROUSEL DETECTED ===");
      const carouselStr = atob(data.media_base64);
      console.log(carouselStr.substring(0, 300) + "...");
    }
  } catch (e) {
    console.log("Raw Response:", text);
  }
}

test();
