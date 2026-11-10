// Cloudflare Worker + KV for family bill sharing
// Bind KV namespace as "BILLS" in the Worker settings

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
  input, textarea {
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
</style>
</head>
<body>
<header>
  <h1>ตัวช่วยจ่ายค่า</h1>
  <p>แชร์กันในครอบครัว</p>
</header>
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

<script>
let bills = [];
const currentMonth = new Date().toISOString().slice(0,7);

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  try {
    const data = await api('/api/bills');
    bills = data.bills || [];
    document.getElementById('status').textContent = 'อัปเดตล่าสุด: ' + new Date().toLocaleTimeString('th-TH');
    render();
  } catch (e) {
    document.getElementById('status').textContent = 'โหลดไม่สำเร็จ';
  }
}

function render() {
  const list = document.getElementById('list');
  if (!bills.length) { list.innerHTML = '<div style="text-align:center;color:#a89f91;padding:20px;">ยังไม่มีรายการ</div>'; return; }
  const sorted = [...bills].sort((a,b) => a.day - b.day);
  list.innerHTML = sorted.map(b => {
    const paid = (b.paidMonth === currentMonth);
    return \`<div class="bill-item \${paid?'paid':''}" onclick="toggle('\${b.id}')">
      <div class="checkbox"></div>
      <div class="info">
        <div class="name">\${esc(b.name)}</div>
        <div class="meta">ทุกวันที่ \${b.day} \${b.amount ? '<span class="amount">'+Number(b.amount).toLocaleString()+' บาท</span>' : ''} \${b.note?'· '+esc(b.note):''}</div>
      </div>
      <button class="delete-btn" onclick="event.stopPropagation();del('\${b.id}')">×</button>
    </div>\`;
  }).join('');
}

async function toggle(id) {
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
load();
setInterval(load, 15000);
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

    if (!env.BILLS) return new Response('KV not bound', { status: 500 });

    if (url.pathname === '/api/bills' && request.method === 'GET') {
      const raw = await env.BILLS.get('family_bills', 'json') || { bills: [] };
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
        paidMonth: ''
      });
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ ok: true });
    }

    if (url.pathname === '/api/toggle' && request.method === 'POST') {
      const { id, month } = await request.json();
      const data = await env.BILLS.get('family_bills', 'json') || { bills: [] };
      const b = data.bills.find(x => x.id === id);
      if (b) b.paidMonth = (b.paidMonth === month) ? '' : month;
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
