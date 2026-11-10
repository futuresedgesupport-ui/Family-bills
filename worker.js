// Cloudflare Worker + KV with password + payment history
// Change PASSWORD below

const PASSWORD = "1234"; // เปลี่ยนรหัสผ่านตรงนี้

const HTML = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>ตัวช่วยจ่ายค่าครอบครัว</title>
<style>
  :root {
    --bg: #1a1814; --card: #2a2622; --text: #f5f0e8; --muted: #a89f91;
    --accent: #c9a96e; --gold: #d4af7a; --success: #6b8f71; --border: #3d3833;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Georgia", "Noto Serif Thai", serif;
    background: var(--bg); color: var(--text);
    padding: 20px 16px; max-width: 480px; margin: 0 auto; min-height: 100vh;
  }
  header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  header h1 { font-size: 1.5rem; color: var(--gold); font-weight: 500; }
  header p { color: var(--muted); font-size: 0.85rem; margin-top: 4px; }
  .status { text-align: center; font-size: 0.8rem; color: var(--muted); margin-bottom: 12px; }
  .bill-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .bill-item {
    background: var(--card); border: 1px solid var(--border); border-radius: 4px;
    padding: 14px; display: flex; gap: 12px; align-items: flex-start;
  }
  .bill-item.paid { opacity: 0.5; }
  .bill-item.paid .name { text-decoration: line-through; }
  .checkbox {
    width: 22px; height: 22px; border: 1.5px solid var(--gold); border-radius: 2px;
    flex-shrink: 0; margin-top: 2px; cursor: pointer;
  }
  .bill-item.paid .checkbox { background: var(--success); border-color: var(--success); }
  .bill-item.paid .checkbox::after { content: "✓"; color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center; height: 100%; }
  .info { flex: 1; }
  .name { font-size: 1.05rem; }
  .meta { color: var(--muted); font-size: 0.8rem; margin-top: 3px; }
  .amount { color: var(--gold); }
  .delete-btn { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; }
  .section { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 16px; margin-bottom: 12px; }
  .section h3 { color: var(--gold); font-size: 0.9rem; margin-bottom: 12px; }
  input, textarea, select {
    width: 100%; background: #1f1c19; border: 1px solid var(--border); color: var(--text);
    padding: 10px; border-radius: 2px; font-family: inherit; font-size: 0.95rem; margin-bottom: 8px;
  }
  .row { display: flex; gap: 8px; }
  .btn {
    background: var(--accent); color: #1a1814; border: none; padding: 12px; width: 100%;
    border-radius: 2px; font-weight: 600; cursor: pointer; font-size: 0.95rem;
  }
  .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 8px; }
  footer { text-align: center; color: #6b6358; font-size: 0.75rem; margin-top: 20px; }
  #login { max-width: 320px; margin: 80px auto; text-align: center; }
  #login input { margin-bottom: 12px; }
  .hidden { display: none; }
  .month-select { margin-bottom: 12px; }
</style>
</head>
<body>
<div id="login">
  <h1 style="color:var(--gold);margin-bottom:16px;">ตัวช่วยจ่ายค่า</h1>
  <input type="password" id="pw" placeholder="รหัสผ่าน">
  <button class="btn" onclick="login()">เข้าสู่ระบบ</button>
  <p id="loginErr" style="color:#c17a6a;margin-top:12px;font-size:0.85rem;"></p>
</div>

<div id="app" class="hidden">
  <header>
    <h1>ตัวช่วยจ่ายค่า</h1>
    <p>แชร์กันในครอบครัว</p>
  </header>
  <div class="month-select">
    <select id="monthSelect" onchange="load()"></select>
  </div>
  <div class="status" id="status">กำลังโหลด...</div>
  <div class="bill-list" id="list"></div>
  <div class="section">
    <h3>เพิ่มรายการ</h3>
    <input id="name" placeholder="ชื่อรายการ" maxlength="50">
    <div class="row">
      <input id="day" type="number" placeholder="วันที่ (1-31)" min="1" max="31" style="flex:1">
      <input id="amount" type="number" placeholder="จำนวนเงิน" min="0" style="flex:1">
    </div>
    <textarea id="note" placeholder="โน้ต"></textarea>
    <button class="btn" onclick="addBill()">เพิ่มรายการ</button>
  </div>
  <footer>ข้อมูลแชร์ผ่าน Cloudflare KV</footer>
</div>

<script>
const now = new Date();
const currentMonth = now.toISOString().slice(0,7);
let token = sessionStorage.getItem('bills_token') || '';
let viewingMonth = currentMonth;

function login() {
  const pw = document.getElementById('pw').value;
  fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: pw}) })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        token = d.token;
        sessionStorage.setItem('bills_token', token);
        showApp();
      } else {
        document.getElementById('loginErr').textContent = 'รหัสผ่านไม่ถูกต้อง';
      }
    });
}

function showApp() {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initMonthSelect();
  load();
}

