(()=>{
"use strict";
const DB="u15_scout_video_db", STORE="videos";
let db, stream, recorder, chunks=[], objectUrl="", current=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const makeId=()=>"v"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")};
function req(r){return new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:"id"});q.onsuccess=()=>{db=q.result;ok()};q.onerror=()=>no(q.error)})}
const all=()=>req(db.transaction(STORE).objectStore(STORE).getAll());
const put=v=>req(db.transaction(STORE,"readwrite").objectStore(STORE).put(v));
const get=k=>req(db.transaction(STORE).objectStore(STORE).get(k));
const del=k=>req(db.transaction(STORE,"readwrite").objectStore(STORE).delete(k));
function build(){
 const tabs=document.querySelector(".tabs"), camera=$("camera");
 if(!tabs||!camera||$("videoAnalysis"))return;
 const b=document.createElement("button");b.type="button";b.dataset.tab="videoAnalysis";b.textContent="試合動画分析";tabs.appendChild(b);
 const s=document.createElement("section");s.id="videoAnalysis";s.className="panel";
 s.innerHTML='<div style="padding:12px"><h2>試合動画分析（端末内保存）</h2><p>動画はこの端末のブラウザ内に保存します。外部サーバーへの送信はありません。</p><div style="display:grid;gap:8px"><label>試合日 <input id="vaDate" type="date"></label><label>対戦相手 <input id="vaOpponent" placeholder="対戦相手"></label><label>背番号（任意） <input id="vaJersey" placeholder="例：7"></label><div><button id="vaStart" type="button">● 撮影開始</button> <button id="vaStop" type="button" disabled>撮影停止・保存</button></div><label>撮影済み動画を読み込む <input id="vaFiles" type="file" accept="video/*" multiple></label><label>保存動画 <select id="vaList"><option value="">動画を選択</option></select></label><video id="vaPlayer" controls playsinline style="width:100%;max-height:360px;background:#111"></video><div id="vaInfo"></div><hr><h3>プレー記録</h3><label>プレー <select id="vaType"><option>シュート</option><option>リバウンド</option><option>パス</option><option>ターンオーバー</option><option>速攻</option><option>ヘルプディフェンス</option><option>ローテーション</option><option>ボックスアウト</option><option>その他</option></select></label><label>評価 <select id="vaGrade"><option>保留</option><option>良いプレー</option><option>改善が必要</option><option>確認待ち</option></select></label><label>コーチメモ <textarea id="vaNote" rows="2" placeholder="具体的な内容"></textarea></label><button id="vaAdd" type="button">現在の再生時間に記録</button> <button id="vaExport" type="button">記録をJSON出力</button> <button id="vaDelete" type="button">選択動画を削除</button><h3>記録一覧</h3><div id="vaEvents">動画を選択してください。</div><p style="font-size:12px;color:#a33">注意：ブラウザのデータ消去・端末故障などで保存動画が失われる場合があります。元動画も別途保管してください。大容量動画は端末の空き容量を使います。</p></div></div>';
 camera.insertAdjacentElement("afterend",s);
 b.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x===s));});
}
async function refresh(){const list=await all();$("vaList").innerHTML='<option value="">動画を選択</option>'+list.sort((a,b)=>b.created-a.created).map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+' ('+fmt(v.duration||0)+')</option>').join("")}
async function selectVideo(k){current=await get(k);if(!current)return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(current.blob);$("vaPlayer").src=objectUrl;$("vaInfo").textContent=(current.date||"")+"　"+(current.opponent||"")+"　"+current.name;renderEvents()}
function renderEvents(){if(!current)return;const a=current.events||[];$("vaEvents").innerHTML=a.length?a.map((e,i)=>'<div style="border:1px solid #bbb;border-radius:8px;padding:8px;margin:6px 0"><b>'+fmt(e.time)+'｜'+esc(e.type)+'｜'+esc(e.grade)+'</b><div>背番号：'+esc(e.jersey||"-")+'　'+esc(e.note||"")+'</div><button type="button" data-seek="'+i+'">この場面へ</button> <button type="button" data-remove="'+i+'">削除</button></div>').join(""):"記録はまだありません。";$("vaEvents").querySelectorAll("[data-seek]").forEach(x=>x.onclick=()=>{$("vaPlayer").currentTime=a[+x.dataset.seek].time;$("vaPlayer").play()});$("vaEvents").querySelectorAll("[data-remove]").forEach(x=>x.onclick=async()=>{current.events.splice(+x.dataset.remove,1);await put(current);renderEvents()})}
async function addBlob(blob,name){if(!blob||!blob.size)return;const v={id:makeId(),name:name,date:$("vaDate").value,opponent:$("vaOpponent").value.trim(),created:Date.now(),duration:0,blob:blob,events:[]};await put(v);await refresh();$("vaList").value=v.id;await selectVideo(v.id)}
async function start(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:true});$("vaPlayer").srcObject=stream;chunks=[];const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{const blob=new Blob(chunks,{type:recorder.mimeType||"video/webm"});stream.getTracks().forEach(t=>t.stop());stream=null;$("vaPlayer").srcObject=null;await addBlob(blob,"撮影_"+new Date().toLocaleString("ja-JP").replace(/[/:]/g,"-")+".webm");$("vaStart").disabled=false;$("vaStop").disabled=true};recorder.start();$("vaStart").disabled=true;$("vaStop").disabled=false}catch(e){alert("カメラを起動できません。Chromeのカメラ権限とHTTPS接続を確認してください。"+e.message)}}
async function init(){build();if(!$("videoAnalysis"))return;try{await openDB();await refresh()}catch(e){$("vaInfo").textContent="端末内保存を利用できません: "+e.message;return}
 $("vaStart").onclick=start;$("vaStop").onclick=()=>{if(recorder&&recorder.state!=="inactive")recorder.stop()};
 $("vaFiles").onchange=async e=>{for(const f of e.target.files)await addBlob(f,f.name);e.target.value=""};
 $("vaList").onchange=e=>e.target.value?selectVideo(e.target.value):null;
 $("vaAdd").onclick=async()=>{if(!current)return alert("先に動画を選択してください");current.events=current.events||[];current.events.push({time:$("vaPlayer").currentTime||0,type:$("vaType").value,grade:$("vaGrade").value,jersey:$("vaJersey").value.trim(),note:$("vaNote").value.trim()});await put(current);$("vaNote").value="";renderEvents()};
 $("vaExport").onclick=()=>{if(!current)return alert("動画を選択してください");const data={name:current.name,date:current.date,opponent:current.opponent,events:current.events||[]};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=u;a.download="U15_video_events_"+current.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 $("vaDelete").onclick=async()=>{if(!current||!confirm("選択した動画と記録を削除しますか？"))return;await del(current.id);current=null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl="";$("vaPlayer").removeAttribute("src");$("vaPlayer").load();$("vaEvents").textContent="動画を選択してください。";$("vaInfo").textContent="";await refresh()};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();