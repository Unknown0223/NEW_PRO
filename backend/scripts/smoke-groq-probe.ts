/**
 * Lokal Groq smoke: GROQ_API_KEY=... npx tsx scripts/smoke-groq-probe.ts [model]
 */
async function main() {
  const key = (process.env.GROQ_API_KEY ?? "").trim();
  if (!key) {
    console.error("GROQ_API_KEY kerak");
    process.exit(1);
  }
  const model = (process.argv[2] || "openai/gpt-oss-120b").trim();
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 256,
      messages: [
        { role: "system", content: "Reply with the single word: pong" },
        { role: "user", content: "ping" }
      ]
    })
  });
  const text = await res.text();
  console.log("status", res.status);
  console.log(text.slice(0, 800));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
