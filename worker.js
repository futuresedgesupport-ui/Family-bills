// Simple password version - client-side check + KV data
const PASSWORD = "1234";

const HTML = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ตัวช่วยจ่ายค่า</title>
<style>
:root{--bg:#1a1814;--card:#2a2622;--text:#f5f0e8;--muted:#a89f91;--gold:#d4af7a;--accent:#c9a96e;--success:#6b8f71;--border:#3d3833}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,"Noto Serif Thai",serif;background:var(--bg);color:var(--text);padding:20px 16px;max-width:480px;margin:0 auto}
header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
header h1{font-size:1.5rem;color:var(--gold)}
.bill-item{background:var(--card);border:1px solid var(--border);border-radius:4px;padding:14px;display:flex;gap:12px;margin-bottom:8px}
.bill-item.paid{opacity:.5}.bill-item.paid .name{text-decoration:line-through}
.checkbox{width:22px;height:22px;border:1.5px solid var(--gold);border-radius:2px;flex-shrink:0}
.bill-item.paid .checkbox{background:var(--success)}
.bill-item.paid .checkbox::after{content:"✓";color:#fff;display:flex;align-items:center;justify-content:center;height:100%;font-size:13px}
.name{font-size:1.05rem}.meta{color:var(--muted);font-size:.8rem;margin-top:3px}.amount{color:var(--gold)}
.section{background:var(--card);border:1px solid var(--border);border-radius:4px;padding:16px;margin:12px 0}
input,textarea,select{width:100%;background:#1f1c19;border:1px solid var(--border);color:var(--text);padding:10px;border-radius:2px;margin-bottom:8px;font-family:inherit}
.btn{background:var(--accent);color:#1a1814;border:none;padding:12px;width:100%;border-radius:2px;font-weight:600}
#login{max-width:300px;margin:60px auto;text-align:center}
.hidden{display:none}
</style>
</head>
<body>
<div id="login">
  <h1 style="color:var(--gold);margin-bottom:20px">ตัวช่วยจ่ายค่า</h1>
  <input type="password" id="pw" placeholder="รหัสผ่าน">
  <button class="btn" onclick="checkPw()">เข้าสู่ระบบ</button>
  <p id="err" style="color:#c17a6a;margin-top:10px"></p>
</div>
<div id="app" class="hidden">
  <header><h1>ตัวช่วยจ่ายค่า</h1><p style="color:var(--muted);font-size:.85rem">แชร์กันในครอบครัว</p></header>
  <select id="monthSel" onchange="load()"></select>
  <div id="status" style="text-align:center;color:var(--muted);font-size:.8rem;margin:8px 0"></div>
  <div id="list"></div>
  <div class="section">
    <h3 style="color:var(--gold);margin-bottom:10px">เพิ่มรายการ</h3>
    <input id="n" placeholder="ชื่อรายการ">
    <div style="display:flex;gap:8px">
      <input id="d" type="number" placeholder="วันที่" min="1" max="31" style="flex:1">
      <input id="a" type="number" placeholder="จำนวนเงิน" style="flex:1">
    </div>
    <textarea id="note" placeholder="โน้ต"></textarea>
    <button class="btn" onclick="add()">เพิ่มรายการ</button>
  </div>
</div>
<script>
const PW = "${PASSWORD}";
const now = new Date(), cur = now.toISOString().slice(0,7);
function checkPw(){
  if(document.getElementById('pw').value === PW){
    localStorage.setItem('ok','1');
    show();
  } else document.getElementById('err').textContent = 'รหัสผ่านไม่ถูกต้อง';
}
function show(){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const sel = document.getElementById('monthSel');
  let o = '';
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const v = d.toISOString().slice(0,7);
    o += \`<option value="\${v}" \${v===cur?'selected':''}>\${d.toLocaleDateString('th-TH',{year:'numeric',month:'long'})}</option>\`;
  }
  sel.innerHTML = o;
  load();
}
async function load(){
  const m = document.getElementById('monthSel').value || cur;
  const r = await fetch('/api/bills');
  const data = await r.json();
  const bills = data.bills || [];
  document.getElementById('status').textContent = 'เดือน ' + m;
  const list = document.getElementById('list');
  if(!bills.length){ list.innerHTML = '<div style="text-align:center;color:#a89f91;padding:20px">ยังไม่มีรายการ</div>'; return; }
  const isCur = m === cur;
  list.innerHTML = bills.sort((a,b)=>a.day-b.day).map(b => {
    const paid = (b.paidMonths||[]).includes(m);
    return \`<div class="bill-item \${paid?'paid':''}" \${isCur?\`onclick="tog('\${b.id}')"\`:''}>
      <div class="checkbox"></div>
      <div style="flex:1"><div class="name">\${b.name}</div>
      <div class="meta">วันที่ \${b.day} \${b.amount?'<span class="amount">'+Number(b.amount).toLocaleString()+' บาท</span>':''} \${b.note?'· '+b.note:''}</div></div>
      \${isCur?\`<button onclick="event.stopPropagation();del('\${b.id}')" style="background:none;border:none;color:#a89f91">×</button>\`:''}
    </div>\`;
  }).join('');
}
async function tog(id){ await fetch('/api/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,month:cur})}); load(); }
async function del(id){ if(confirm('ลบ?')){ await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); load(); } }
async function add(){
  const name = document.getElementById('n').value.trim(), day = +document.getElementById('d').value;
  if(!name || !day) return alert('กรอกชื่อและวันที่');
  await fetch('/api/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,day,amount:document.getElementById('a').value,note:document.getElementById('note').value})});
  ['n','d','a','note'].forEach(id => document.getElementById(id).value='');
  load();
}
if(localStorage.getItem('ok')==='1') show();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(HTML, {headers:{'Content-Type':'text/html;charset=UTF-8'}});
    if (!env.BILLS) return new Response('KV not bound', {status:500});

    if (url.pathname === '/api/bills') {
      const data = await env.BILLS.get('family_bills','json') || {bills:[]};
      data.bills = data.bills.map(b => ({paidMonths:[],...b}));
      return Response.json(data);
    }
    if (url.pathname === '/api/add' && request.method === 'POST') {
      const body = await request.json();
      const data = await env.BILLS.get('family_bills','json') || {bills:[]};
      data.bills.push({id:'id'+Date.now(), name:body.name, day:body.day, amount:body.amount||'', note:body.note||'', paidMonths:[]});
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    if (url.pathname === '/api/toggle' && request.method === 'POST') {
      const {id, month} = await request.json();
      const data = await env.BILLS.get('family_bills','json') || {bills:[]};
      const b = data.bills.find(x => x.id === id);
      if (b) {
        b.paidMonths = b.paidMonths || [];
        b.paidMonths = b.paidMonths.includes(month) ? b.paidMonths.filter(m=>m!==month) : [...b.paidMonths, month];
      }
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    if (url.pathname === '/api/delete' && request.method === 'POST') {
      const {id} = await request.json();
      const data = await env.BILLS.get('family_bills','json') || {bills:[]};
      data.bills = data.bills.filter(x => x.id !== id);
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    return new Response('Not found', {status:404});
  }
};