function initMonthSelect() {
  const sel = document.getElementById('monthSelect');
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0,7);
    const label = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
    months.push(\`<option value="\${val}" \${val===currentMonth?'selected':''}>\${label}</option>\`);
  }
  sel.innerHTML = months.join('');
}

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  opts.headers['Authorization'] = token;
  const res = await fetch(path, opts);
  if (res.status === 401) { sessionStorage.removeItem('bills_token'); location.reload(); return; }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  viewingMonth = document.getElementById('monthSelect').value || currentMonth;
  try {
    const data = await api('/api/bills?month=' + viewingMonth);
    const bills = data.bills || [];
    document.getElementById('status').textContent = 'กำลังดู: ' + viewingMonth + ' · อัปเดต: ' + new Date().toLocaleTimeString('th-TH');
    render(bills);
  } catch (e) {
    document.getElementById('status').textContent = 'โหลดไม่สำเร็จ';
  }
}

function render(bills) {
  const list = document.getElementById('list');
  if (!bills.length) { list.innerHTML = '<div style="text-align:center;color:#a89f91;padding:20px;">ยังไม่มีรายการ</div>'; return; }
  const sorted = [...bills].sort((a,b) => a.day - b.day);
  const isCurrent = viewingMonth === currentMonth;
  list.innerHTML = sorted.map(b => {
    const paid = (b.paidMonths || []).includes(viewingMonth);
    return \`<div class="bill-item \${paid?'paid':''}" \${isCurrent ? \`onclick="toggle('\${b.id}')"\` : ''}>
      <div class="checkbox"></div>
      <div class="info">
        <div class="name">\${esc(b.name)}</div>
        <div class="meta">ทุกวันที่ \${b.day} \${b.amount ? '<span class="amount">'+Number(b.amount).toLocaleString()+' บาท</span>' : ''} \${b.note?'· '+esc(b.note):''}</div>
      </div>
      \${isCurrent ? \`<button class="delete-btn" onclick="event.stopPropagation();del('\${b.id}')">×</button>\` : ''}
    </div>\`;
  }).join('');
}

async function toggle(id) {
  if (viewingMonth !== currentMonth) return;
  await api('/api/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, month: currentMonth}) });
  load();
}
async function del(id) {
  if (!confirm('ลบรายการนี้?')) return;
  await api('/api/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) });
  load();
}
async function addBill() {
  const name = document.getElementById('name').value.trim();
  const day = parseInt(document.getElementById('day').value);
  const amount = document.getElementById('amount').value;
  const note = document.getElementById('note').value.trim();
  if (!name || !day || day<1 || day>31) { alert('กรอกชื่อและวันที่ให้ถูกต้อง'); return; }
  await api('/api/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, day, amount, note}) });
  document.getElementById('name').value = '';
  document.getElementById('day').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('note').value = '';
  load();
}
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[m])); }

if (token) showApp();
setInterval(() => { if (token && viewingMonth === currentMonth) load(); }, 15000);
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

    if (!env.BILLS) return new Response('KV not bound', { status: 500 });

    if (url.pathname === '/api/login' && request.method === 'POST') {
      const { password } = await request.json();
      if (password === PASSWORD) {
        const token = crypto.randomUUID();
        await env.BILLS.put('token:' + token, '1', { expirationTtl: 60 * 60 * 24 * 30 });
        return Response.json({ ok: true, token });
      }
      return Response.json({ ok: false }, { status: 401 });
    }

    const auth = request.headers.get('Authorization') || '';
    const valid = auth && await env.BILLS.get('token:' + auth);
    if (!valid) return new Response('Unauthorized', { status: 401 });

    if (url.pathname === '/api/bills' && request.method === 'GET') {
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0,7);
      const raw = await env.BILLS.get('family_bills', 'json') || { bills: [] };
      // Ensure paidMonths array exists
      raw.bills = raw.bills.map(b => ({ paidMonths: [], ...b }));
      return Response.json(raw);
    }

    if (url.pathname === '/api/add' && request.method === 'POST') {
      const body = await request.json();
      const data = await env.BILLS.get('family_bills', 'json') || { bills: [] };
      data.bills.push({
        id: 'id_' + Date.now(),
        name: body.name,
        day: body.day,
        amount: body.amount || '',
        note: body.note || '',
        paidMonths: []
      });
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ ok: true });
    }

    if (url.pathname === '/api/toggle' && request.method === 'POST') {
      const { id, month } = await request.json();
      const data = await env.BILLS.get('family_bills', 'json') || { bills: [] };
      const b = data.bills.find(x => x.id === id);
      if (b) {
        b.paidMonths = b.paidMonths || [];
        if (b.paidMonths.includes(month)) {
          b.paidMonths = b.paidMonths.filter(m => m !== month);
        } else {
          b.paidMonths.push(month);
        }
      }
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ ok: true });
    }

    if (url.pathname === '/api/delete' && request.method === 'POST') {
      const { id } = await request.json();
      const data = await env.BILLS.get('family_bills', 'json') || { bills: [] };
      data.bills = data.bills.filter(x => x.id !== id);
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }
};
