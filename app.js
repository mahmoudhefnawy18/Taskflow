'use strict';
// OPTIONAL: paste your Supabase project URL and public anon/publishable key below.
// For private tasks, enable Supabase Auth and the per-user RLS SQL supplied in the instructions.
const SUPABASE_URL = 'https://dwnfdwjxijatlniazrgr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7sSVC1OPs7NQlA1HA4Db1w_TCIZZtTd';
const STORE = 'taskflow-v1';
let realtimeChannel=null;
let syncBusy=false;
let syncAgain=false;
function setSyncStatus(message){const el=$('syncStatus');if(el)el.textContent=message;}
const $ = id => document.getElementById(id);
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromKey = s => {const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const plusDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const monday=d=>plusDays(d,-(d.getDay()+6)%7);
const weekKey=d=>dateKey(monday(d));
const today=dateKey(new Date());
let selected=today, week=weekKey(new Date()), month=new Date().getMonth(), year=new Date().getFullYear(), filter='all';
let tasks=[];
try{const parsed=JSON.parse(localStorage.getItem(STORE)||'[]');tasks=Array.isArray(parsed)?parsed:[]}catch{}
let client=null,user=null;
if(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase){client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY)}
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();
function saveLocal(){localStorage.setItem(user ? STORE+'-'+user.id : STORE,JSON.stringify(tasks));render()}
// Merge remote changes into the current view without requiring a refresh.
// The updated_at timestamp and deleted tombstones prevent old records reappearing.
function mergeRemote(rows){
  const merged=new Map(tasks.map(t=>[t.id,t]));
  for(const r of rows){
    const t=r.payload;
    if(!t||!t.id)continue;
    const current=merged.get(t.id);
    if(!current||(t.updated_at||'')>(current.updated_at||''))merged.set(t.id,t);
  }
  tasks=[...merged.values()];
  saveLocal();
}
function subscribeRealtime(){
  if(!client||!user)return;
  if(realtimeChannel){client.removeChannel(realtimeChannel);realtimeChannel=null;}
  const owner=user.id;
  realtimeChannel=client.channel('taskflow-live-'+owner)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'taskflow_tasks',filter:'user_id=eq.'+owner
    },payload=>{
      if(user?.id!==owner)return;
      if(payload.new?.payload)mergeRemote([payload.new]);
      if(payload.eventType==='DELETE'){
        tasks=tasks.filter(t=>t.id!==payload.old?.id);saveLocal();
      }
    }).subscribe();
}
async function sync(){
  if(!client||!user)return;
  if(syncBusy){syncAgain=true;return;}
  syncBusy=true;
  try{
    const owner=user.id;
    const {data,error}=await client.from('taskflow_tasks').select('*').eq('user_id',owner);
    if(error)throw error;
    if(user?.id!==owner)return;
    const remote=data||[];
    const remoteById=new Map(remote.map(r=>[r.id,r]));
    // First upload locally newer changes; then merge server rows.
    for(const t of [...tasks]){
      const r=remoteById.get(t.id);
      if(!r||(t.updated_at||'')>(r.payload?.updated_at||r.updated_at||'')){
        const {error:e}=await client.from('taskflow_tasks').upsert({id:t.id,user_id:owner,payload:t,updated_at:t.updated_at||new Date().toISOString()});
        if(e)throw e;
      }
    }
    if(user?.id===owner){mergeRemote(remote);setSyncStatus('');}
  }catch(e){console.error('TaskFlow sync error',e);setSyncStatus('Sync error: '+e.message);}
  finally{syncBusy=false;if(syncAgain){syncAgain=false;sync();}}
}
async function persist(t){
  t.updated_at=new Date().toISOString();
  saveLocal(); // instant on-screen update, before network request
  if(client&&user){
    const owner=user.id;
    try{
      const {error}=await client.from('taskflow_tasks').upsert({id:t.id,user_id:owner,payload:t,updated_at:t.updated_at});
      if(error)throw error;
      setSyncStatus('');
    }catch(e){console.error('TaskFlow save error',e);setSyncStatus('Saved locally; sync failed: '+e.message);}
  }
}
function formatDate(s,opts={weekday:'short',day:'numeric',month:'short'}){return fromKey(s).toLocaleDateString('en-GB',opts)}
function visible(t){return !t.deleted}
function all(){return tasks.filter(visible)}
function render(){const list=all();$('total').textContent=list.length;$('remaining').textContent=list.filter(t=>!t.done).length;$('completed').textContent=list.filter(t=>t.done).length;renderCalendar(list);renderWeek(list);renderDay(list);renderSearch(list)}
function renderCalendar(list){$('monthTitle').textContent=new Date(year,month,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});const cal=$('calendar');cal.replaceChildren();for(const d of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){const el=document.createElement('div');el.className='dow';el.textContent=d;cal.append(el)}const start=monday(new Date(year,month,1));for(let i=0;i<42;i++){const d=plusDays(start,i),key=dateKey(d),count=list.filter(t=>t.date===key).length;const b=document.createElement('button');b.className='day'+(d.getMonth()!==month?' other':'')+(key===selected?' selected':'')+(key===today?' today':'');b.innerHTML=`<span class="num">${d.getDate()}</span><span class="count ${count?'':'zero'}">${count}</span>`;b.onclick=()=>chooseDate(key);cal.append(b)}}
function chooseDate(key){selected=key;month=fromKey(key).getMonth();year=fromKey(key).getFullYear();week=weekKey(fromKey(key));if(!$('isUnallocated').checked)$('taskDate').value=key;render()}
function renderWeek(list){$('weekTitle').textContent=`Week of ${formatDate(week)}`;const end=dateKey(plusDays(fromKey(week),6));const wt=list.filter(t=>t.week===week||(t.date&&t.date>=week&&t.date<=end));const done=wt.filter(t=>t.done).length;$('weekStats').textContent=`📋 ${wt.length} total   ·   ✅ ${done} completed   ·   ⏳ ${wt.length-done} remaining`;const ua=wt.filter(t=>!t.date);$('unallocatedCount').textContent=ua.filter(t=>!t.done).length;$('unallocatedList').replaceChildren();if(!ua.length){empty($('unallocatedList'),'No unallocated tasks this week');return}ua.sort(sortTasks).forEach(t=>appendTask($('unallocatedList'),t,true))}
function sortTasks(a,b){return Number(a.done)-Number(b.done)||(a.time||'99:99').localeCompare(b.time||'99:99')}
function renderDay(list){$('dayTitle').textContent=formatDate(selected,{weekday:'long',day:'numeric',month:'short'});const daily=list.filter(t=>t.date===selected).sort(sortTasks).filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));$('dayList').replaceChildren();if(!daily.length){empty($('dayList'),'No tasks to show for this day');return}daily.forEach(t=>appendTask($('dayList'),t,false))}
function empty(parent,message){const e=document.createElement('div');e.className='empty';e.textContent=message;parent.append(e)}
function appendTask(parent,t,unallocated){const row=document.createElement('div');row.className='task'+(t.done?' done':'');const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=!!t.done;check.onchange=()=>{t.done=check.checked;persist(t)};const info=document.createElement('div');info.className='info';const name=document.createElement('div');name.className='name';name.textContent=t.name;const meta=document.createElement('div');meta.className='meta';meta.textContent=[t.time,t.priority,t.category].filter(Boolean).join(' · ');info.append(name,meta);label.append(check,info);const actions=document.createElement('div');actions.className='actions';const move=document.createElement('button');move.className='secondary';move.textContent=unallocated?'📅 Assign':'↔ Move';move.title='Move to another date';move.onclick=()=>openEdit(t);const edit=document.createElement('button');edit.className='ghost';edit.textContent='✎';edit.title='Edit task';edit.onclick=()=>openEdit(t);actions.append(move,edit);row.append(label,actions);let sx=0,sy=0;row.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});row.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*1.6){if(dx>0){t.done=!t.done;persist(t)}else openEdit(t)}},{passive:true});parent.append(row)}
function openEdit(t){$('editId').value=t.id;$('editName').value=t.name;$('editDate').value=t.date||t.week;$('editTime').value=t.time||'';$('editPriority').value=t.priority||'Medium';$('editCategory').value=t.category||'Personal';$('editUnallocated').checked=!t.date;$('editDate').disabled=!t.date;$('editDialog').showModal()}
$('editUnallocated').onchange=e=>$('editDate').disabled=e.target.checked;
$('editForm').onsubmit=async e=>{e.preventDefault();const t=tasks.find(t=>t.id===$('editId').value);if(!t)return;const date=$('editDate').value||selected;t.name=$('editName').value.trim();if(!t.name)return;t.date=$('editUnallocated').checked?null:date;t.week=weekKey(fromKey(date));t.time=$('editTime').value;t.priority=$('editPriority').value;t.category=$('editCategory').value;$('editDialog').close();await persist(t)};
$('closeEdit').onclick=()=>$('editDialog').close();
$('taskForm').onsubmit=async e=>{e.preventDefault();const name=$('taskName').value.trim();if(!name)return;const unallocated=$('isUnallocated').checked;const date=$('taskDate').value||selected;const t={id:uid(),name,date:unallocated?null:date,week:unallocated?week:weekKey(fromKey(date)),time:$('taskTime').value,priority:$('taskPriority').value,category:$('taskCategory').value,done:false,deleted:false};$('taskName').value='';$('taskTime').value='';await persist(t)};
$('isUnallocated').onchange=e=>{$('taskDate').disabled=e.target.checked};
$('prevMonth').onclick=()=>{const d=new Date(year,month-1,1);year=d.getFullYear();month=d.getMonth();render()};$('nextMonth').onclick=()=>{const d=new Date(year,month+1,1);year=d.getFullYear();month=d.getMonth();render()};$('prevDay').onclick=()=>chooseDate(dateKey(plusDays(fromKey(selected),-1)));$('nextDay').onclick=()=>chooseDate(dateKey(plusDays(fromKey(selected),1)));$('prevWeek').onclick=()=>{week=dateKey(plusDays(fromKey(week),-7));render()};$('nextWeek').onclick=()=>{week=dateKey(plusDays(fromKey(week),7));render()};$('todayBtn').onclick=()=>chooseDate(today);
$('filters').onclick=e=>{const b=e.target.closest('button[data-filter]');if(!b)return;filter=b.dataset.filter;for(const x of $('filters').querySelectorAll('button'))x.className=x===b?'active':'secondary';render()};
function renderSearch(list){const q=$('search').value.trim().toLowerCase();const parent=$('searchResults');parent.replaceChildren();if(!q)return;const found=list.filter(t=>t.name.toLowerCase().includes(q)).slice(0,30);if(!found.length){empty(parent,'No matching tasks');return}for(const t of found){const b=document.createElement('button');b.className='secondary';b.style='display:block;width:100%;text-align:left;margin-top:8px';b.textContent=`${t.done?'✓':'○'} ${t.name} — ${t.date||'Unallocated: '+t.week}`;b.onclick=()=>t.date?chooseDate(t.date):(week=t.week,render());parent.append(b)}}$('search').oninput=()=>renderSearch(all());
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(tasks,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='taskflow-backup-'+today+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
// Delete from editor using a dedicated button inserted here.
const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Delete task';del.style='grid-column:1/-1';del.onclick=async()=>{if(!confirm('Delete this task?'))return;const t=tasks.find(t=>t.id===$('editId').value);if(t){t.deleted=true;$('editDialog').close();await persist(t)}};$('editForm').append(del);
let swipeX=0,swipeY=0;$('dailyPanel').addEventListener('touchstart',e=>{if(e.target.closest('.task'))return;swipeX=e.touches[0].clientX;swipeY=e.touches[0].clientY},{passive:true});$('dailyPanel').addEventListener('touchend',e=>{if(e.target.closest('.task'))return;const dx=e.changedTouches[0].clientX-swipeX,dy=e.changedTouches[0].clientY-swipeY;if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.5)chooseDate(dateKey(plusDays(fromKey(selected),dx<0?1:-1)))},{passive:true});
$('taskDate').value=selected;render();
if(client){
  const authPanel=$('authPanel'), authInfo=$('authInfo');
  function authUI(){
    // Hide the whole account/sync section after sign-in.
    authPanel.hidden=!!user;
    $('loginForm').hidden=!!user;
    $('logoutBtn').hidden=true;
    authInfo.textContent=user?'':'Sign in to sync tasks between devices';
  }
  $('loginForm').onsubmit=async e=>{
    e.preventDefault();const email=$('loginEmail').value.trim();if(!email)return;
    authInfo.textContent='Sending sign-in link…';
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
    authInfo.textContent=error?error.message:'Check your email for a sign-in link.';
  };
  $('logoutBtn').onclick=async()=>{await client.auth.signOut();};
  function setUser(next){
    if(next?.id===user?.id)return;
    if(realtimeChannel){client.removeChannel(realtimeChannel);realtimeChannel=null;}
    user=next;
    try{tasks=JSON.parse(localStorage.getItem(user?STORE+'-'+user.id:STORE)||'[]');}catch{tasks=[];}
    authUI();render();
    if(user){subscribeRealtime();sync();}
    else setSyncStatus('');
  }
  client.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
  client.auth.getSession().then(({data})=>setUser(data.session?.user||null));
  // Reconcile after a backgrounded iPhone app returns to the foreground.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)sync();});
  window.addEventListener('online',()=>{if(user)sync();});
  authUI();
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
