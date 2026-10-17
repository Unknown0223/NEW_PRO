/**
 * Lokal yordamchi: LM Studio (127.0.0.1:1234) + lokal SALEC API.
 * O'qish darhol bajariladi. Yozish va o'chirish faqat "ha" dan keyin.
 * Prod serverga ulanmaydi.
 */
const API = process.env.SALEC_API || "http://127.0.0.1:18080";
const LLM = process.env.LMSTUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions";
const SLUG = process.env.SALEC_SLUG || "aksit";
const LOGIN = process.env.SALEC_LOGIN || "admin";
const PASSWORD = process.env.SALEC_PASSWORD || "secret123";

const SYSTEM = `Sen SALEC lokal yordamchisisan. Foydalanuvchi o'zbek yoki rus tilida yozadi.
Faqat JSON qaytar: {"say":"qisqa izoh","call":null}
yoki {"say":"...","call":{"method":"GET","path":"/reports/sales?from=2026-10-01&to=2026-10-11","body":null}}
path /api/${SLUG} siz yoziladi. method: GET, POST, PUT, PATCH, DELETE.
Asosiy yo'llar:
- GET /dashboard/stats
- GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
- GET /reports/receivables?page=1&limit=20
- GET /reports/product-sales?from=&to=
- GET /reports/agent-orders?from=&to=
- GET /orders?page=1&limit=20
- GET /clients?page=1&limit=20&search=
Yozish yoki o'chirishni foydalanuvchi aniq so'rasa call qil. Taxmin qilma. Boshqa matn yozma.
Hisobot so'ralsa limitni katta qo'y (limit=50) va sanani aniq yoz.`;

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: SLUG, login: LOGIN, password: PASSWORD, device_name: "local-assistant" })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `login ${res.status}`);
  const token = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error("token topilmadi");
  return token;
}

async function apiCall(token, method, path, body) {
  const res = await fetch(`${API}/api/${SLUG}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: body && method !== "GET" ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 2000);
  }
  if (!res.ok) throw new Error(typeof json === "string" ? json : json.message || `API ${res.status}`);
  return json;
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") : String(value ?? "");
}

function formatResult(result) {
  const lines = [];
  const total = result?.data?.find?.((row) => row.period === "total") || result?.data?.[0];
  if (total?.order_count != null) {
    lines.push(`Buyurtma: ${total.order_count} ta, summa: ${money(total.total_sum)}, to'lov: ${money(total.payment_sum)}, qaytim: ${money(total.return_amount)}`);
  }
  for (const agent of (result?.agents || []).slice(0, 15)) {
    lines.push(`- ${agent.agent_name}: ${agent.order_count} ta buyurtma, ${money(agent.total_sum)}`);
  }
  return lines.join("\n");
}

function clip(value) {
  const raw = JSON.stringify(value);
  return raw.length > 14000 ? `${raw.slice(0, 14000)}…` : raw;
}

async function askModel(messages) {
  const res = await fetch(LLM, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "qwen3",
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
      messages
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `model ${res.status}`);
  return data.choices?.[0]?.message?.content || "";
}

function parseAction(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  if (start < 0) return { say: text.trim(), call: null };
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth += 1;
    else if (cleaned[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, i + 1));
          return { say: String(parsed.say || ""), call: parsed.call || null };
        } catch {
          return { say: text.trim(), call: null };
        }
      }
    }
  }
  return { say: text.trim(), call: null };
}

async function confirmWrite(call) {
  process.stdout.write(`\nTasdiq: ${call.method} ${call.path}\nBajarilsinmi? ha / yoq: `);
  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (buf) => resolve(String(buf).trim().toLowerCase()));
  });
  return answer === "ha";
}

async function answer(token, history, text) {
  history.push({ role: "user", content: text });
  const raw = await askModel(history);
  const action = parseAction(raw);
  if (action.say) console.log(action.say);
  if (action.call?.path && action.call?.method) {
    const method = String(action.call.method).toUpperCase();
    if (method !== "GET") {
      console.log("Yozish bu sinovda o'tkazib yuborildi.");
    } else {
      const result = await apiCall(token, method, action.call.path, action.call.body);
      const details = formatResult(result);
      if (details) console.log(details);
      history.push({ role: "assistant", content: action.say || "bajarildi" });
      history.push({ role: "user", content: `API natija: ${clip(result)}. Shu raqamlar bo'yicha batafsil o'zbekcha javob ber: summa, sana, mijoz yoki xodim, holat. JSON yozma. Yo'q raqamni o'ylab topma.` });
      const spoken = await askModel(history);
      console.log(spoken.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\{[\s\S]*\}/g, "").trim());
    }
  }
  history.push({ role: "assistant", content: action.say || raw.slice(0, 500) });
}

async function main() {
  const token = await login();
  const once = process.argv.slice(2).join(" ").trim();
  const history = [{ role: "system", content: SYSTEM }];
  if (once) {
    await answer(token, history, once);
    return;
  }
  console.log(`Lokal tizimga kirildi (${API}, ${SLUG}). Chiqish: exit`);
  console.log("Yozish va o'chirish faqat «ha» deb tasdiqlangach bajariladi.\n");
  process.stdin.setEncoding("utf8");
  process.stdout.write("> ");
  for await (const line of process.stdin) {
    const text = line.trim();
    if (!text) {
      process.stdout.write("> ");
      continue;
    }
    if (text === "exit" || text === "chiq") break;
    history.push({ role: "user", content: text });
    const raw = await askModel(history);
    const action = parseAction(raw);
    if (action.say) console.log(action.say);
    if (action.call?.path && action.call?.method) {
      const method = String(action.call.method).toUpperCase();
      const writing = method !== "GET";
      if (writing && !(await confirmWrite(action.call))) {
        console.log("Bekor qilindi.");
      } else {
        const result = await apiCall(token, method, action.call.path, action.call.body);
        const details = formatResult(result);
        if (details) console.log(details);
        else console.log(clip(result));
        history.push({ role: "assistant", content: action.say || "bajarildi" });
        history.push({ role: "user", content: `API natija: ${clip(result)}. Shu raqamlar bo'yicha batafsil o'zbekcha javob ber: summa, sana, mijoz yoki xodim, holat. JSON yozma. Yo'q raqamni o'ylab topma.` });
        const spoken = await askModel(history);
        console.log(spoken.replace(/\{[\s\S]*\}/g, "").trim());
      }
    }
    history.push({ role: "assistant", content: action.say || raw.slice(0, 500) });
    process.stdout.write("\n> ");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
