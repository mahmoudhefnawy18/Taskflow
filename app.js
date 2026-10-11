'use strict';
const URL_SUPA='https://dwnfdwjxijatlniazrgr.supabase.co';
const PUBLIC_KEY='sb_publishable_7sSVC1OPs7NQlA1HA4Db1w_TCIZZtTd';
const STORE='taskflow-v1', $=id=>document.getElementById(id);
const client=window.supabase?.createClient(URL_SUPA,PUBLIC_KEY)||null;
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromKey=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const plusDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const monday=d=>plusDays(d,-((d.getDay()+6)%7));
const weekKey=d=>dateKey(monday(d));
let today=dateKey(new Date());let selected=today,week=weekKey(new Date()),month=new Date().getMonth(),year=new Date().getFullYear();
let tasks=[],user=null,channel=null,loading=false,rerun=false,moving=null,movingKind=null,authReady=false;
const uuid=()=>crypto.randomUUID();
function readCache(){try{const v=JSON.parse(localStorage.getItem(user?STORE+'-'+user.id:STORE)||'[]');tasks=Array.isArray(v)?v:[]}catch{tasks=[]}}
function cache(){localStorage.setItem(user?STORE+'-'+user.id:STORE,JSON.stringify(tasks));render()}
function active(){return tasks.filter(t=>!t.deleted&&!t.done)}
function sort(a,b){return (a.order??1e12)-(b.order??1e12)||String(a.updated_at||'').localeCompare(String(b.updated_at||''))}
function dateText(key){return fromKey(key).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
function setStatus(s){$('status').textContent=s||''}
function showLogin(message=''){ $('loginArea').classList.remove('hidden'); if(message)$('loginMessage').textContent=message; }
function showLoading(message){$('loadingMessage').textContent=message||''; $('loadingMessage').classList.toggle('hidden',!message); }
function normalize(t){if(t.done&&!t.deleted)t.deleted=true;return t}
function applyRemote(rows){const map=new Map(tasks.map(t=>[t.id,t]));for(const r of rows){const t=r.payload;if(!t?.id)continue;const old=map.get(t.id);if(!old||String(t.updated_at||'')>=String(old.updated_at||''))map.set(t.id,normalize(t))}tasks=[...map.values()];cache()}
async function persist(t){t.updated_at=new Date().toISOString();cache();if(!client||!user)return;try{const {error}=await client.from('taskflow_tasks').upsert({id:t.id,user_id:user.id,payload:t,updated_at:t.updated_at});if(error)throw error;setStatus('')}catch(e){setStatus('Saved on this device; cloud sync failed: '+e.message);console.error(e)}}
async function sync(){if(!client||!user)return;if(loading){rerun=true;return}loading=true;showLoading('Loading tasks from Supabase…');const owner=user.id;try{const {data,error}=await client.from('taskflow_tasks').select('*').eq('user_id',owner);if(error)throw error;if(user?.id!==owner)return;const remote=data||[],map=new Map(remote.map(r=>[r.id,r]));for(const t of [...tasks]){const r=map.get(t.id);if(!r||String(t.updated_at||'')>String(r.payload?.updated_at||r.updated_at||'')){const {error:e}=await client.from('taskflow_tasks').upsert({id:t.id,user_id:owner,payload:t,updated_at:t.updated_at||new Date().toISOString()});if(e)throw e}}if(user?.id===owner){applyRemote(remote);setStatus('');showLoading('')}}catch(e){setStatus('Sync issue: '+e.message);showLoading('Could not load cloud tasks. Check your connection and sign-in.');console.error(e)}finally{loading=false;if(rerun){rerun=false;sync()}}}
function subscribe(){if(channel)client.removeChannel(channel);if(!user)return;const owner=user.id;channel=client.channel('taskflow-'+owner).on('postgres_changes',{event:'*',schema:'public',table:'taskflow_tasks',filter:'user_id=eq.'+owner},event=>{if(user?.id!==owner)return;if(event.new?.payload)applyRemote([event.new]);if(event.eventType==='DELETE')sync()}).subscribe()}
function setUser(u){
 authReady=true;
 const same=u?.id===user?.id;
 if(same && u){$('loginArea').classList.add('hidden');$('accountArea').classList.remove('hidden');return;}
 if(channel&&client){client.removeChannel(channel);channel=null;}
 user=u||null;
 // Never display unauthenticated local tasks as if they were cloud tasks.
 if(!user){$('accountArea').classList.add('hidden');tasks=[];render();showLoading('');showLogin('Sign in on this Home Screen app to load your tasks. Safari and Home Screen can have separate sessions.');return;}
 $('loginArea').classList.add('hidden');$('accountArea').classList.remove('hidden');readCache();render();showLoading('Loading tasks from Supabase…');subscribe();sync();
}
function rowsFor(kind){const a=active();if(kind==='day')return a.filter(t=>t.date===selected||(selected===today&&t.date&&t.date<today)).sort(sort);if(kind==='week')return a.filter(t=>!t.date&&t.week===week).sort(sort);return a.filter(t=>!t.date&&!t.week).sort(sort)}
function render(){const now=dateKey(new Date());if(now!==today){if(selected===today)selected=now;today=now;week=weekKey(new Date())}const a=active();$('remaining').textContent=a.length;$('dayTitle').textContent=dateText(selected);$('dayHeading').textContent=selected===today?"Today's tasks":'Tasks for this day';$('weekTitle').textContent='Week of '+dateText(week);for(const kind of ['day','week','any']){const rows=rowsFor(kind);$(kind+'Count').textContent=rows.length;const parent=$(kind+'List');parent.replaceChildren();if(!rows.length){const e=document.createElement('div');e.className='empty';e.textContent='No remaining tasks';parent.append(e)}rows.forEach((t,i)=>drawTask(parent,t,i+1,kind))}renderCalendar();renderSearch()}
function drawTask(parent,t,n,kind){const row=document.createElement('div');row.className='task';row.dataset.id=t.id;const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label','Complete '+t.name);checkbox.onchange=()=>{t.done=true;t.deleted=true;persist(t)};const label=document.createElement('span');label.className='task-name';label.textContent=t.name;label.onclick=()=>editName(t);const move=document.createElement('button');move.className='move';move.textContent='↗';move.title='Move within this list or to another list';move.onclick=()=>openMove(t,kind);const number=document.createElement('span');number.className='number';number.textContent=n;row.append(checkbox,label,move,number);parent.append(row)}
function editName(t){const name=prompt('Edit task',t.name);if(name!==null&&name.trim()&&name.trim()!==t.name){t.name=name.trim();persist(t)}}
function addInline(kind){const slot=$(kind+'New');if(slot.childElementCount){slot.replaceChildren();return}const form=document.createElement('form');form.className='new-task';const cb=document.createElement('input');cb.type='checkbox';cb.disabled=true;const input=document.createElement('input');input.placeholder='Write a task…';input.required=true;input.maxLength=400;const button=document.createElement('button');button.textContent='+';button.title='Save task';button.setAttribute('aria-label','Save task');const close=document.createElement('button');close.type='button';close.textContent='−';close.className='close-new';close.title='Close without adding';close.onclick=()=>slot.replaceChildren();form.append(cb,input,button,close);slot.append(form);input.focus();form.onsubmit=e=>{e.preventDefault();const name=input.value.trim();if(!name)return;const t={id:uuid(),name,date:kind==='day'?selected:null,week:kind==='week'?week:kind==='day'?weekKey(fromKey(selected)):null,done:false,deleted:false,order:Date.now()+Math.random()};tasks.push(t);persist(t);slot.replaceChildren()};input.onkeydown=e=>{if(e.key==='Escape')slot.replaceChildren()}}
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addInline(b.dataset.add));
function openMove(t,kind=null){
 moving=t;
 movingKind=kind||(t.date?'day':t.week?'week':'any');
 $('moveTaskName').textContent=t.name;
 $('moveMode').value='same';
 $('moveDate').value=t.date||selected;
 $('destination').value=t.date?'day':t.week?'week':'any';
 toggleMoveMode();
 $('moveDialog').showModal();
}
function toggleMoveMode(){
 const same=$('moveMode').value==='same';
 $('destinationControls').classList.toggle('hidden',same);
 toggleDate();
}
function toggleDate(){
 const other=$('moveMode').value==='other';
 const showDate=other&&$('destination').value==='day';
 $('moveDate').classList.toggle('hidden',!showDate);
 $('dateLabel').classList.toggle('hidden',!showDate);
 updatePositions();
}
$('moveMode').onchange=toggleMoveMode;
$('destination').onchange=toggleDate;
$('moveDate').onchange=updatePositions;
$('cancelMove').onclick=()=>$('moveDialog').close();
function destinationRows(dest,date){
 const a=active().filter(t=>t.id!==moving?.id);
 if(dest==='day')return a.filter(t=>t.date===date||(date===today&&t.date&&t.date<today)).sort(sort);
 if(dest==='week')return a.filter(t=>!t.date&&t.week===week).sort(sort);
 return a.filter(t=>!t.date&&!t.week).sort(sort);
}
function updatePositions(){
 const sel=$('movePosition');if(!sel)return;
 const same=$('moveMode').value==='same';
 const rows=same?rowsFor(movingKind).filter(t=>t.id!==moving?.id):destinationRows($('destination').value,$('moveDate').value||selected);
 sel.replaceChildren();
 for(let i=1;i<=rows.length+1;i++){
  const opt=document.createElement('option');opt.value=i;
  opt.textContent=i===rows.length+1?`${i} — End of list`:String(i);
  sel.append(opt);
 }
 if(same&&moving){
  const index=rowsFor(movingKind).findIndex(t=>t.id===moving.id);
  sel.value=String(Math.max(1,index+1));
 }else{sel.value=String(rows.length+1)}
}
async function saveOrder(rows){
 const stamp=Date.now();
 rows.forEach((item,i)=>{item.order=stamp+i;item.updated_at=new Date(stamp+i).toISOString()});
 cache();
 if(client&&user){
  const owner=user.id;
  for(const item of rows){
   const {error}=await client.from('taskflow_tasks').upsert({id:item.id,user_id:owner,payload:item,updated_at:item.updated_at});
   if(error)setStatus('Sync issue: '+error.message);
  }
 }
}
$('confirmMove').onclick=async()=>{
 if(!moving)return;
 const t=moving,same=$('moveMode').value==='same';
 const pos=Math.max(0,Number($('movePosition').value||1)-1);
 let rows;
 if(same){
  rows=rowsFor(movingKind).filter(item=>item.id!==t.id);
 }else{
  const dest=$('destination').value,d=$('moveDate').value||selected;
  rows=destinationRows(dest,d);
  if(dest==='day'){
   t.date=d;t.week=weekKey(fromKey(d));
   selected=d;month=fromKey(d).getMonth();year=fromKey(d).getFullYear();
  }else if(dest==='week'){t.date=null;t.week=week}
  else{t.date=null;t.week=null}
 }
 rows.splice(Math.min(pos,rows.length),0,t);
 $('moveDialog').close();moving=null;movingKind=null;
 await saveOrder(rows);
};
function chooseDate(key){selected=key;week=weekKey(fromKey(key));month=fromKey(key).getMonth();year=fromKey(key).getFullYear();render();$('dayPanel').scrollIntoView({behavior:'smooth',block:'start'})}
function renderCalendar(){const cal=$('calendar');cal.replaceChildren();$('monthTitle').textContent=new Date(year,month,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});for(const s of ['M','T','W','T','F','S','S']){const d=document.createElement('div');d.className='dow';d.textContent=s;cal.append(d)}const start=monday(new Date(year,month,1));const a=active();for(let i=0;i<42;i++){const d=plusDays(start,i),key=dateKey(d),count=a.filter(t=>t.date===key).length;const b=document.createElement('button');b.className='day'+(d.getMonth()!==month?' other':'')+(key===selected?' selected':'')+(key===today?' today':'');const num=document.createElement('span');num.textContent=d.getDate();b.append(num);if(count){const c=document.createElement('span');c.className='bubble';c.textContent=count;b.append(c)}b.onclick=()=>chooseDate(key);cal.append(b)}}
function renderSearch(){const q=$('search').value.trim().toLowerCase(),out=$('results');out.replaceChildren();if(!q)return;const found=active().filter(t=>t.name.toLowerCase().includes(q)).slice(0,40);if(!found.length){out.textContent='No matching tasks';return}for(const t of found){const row=document.createElement('div');row.className='result';const text=document.createElement('span');text.textContent=t.name;const btn=document.createElement('button');btn.textContent='Move ↗';btn.onclick=()=>openMove(t);row.append(text,btn);out.append(row)}}$('search').oninput=renderSearch;
$('prevDay').onclick=()=>chooseDate(dateKey(plusDays(fromKey(selected),-1)));$('nextDay').onclick=()=>chooseDate(dateKey(plusDays(fromKey(selected),1)));
$('prevWeek').onclick=()=>{week=dateKey(plusDays(fromKey(week),-7));render()};$('nextWeek').onclick=()=>{week=dateKey(plusDays(fromKey(week),7));render()};
$('prevMonth').onclick=()=>{const d=new Date(year,month-1,1);month=d.getMonth();year=d.getFullYear();render()};$('nextMonth').onclick=()=>{const d=new Date(year,month+1,1);month=d.getMonth();year=d.getFullYear();render()};
let swipeX=0,swipeY=0;$('dayPanel').addEventListener('touchstart',e=>{if(e.target.closest('.task'))return;swipeX=e.touches[0].clientX;swipeY=e.touches[0].clientY},{passive:true});$('dayPanel').addEventListener('touchend',e=>{if(e.target.closest('.task'))return;const dx=e.changedTouches[0].clientX-swipeX,dy=e.changedTouches[0].clientY-swipeY;if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*1.6)chooseDate(dateKey(plusDays(fromKey(selected),dx<0?1:-1)))},{passive:true});
if(client){
 $('loginForm').onsubmit=async e=>{
  e.preventDefault();$('loginMessage').textContent='Signing in…';
  const email=$('email').value.trim(),password=$('password').value;
  const {error}=await client.auth.signInWithPassword({email,password});
  $('loginMessage').textContent=error?'Sign-in failed: '+error.message:'';
  if(!error)$('password').value='';
 };
 $('showPassword').onclick=()=>{$('passwordForm').classList.toggle('hidden');};
 $('cancelPassword').onclick=()=>{$('passwordForm').classList.add('hidden');$('newPassword').value='';};
 $('passwordForm').onsubmit=async e=>{
  e.preventDefault();const password=$('newPassword').value;
  if(password.length<8){$('passwordMessage').textContent='Use at least 8 characters.';return;}
  $('passwordMessage').textContent='Saving password…';
  const {error}=await client.auth.updateUser({password});
  $('passwordMessage').textContent=error?'Could not set password: '+error.message:'Password saved. You can now sign in from your iPhone Home Screen using the same email and this password.';
  if(!error){$('newPassword').value='';$('passwordForm').classList.add('hidden');}
 };
 client.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null)});
 client.auth.getSession().then(({data,error})=>{if(error){showLogin('Could not restore sign-in: '+error.message);showLoading('');return;}setUser(data.session?.user||null)}).catch(e=>{showLogin('Sign-in check failed: '+e.message);showLoading('')});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)sync()});
 window.addEventListener('online',()=>{if(user)sync()});
}else{showLogin('Supabase library could not load. Check your internet connection and reload.');showLoading('');}

tasks=[];render();showLoading('Checking sign-in…');setInterval(()=>{if(dateKey(new Date())!==today)render()},60000);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.error);
