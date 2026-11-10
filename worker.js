const HTML = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ตัวช่วยจ่ายค่า</title>
<style>
body{font-family:Georgia,serif;background:#1a1814;color:#f5f0e8;padding:16px;max-width:480px;margin:0 auto}
h1{color:#d4af7a;text-align:center}
.item{background:#2a2622;border:1px solid #3d3833;padding:12px;margin:8px 0;border-radius:4px}
.paid{opacity:.5;text-decoration:line-through}
input,textarea,button,select{width:100%;padding:10px;margin:6px 0;border-radius:2px;border:1px solid #3d3833;background:#1f1c19;color:#f5f0e8;font-family:inherit}
button{background:#c9a96e;color:#1a1814;font-weight:bold;border:none}
</style>
</head>
<body>
<h1>ตัวช่วยจ่ายค่า</h1>
<select id="m" onchange="load()"></select>
<div id="list"></div>
<hr style="border-color:#3d3833;margin:16px 0">
<input id="name" placeholder="ชื่อรายการ">
<input id="day" type="number" placeholder="วันที่ (1-31)" min="1" max="31">
<input id="amount" type="number" placeholder="จำนวนเงิน">
<textarea id="note" placeholder="โน้ต"></textarea>
<button onclick="add()">เพิ่มรายการ</button>
<p id="msg" style="color:#c17a6a;text-align:center"></p>
<script>
const cur = new Date().toISOString().slice(0,7);
const sel = document.getElementById('m');
for(let i=0;i<6;i++){
  const d = new Date(); d.setMonth(d.getMonth()-i);
  const v = d.toISOString().slice(0,7);
  sel.innerHTML += '<option value="'+v+'">'+d.toLocaleDateString('th-TH',{month:'long',year:'numeric'})+'</option>';
}
async function load(){
  const r = await fetch('/api/bills');
  const data = await r.json();
  const bills = data.bills || [];
  const m = sel.value;
  document.getElementById('list').innerHTML = bills.map(b => {
    const paid = (b.paidMonths||[]).includes(m);
    return '<div class="item '+(paid?'paid':'')+'" onclick="tog(\\''+b.id+'\\')">'+
      b.name+' (วันที่ '+b.day+') '+(b.amount?b.amount+' บาท':'')+
      '<button onclick="event.stopPropagation();del(\\''+b.id+'\\')" style="float:right;width:auto;padding:4px 8px">×</button></div>';
  }).join('') || '<p style="text-align:center;color:#a89f91">ยังไม่มีรายการ</p>';
}
async function add(){
  const name = document.getElementById('name').value.trim();
  const day = +document.getElementById('day').value;
  if(!name || !day){ document.getElementById('msg').textContent='กรอกชื่อและวันที่'; return; }
  await fetch('/api/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name, day, amount:document.getElementById('amount').value, note:document.getElementById('note').value
  })});
  document.getElementById('name').value = document.getElementById('day').value = document.getElementById('amount').value = document.getElementById('note').value = '';
  document.getElementById('msg').textContent = '';
  load();
}
async function tog(id){
  await fetch('/api/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,month:cur})});
  load();
}
async function del(id){
  if(confirm('ลบ?')){ await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); load(); }
}
load();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(HTML, {headers:{'content-type':'text/html;charset=utf-8'}});
    if (!env.BILLS) return Response.json({error:'no kv'}, {status:500});

    if (url.pathname === '/api/bills') {
      let data = await env.BILLS.get('family_bills', 'json');
      if (!data) data = {bills:[]};
      return Response.json(data);
    }
    if (url.pathname === '/api/add' && request.method === 'POST') {
      const body = await request.json();
      let data = await env.BILLS.get('family_bills', 'json') || {bills:[]};
      data.bills.push({
        id: 'b' + Date.now(),
        name: body.name || '',
        day: Number(body.day) || 1,
        amount: body.amount || '',
        note: body.note || '',
        paidMonths: []
      });
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    if (url.pathname === '/api/toggle' && request.method === 'POST') {
      const {id, month} = await request.json();
      let data = await env.BILLS.get('family_bills', 'json') || {bills:[]};
      const b = data.bills.find(x => x.id === id);
      if (b) {
        if (!b.paidMonths) b.paidMonths = [];
        if (b.paidMonths.includes(month)) b.paidMonths = b.paidMonths.filter(x => x !== month);
        else b.paidMonths.push(month);
      }
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    if (url.pathname === '/api/delete' && request.method === 'POST') {
      const {id} = await request.json();
      let data = await env.BILLS.get('family_bills', 'json') || {bills:[]};
      data.bills = data.bills.filter(x => x.id !== id);
      await env.BILLS.put('family_bills', JSON.stringify(data));
      return Response.json({ok:true});
    }
    return new Response('not found', {status:404});
  }
};
