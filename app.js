/* ميزان النقاط — سجل محلي مستقل، معادلة نقاط تاريخية غير رسمية.
   US Department of Agriculture and Arabic household estimates bundled offline.
*/
(()=>{
'use strict';
const KEY='french-points-diet-v1';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(x,fb=0)=>Number.isFinite(Number(x))?Number(x):fb;
const limit=(x,a,b)=>Math.max(a,Math.min(b,x));
const round1=x=>Math.round((x+Number.EPSILON)*10)/10;
const fmt=x=>round1(x).toLocaleString('ar-SA',{maximumFractionDigits:1});
const today=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const uid=()=>('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
const cleanSearch=x=>String(x??'').toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const foodPoints=(k,f,b)=>Math.max(0,Math.max(0,k)/50+Math.max(0,f)/12-Math.min(Math.max(0,b),4)/5);
function defaults(){return{version:1,theme:'light',budget:24,waterGoal:2000,logs:[],waterLogs:[],activityLogs:[],weights:[],foods:[],draft:null}}
function validState(v){if(!v||typeof v!=='object'||!Array.isArray(v.logs)||!Array.isArray(v.foods)||!Array.isArray(v.waterLogs)||!Array.isArray(v.activityLogs)||!Array.isArray(v.weights))throw Error('نسخة غير صالحة');return{...defaults(),...v,budget:limit(num(v.budget,24),1,150),waterGoal:limit(num(v.waterGoal,2000),250,6000),logs:v.logs.slice(-20000),foods:v.foods.slice(-3000),waterLogs:v.waterLogs.slice(-40000),activityLogs:v.activityLogs.slice(-40000),weights:v.weights.slice(-1500),theme:v.theme==='dark'?'dark':'light'}}
let state=defaults();
try{const txt=localStorage.getItem(KEY);if(txt)state=validState(JSON.parse(txt))}catch(e){console.warn('تعذر قراءة بيانات ميزان النقاط؛ لم تُحذف البيانات السابقة.',e)}
let draft=state.draft||{base:null,extras:[],meal:'غداء',date:today(),title:''};
let view='home',overlayMode='',catalog={query:'',cat:'',src:''},extraQuery='',extraCategory='صوصات وإضافات',historyDate=today(),deferredPrompt=null;
let FOODS=[],INDEX=new Map(),cats=[];
function allFoods(){
 const fromLocal=(window.FP_LOCAL||[]).map(x=>({id:x.id,n:x.n,en:'',cat:x.c,g:x.g,k:x.k,f:x.f,b:x.b,u:x.u,src:'تقدير',portions:[{label:x.u,grams:x.g},{label:'١٠٠ جم',grams:100}]}));
 const fromUsda=(window.FP_USDA||[]).map(x=>({id:x.id,n:x.n,en:x.en,cat:x.c,g:100,k:x.k,f:x.f??0,b:x.b??0,u:'١٠٠ جرام',src:'USDA',missing:x.f==null||x.b==null,portions:[{label:'١٠٠ جم',grams:100},...(x.s||[]).map(p=>({label:p[0],grams:p[1]}))]}));
 const fromUser=state.foods.map(x=>({id:x.id,n:x.n,en:'',cat:x.c,g:x.g,k:x.k,f:x.f,b:x.b,u:x.u,src:'شخصي',portions:[{label:x.u,grams:x.g},{label:'١٠٠ جم',grams:100}]}));
 FOODS=[...fromLocal,...fromUser,...fromUsda].filter(x=>Number.isFinite(x.k)&&Number.isFinite(x.g)&&x.g>0);
 INDEX=new Map(FOODS.map(x=>[x.id,x]));cats=[...new Set(FOODS.map(x=>x.cat))].sort((a,b)=>a.localeCompare(b,'ar'));
}
const getFood=id=>INDEX.get(id);
function save(){try{state.draft=draft;localStorage.setItem(KEY,JSON.stringify(state));return true}catch(e){toast('تعذر حفظ البيانات. تحقق من مساحة التخزين وأنشئ نسخة احتياطية.');return false}}
function flashError(msg){toast(msg);return false}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600)}
function theme(){document.body.classList.toggle('dark',state.theme==='dark');$('themeToggle').textContent=state.theme==='dark'?'☀':'☾'}
function dateText(d){return new Date(d+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long'})}
function totalsForDay(date){const logs=state.logs.filter(x=>x.date===date),water=state.waterLogs.filter(x=>x.date===date).reduce((a,b)=>a+num(b.ml),0),activity=state.activityLogs.filter(x=>x.date===date).reduce((a,b)=>a+num(b.mins),0);return{logs,points:logs.reduce((a,b)=>a+num(b.points),0),kcal:logs.reduce((a,b)=>a+num(b.kcal),0),water,activity}}
function latestWeight(){const arr=state.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));return arr.length?arr[arr.length-1].kg:null}
function weekData(end=today()){const [y,m,d]=end.split('-').map(Number);return Array.from({length:7},(_,i)=>{let x=new Date(y,m-1,d-6+i);let dt=today(x),t=totalsForDay(dt);return{date:dt,short:x.toLocaleDateString('ar-SA',{weekday:'short'}),v:t.points}})}
function weekHTML(end){const items=weekData(end),max=Math.max(state.budget,...items.map(x=>x.v),1);return items.map(x=>'<div class="week-col"><b>'+fmt(x.v)+'</b><span class="bar" style="height:'+Math.max(2,Math.round(x.v/max*94))+'px"></span><small title="'+x.date+'">'+esc(x.short)+'</small></div>').join('')}
function detailHTML(log,allowRemove){let d=(log.parts||[]).map(p=>p.n+' × '+fmt(p.qty)+' ('+fmt(p.g*p.qty)+' جم)').join('، ');return '<article class="log-card"><div class="log-title"><div><h3>'+esc(log.title||'وجبة')+'</h3><div class="micro">'+esc(log.meal||'وجبة')+' • '+esc(log.time||'')+'</div></div><strong>'+fmt(log.points)+' <small style="font-size:11px">نقطة</small></strong></div><p class="log-details">'+esc(d||log.note||'إدخال يدوي')+'</p><div class="log-actions"><span class="micro">'+fmt(log.kcal)+' سعرة تقريبية</span>'+(allowRemove?'<button class="text-btn" data-action="remove-log" data-id="'+esc(log.id)+'">حذف</button>':'')+'</div></article>'}
function renderHome(){
 const t=totalsForDay(today()),remain=state.budget-t.points,pct=limit(Math.round(t.points/state.budget*100),0,100);
 $('todayLabel').textContent=dateText(today());$('pointsRemain').textContent=fmt(remain);$('pointsUsed').textContent='المستهلك: '+fmt(t.points)+' نقطة';$('pointsBudget').textContent='الميزانية: '+fmt(state.budget);$('pointsBar').style.width=pct+'%';$('todayRing').style.setProperty('--pct',pct+'%');$('ringText').textContent=pct+'%';
 $('waterToday').textContent=fmt(t.water);$('waterGoalText').textContent='الهدف '+fmt(state.waterGoal)+' مل';$('waterBar').style.width=limit(Math.round(t.water/state.waterGoal*100),0,100)+'%';
 $('activityToday').textContent=fmt(t.activity);$('weightDisplay').textContent=latestWeight()===null?'—':fmt(latestWeight());
 $('homeLogs').innerHTML=t.logs.length?t.logs.slice().reverse().slice(0,8).map(x=>detailHTML(x,true)).join(''):'<div class="empty">لم تُسجّل وجبات اليوم بعد. اختر أول وجبة من دليل الأطعمة.</div>';
 $('weekBars').innerHTML=weekHTML(today())
}
function showView(id){
 if(!['home','foods','compose','log','settings'].includes(id))id='home';
 view=id;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+id));
 document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
 if(id==='home')renderHome();if(id==='foods')renderFoodPage();if(id==='compose')renderBuilder();if(id==='log')renderHistory();if(id==='settings')renderSettings();
 window.scrollTo({top:0,behavior:'smooth'})
}
function renderFoodPage(){
 $('foodSearch').value=catalog.query;$('foodSource').value=catalog.src;
 $('foodCategory').innerHTML='<option value="">جميع الأصناف</option>'+cats.map(cat=>'<option value="'+esc(cat)+'">'+esc(cat)+'</option>').join('');
 $('foodCategory').value=catalog.cat;renderFoodResults()
}
function renderFoodResults(){
 const q=cleanSearch(catalog.query);
 const tokens=q?q.split(' '):[];
 const result=FOODS.filter(x=>(!catalog.cat||x.cat===catalog.cat)&&(!catalog.src||x.src===catalog.src)&&tokens.every(t=>cleanSearch(x.n+' '+x.en+' '+x.cat+' '+x.u).includes(t)));
 $('foodCount').textContent=result.length+' صنفًا مطابقًا من '+FOODS.length;
 const list=result.slice(0,70);
 $('foodResults').innerHTML=list.map(x=>foodCard(x)).join('')||'<div class="empty">لا توجد نتيجة. يمكنك إضافة هذا الصنف يدويًا من أعلى الصفحة.</div>';
 $('resultsMore').textContent=result.length>70?'عُرض أول ٧٠ صنفًا؛ اكتب كلمات أكثر لتضييق البحث.':'';
}
function foodCard(f){
 const pts=round1(foodPoints(f.k,f.f,f.b));
 return '<article class="food-card"><div><div class="food-name">'+esc(f.n)+'</div><div class="food-meta">'+esc(f.cat)+' • '+esc(f.u)+' ('+fmt(f.g)+' جم) • '+fmt(f.k)+' سعرة'+(f.src==='تقدير'?' • تقديري':'')+(f.src==='USDA'?' • USDA':'')+'</div>'+(f.en&&f.en!==f.n?'<div class="micro" dir="ltr" style="text-align:right">'+esc(f.en)+'</div>':'')+'</div><div class="food-actions"><div class="food-points">'+fmt(pts)+'<small>نقطة</small></div><button class="add-circle" data-action="choose-food" data-id="'+esc(f.id)+'" aria-label="اختيار '+esc(f.n)+'">＋</button></div></article>';
}
function chooseFood(id){
 const food=getFood(id);if(!food)return flashError('الصنف غير موجود');
 draft={base:{id:food.id,g:food.g,qty:1},extras:[],meal:'غداء',date:today(),title:food.n};
 save();showView('compose')
}
function portionSelect(food,role,index){
 const options=(food.portions||[]).filter(p=>p.grams>0).slice(0,11);
 let label='<option value="">اختر حصة مقترحة (اختياري)</option>';
 label+=options.map(p=>'<option value="'+p.grams+'">'+esc(p.label)+' — '+fmt(p.grams)+' جم</option>').join('');
 return '<select data-portion-role="'+role+'" data-index="'+(index??'')+'">'+label+'</select>';
}
function component(i){const food=getFood(i.id);if(!food)return null;const fact=i.g*i.qty/food.g;return {name:food.n,g:i.g,qty:i.qty,k:food.k*fact,f:food.f*fact,b:food.b*fact,src:food.src}}
function evaluate(){const all=[draft.base,...draft.extras].filter(Boolean).map(component).filter(Boolean);const k=all.reduce((a,x)=>a+x.k,0),f=all.reduce((a,x)=>a+x.f,0),b=all.reduce((a,x)=>a+x.b,0);return {parts:all,k,f,b,points:foodPoints(k,f,b)}}
function renderBuilder(){
 const target=$('builder');
 if(!draft.base||!getFood(draft.base.id)){target.innerHTML='<div class="empty">ابدأ باختيار وجبة من دليل الأطعمة، ثم أضف مكوناتها والصوصات إن رغبت.</div><button class="btn btn-primary full" data-go="foods">فتح دليل الأطعمة</button>';return}
 const main=getFood(draft.base.id);
 target.innerHTML='<div class="builder-header"><div><h2>🍽️ '+esc(main.n)+'</h2><p class="micro">'+esc(main.cat)+' • '+esc(main.src==='USDA'?'مرجع USDA':'القيم تقديرية')+'</p></div><button class="btn btn-outline" data-go="foods">تغيير</button></div>'+
 '<div class="builder-row"><div class="two-fields"><div><label for="baseQty">عدد الحصص أو الحبات</label><input id="baseQty" type="number" min=".05" max="100" step=".25" value="'+draft.base.qty+'"></div><div><label for="baseGrams">وزن الحصة (جرام)</label><input id="baseGrams" type="number" min=".1" max="10000" step="any" value="'+draft.base.g+'"></div></div><label>وحدات منزلية مقترحة</label>'+portionSelect(main,'base')+'<p class="micro">مثال: ١ حبة سنيكرز تزن ٤٥ جم = أدخل ٤٥، أو ٢٠ جم من البسكويت = أدخل ٢٠. ويمكن استخدام نصف حصة.</p></div>'+
 '<div class="section-title"><h2>الصوصات والإضافات</h2><button class="text-btn" data-action="extra-picker">＋ أضف أي شيء</button></div><p class="micro">يمكن إضافة الجبن والمايونيز والزيت والحليب والبطاطس وحتى مشروب مع الوجبة؛ تُحتسب جميعها مرة واحدة.</p>'+
 '<div class="addons">'+draft.extras.map((e,i)=>addonHTML(e,i)).join('')+'</div>'+
 '<button class="btn btn-outline full" data-action="extra-picker">＋ صوص أو إضافة أخرى</button>'+
 '<div class="build-summary"><div class="row between center"><div><small>إجمالي الوجبة مع الإضافات</small><div class="total"><span id="draftPoints">—</span> نقطة</div></div><div><small id="draftKcal">— سعرة</small><small id="draftFat">— جم دهون</small></div></div></div>'+
 '<div class="hint" style="margin-top:10px">قد تكون بعض الصوصات داخل حساب الوجبة الأصلية بالفعل؛ لا تضفها مرة ثانية إلا إذا كانت كمية إضافية فعلًا.</div>'+
 '<div class="two-fields"><div><label for="mealType">نوع الوجبة</label><select id="mealType"><option>فطور</option><option>غداء</option><option>عشاء</option><option>سناك</option><option>مشروب</option></select></div><div><label for="mealDate">التاريخ</label><input id="mealDate" type="date" value="'+esc(draft.date||today())+'"></div></div>'+
 '<label for="mealName">اسم الوجبة في السجل</label><input id="mealName" maxlength="110" value="'+esc(draft.title||main.n)+'">'+
 '<button class="btn btn-primary full" data-action="save-meal">✓ سجل الوجبة بنقاطها</button>';
 $('mealType').value=draft.meal||'غداء';
 updateBuilderEstimate()
}
function addonHTML(e,i){const food=getFood(e.id);if(!food)return'';return '<div class="addon"><div class="row between center"><strong>'+esc(food.n)+'</strong><button class="text-btn" data-action="remove-extra" data-index="'+i+'">حذف</button></div><div class="addon-grid"><div><label>العدد</label><input data-extra-qty="'+i+'" type="number" min=".05" max="100" step=".25" value="'+e.qty+'"></div><div><label>وزن الحصة جم</label><input data-extra-grams="'+i+'" type="number" min=".1" max="10000" step="any" value="'+e.g+'"></div></div><label class="micro">حصة منزلية مقترحة</label>'+portionSelect(food,'extra',i)+'</div>'}
function updateBuilderEstimate(){if(!$('draftPoints'))return;const t=evaluate();$('draftPoints').textContent=fmt(t.points);$('draftKcal').textContent=fmt(t.k)+' سعرة';$('draftFat').textContent=fmt(t.f)+' جم دهون'}
function chooseExtra(id){const f=getFood(id);if(!f)return;draft.extras.push({id:f.id,g:f.g,qty:1});save();closeOverlay();renderBuilder();toast('أُضيف '+f.n+' إلى الوجبة')}
function saveMeal(){
 if(!draft.base||!getFood(draft.base.id))return flashError('اختر الطعام أولًا');
 const t=evaluate();if(!Number.isFinite(t.points)||!Number.isFinite(t.k)||t.k<0)return flashError('تعذر حساب الوجبة');
 const date=$('mealDate')?.value||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return flashError('تاريخ غير صالح');
 const title=($('mealName')?.value||getFood(draft.base.id).n).trim().slice(0,110);if(!title)return flashError('اسم الوجبة مطلوب');
 const meal=$('mealType').value;
 const record={id:uid(),date,time:new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}),title,meal,points:round1(t.points),kcal:round1(t.k),fat:round1(t.f),fiber:round1(t.b),parts:t.parts};
 state.logs.push(record);draft={base:null,extras:[],meal:'غداء',date:today(),title:''};if(!save())return;
 toast('أُضيفت الوجبة: '+fmt(record.points)+' نقطة');showView('home')
}
function openOverlay(content,mode='general'){overlayMode=mode;$('overlayBody').innerHTML=content;$('overlay').classList.remove('hidden');document.body.style.overflow='hidden'}
function closeOverlay(){$('overlay').classList.add('hidden');$('overlayBody').innerHTML='';document.body.style.overflow='';overlayMode=''}
function showExtraPicker(){
 if(!draft.base)return flashError('اختر وجبة أولًا');
 extraQuery='';extraCategory='صوصات وإضافات';
 openOverlay('<div class="drawer-title"><div><h2>أضف صوصًا أو مكوّنًا</h2><p class="micro">اختر أي صنف؛ عدّل الكمية والجرام في الوجبة لاحقًا.</p></div><button class="drawer-close" data-action="overlay-close">×</button></div><label for="extraSearch">بحث الإضافات</label><input id="extraSearch" type="search" placeholder="ثومية، شيدر، كاتشب، بطاطس، حليب"><div class="two-fields"><div><label for="extraCat">التصنيف</label><select id="extraCat"><option value="صوصات وإضافات">صوصات وإضافات</option><option value="">كل الأطعمة</option></select></div><div><label>إضافة جديدة</label><button class="btn btn-outline full" data-action="custom-form">＋ صوص خاص</button></div></div><div class="drawer-results" id="extraResults"></div>','extras');renderExtrasResults()
}
function renderExtrasResults(){
 const target=$('extraResults');if(!target)return;
 const tokens=cleanSearch(extraQuery).split(' ').filter(Boolean);
 const found=FOODS.filter(x=>(!extraCategory||x.cat===extraCategory)&&tokens.every(t=>cleanSearch(x.n+' '+x.en+' '+x.cat).includes(t))).slice(0,80);
 target.innerHTML=found.map(x=>'<button class="drawer-result" data-action="add-extra" data-id="'+esc(x.id)+'"><div><b>'+esc(x.n)+'</b><small>'+esc(x.u)+' • '+fmt(x.g)+' جم • '+fmt(x.k)+' سعرة</small></div><span>＋ '+fmt(foodPoints(x.k,x.f,x.b))+' نقطة</span></button>').join('')||'<div class="empty">لا توجد نتيجة. استخدم إضافة جديدة لإنشاء هذا الصوص.</div>'
}
function showCustomForm(editId='',prefill={}){
 const old=state.foods.find(x=>x.id===editId)||prefill;
 const modal='<div class="drawer-title"><div><h2>'+ (editId?'تعديل الصنف':'إضافة صنف أو صوص')+'</h2><p class="micro">الأرقام تخص كمية الحصة المكتوبة، وليس ١٠٠ جم بالضرورة.</p></div><button class="drawer-close" data-action="overlay-close">×</button></div><form id="customFoodForm">'+
 '<label for="custName">الاسم</label><input id="custName" maxlength="100" required placeholder="مثال: صوص خاص / بسكويت من العبوة" value="'+esc(old.n||'')+'">'+
 '<div class="two-fields"><div><label for="custCat">التصنيف</label><select id="custCat"><option>أطعمة خاصة</option><option>صوصات وإضافات</option><option>ساندويتش وبرجر</option><option>شوكولاتة وبسكويت ومقرمشات</option><option>مطاعم ووجبات سريعة</option><option>المشروبات والقهوة</option></select></div><div><label for="custUnit">اسم الحصة</label><input id="custUnit" maxlength="35" value="'+esc(old.u||'حبة')+'" required></div></div>'+
 '<div class="two-fields"><div><label for="custGrams">وزن الحصة جم</label><input id="custGrams" type="number" min=".1" max="10000" step="any" value="'+esc(old.g||100)+'" required></div><div><label for="custKcal">السعرات للحصة</label><input id="custKcal" type="number" min="0" max="99999" step="any" value="'+esc(old.k??'')+'" required></div></div>'+
 '<div class="two-fields"><div><label for="custFat">الدهون جم</label><input id="custFat" type="number" min="0" max="10000" step="any" value="'+esc(old.f??0)+'" required></div><div><label for="custFiber">الألياف جم</label><input id="custFiber" type="number" min="0" max="10000" step="any" value="'+esc(old.b??0)+'" required></div></div>'+
 '<p class="hint">إذا كانت العبوة تذكر السعرات فقط، اجعل الدهون والألياف صفرًا كتقدير مبدئي، ثم عدّلها عند معرفة البيانات الصحيحة.</p>'+
 '<button class="btn btn-primary full" type="submit">حفظ الصنف</button></form>';
 openOverlay(modal,'custom');
 $('customFoodForm').dataset.edit=editId;
 $('custCat').value=old.c&&['صوصات وإضافات','ساندويتش وبرجر','شوكولاتة وبسكويت ومقرمشات','مطاعم ووجبات سريعة','المشروبات والقهوة'].includes(old.c)?old.c:'أطعمة خاصة'
}
function saveCustomFood(){
 const edit=$('customFoodForm').dataset.edit;
 const n=$('custName').value.trim(),c=$('custCat').value,u=$('custUnit').value.trim();
 const g=Number($('custGrams').value),k=Number($('custKcal').value),f=Number($('custFat').value),b=Number($('custFiber').value);
 if(!n||!u||!Number.isFinite(g)||g<=0||g>10000||![k,f,b].every(Number.isFinite)||[k,f,b].some(v=>v<0)||k>99999)return flashError('راجع الاسم والحصة والسعرات والدهون والألياف');
 const record={id:edit||uid(),n,c,u,g,k,f,b};
 if(edit){const ix=state.foods.findIndex(x=>x.id===edit);if(ix<0)return flashError('تعذر العثور على الصنف');state.foods[ix]=record}else state.foods.push(record);
 allFoods();if(!save())return;closeOverlay();renderSettings();if(view==='foods')renderFoodPage();if(view==='compose')renderBuilder();toast('حُفظ الصنف ويمكن استخدامه في أي وجبة')
}
function renderHistory(){
 $('historyDate').value=historyDate;const t=totalsForDay(historyDate);
 $('historyPoints').textContent=fmt(t.points);$('historyKcal').textContent=fmt(t.kcal);$('historyMeals').textContent=t.logs.length;
 $('historyLogs').innerHTML=t.logs.length?t.logs.slice().reverse().map(x=>detailHTML(x,true)).join(''):'<div class="empty">لا توجد وجبات مسجلة في هذا اليوم.</div>';
 $('historyWeek').innerHTML=weekHTML(historyDate)
}
function renderSettings(){
 $('dailyBudget').value=state.budget;$('waterGoal').value=state.waterGoal;
 $('customList').innerHTML=state.foods.length?state.foods.slice().reverse().map(x=>'<div class="custom-item"><div><b>'+esc(x.n)+'</b><small>'+fmt(x.k)+' سعرة / '+fmt(x.g)+' جم • '+esc(x.c)+'</small></div><div><button data-action="edit-custom" data-id="'+esc(x.id)+'">تعديل</button><button data-action="delete-custom" data-id="'+esc(x.id)+'">حذف</button></div></div>').join(''):'<p class="micro">لم تضف صنفًا خاصًا بعد.</p>';
 updateConverter()
}
function updateConverter(){
 const k=Number($('convK').value),f=Number($('convF').value||0),b=Number($('convB').value||0);
 const valid=$('convK').value!==''&&Number.isFinite(k)&&k>=0&&[f,b].every(v=>Number.isFinite(v)&&v>=0);
 $('convertResult').textContent=valid?fmt(foodPoints(k,f,b)):'—';
 $('convHint').textContent=!valid?'أدخل السعرات':$('convF').value===''||$('convB').value===''?'تقدير ناقص: الدهون أو الألياف غير مدخلة':'بالحساب التاريخي'
}
function saveConverter(){
 const k=Number($('convK').value),f=Number($('convF').value||0),b=Number($('convB').value||0),g=Number($('convGrams').value),n=$('convName').value.trim()||'صنف من حاسبة السعرات';
 if($('convK').value===''||![k,f,b,g].every(Number.isFinite)||k<0||f<0||b<0||g<=0)return flashError('أدخل قيمًا غذائية ووزنًا صحيحًا');
 state.foods.push({id:uid(),n,c:'أطعمة خاصة',u:'حصة',g,k,f,b});allFoods();if(!save())return;renderSettings();toast('تم حفظ الصنف في مكتبتك الخاصة')
}
function addWater(ml){state.waterLogs.push({id:uid(),date:today(),ml});if(save()){renderHome();toast('أُضيف '+ml+' مل ماء')}}
function showActivity(){
 openOverlay('<div class="drawer-title"><h2>تسجيل الحركة</h2><button class="drawer-close" data-action="overlay-close">×</button></div><form id="activityForm"><label for="activityName">النشاط</label><select id="activityName"><option>مشي</option><option>دراجة ثابتة</option><option>تمارين مقاومة</option><option>سباحة</option><option>نشاط آخر</option></select><label for="activityMinutes">المدة بالدقائق</label><input id="activityMinutes" type="number" min="1" max="500" step="1" value="20" required><button type="submit" class="btn btn-primary full">حفظ النشاط</button><p class="micro">الرياضة لا تُضيف نقاطًا إلى الميزانية بشكل تلقائي.</p></form>','activity')
}
function showWeight(){
 openOverlay('<div class="drawer-title"><h2>تسجيل الوزن</h2><button class="drawer-close" data-action="overlay-close">×</button></div><form id="weightForm"><label for="weightDate">التاريخ</label><input id="weightDate" type="date" value="'+today()+'" required><label for="weightKg">الوزن كجم</label><input id="weightKg" type="number" min="20" max="400" step=".1" value="'+(latestWeight()||'')+'" required><button class="btn btn-primary full" type="submit">حفظ الوزن</button></form>','weight')
}
function removeLog(id){
 const item=state.logs.find(x=>x.id===id);if(!item)return;
 if(!confirm('حذف وجبة "'+item.title+'" من السجل؟'))return;
 state.logs=state.logs.filter(x=>x.id!==id);if(save()){renderHome();renderHistory();toast('حُذفت الوجبة')}
}
function exportBackup(){
 const data={app:'french-points-diet',version:1,exportedAt:new Date().toISOString(),state:{...state,draft}};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='french-points-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);toast('تم إنشاء ملف النسخة الاحتياطية')
}
async function importBackup(file){
 if(!file)return;if(file.size>8_000_000)return flashError('ملف النسخة أكبر من ٨ ميجابايت');
 try{
  const parsed=JSON.parse(await file.text());if(parsed.app!=='french-points-diet'||!parsed.state)throw Error('Wrong backup format');
  const next=validState(parsed.state);
  if(!confirm('استيراد النسخة سيستبدل سجلات هذا الجهاز كلها. هل حفظت نسخة من بياناتك الحالية؟'))return;
  const prev=state,prevDraft=draft;state=next;draft=next.draft||{base:null,extras:[],meal:'غداء',date:today(),title:''};
  allFoods();if(!save()){state=prev;draft=prevDraft;allFoods();return}
  theme();showView('home');toast('استُعيدت النسخة الاحتياطية')
 }catch(e){toast('ملف الاستيراد غير صالح أو تالف')}
}
function bind(){
 document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action],[data-go],[data-water]');if(!el)return;
  if(el.dataset.go){showView(el.dataset.go);return}
  if(el.dataset.water){addWater(Number(el.dataset.water));return}
  const act=el.dataset.action,id=el.dataset.id;
  if(act==='choose-food')chooseFood(id);
  else if(act==='extra-picker')showExtraPicker();
  else if(act==='add-extra')chooseExtra(id);
  else if(act==='remove-extra'){draft.extras.splice(Number(el.dataset.index),1);save();renderBuilder()}
  else if(act==='save-meal')saveMeal();
  else if(act==='overlay-close')closeOverlay();
  else if(act==='custom-form')showCustomForm();
  else if(act==='edit-custom')showCustomForm(id);
  else if(act==='delete-custom'){if(confirm('حذف الصنف الخاص من القائمة؟ السجلات السابقة محفوظة.')){state.foods=state.foods.filter(x=>x.id!==id);allFoods();save();renderSettings();if(view==='foods')renderFoodResults()}}
  else if(act==='remove-log')removeLog(id);
  else if(act==='activity')showActivity();
  else if(act==='weight')showWeight();
  else if(act==='export')exportBackup();
  else if(act==='converter-save')saveConverter()
 });
 document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='foodSearch'){catalog.query=el.value;renderFoodResults()}
  else if(el.id==='extraSearch'){extraQuery=el.value;renderExtrasResults()}
  else if(['convK','convF','convB'].includes(el.id))updateConverter();
  else if(el.id==='baseQty'||el.id==='baseGrams'){
   const v=Number(el.value);if(Number.isFinite(v)&&v>0){if(el.id==='baseQty')draft.base.qty=limit(v,.05,100);else draft.base.g=limit(v,.1,10000);save();updateBuilderEstimate()}
  }else if(el.matches('[data-extra-qty],[data-extra-grams]')){
    const ix=Number(el.dataset.extraQty??el.dataset.extraGrams);
    if(!draft.extras[ix])return;
    const v=Number(el.value);if(Number.isFinite(v)&&v>0){if(el.hasAttribute('data-extra-qty'))draft.extras[ix].qty=limit(v,.05,100);else draft.extras[ix].g=limit(v,.1,10000);save();updateBuilderEstimate()}
  }
 });
 document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='foodCategory'){catalog.cat=el.value;renderFoodResults()}
  else if(el.id==='foodSource'){catalog.src=el.value;renderFoodResults()}
  else if(el.id==='extraCat'){extraCategory=el.value;renderExtrasResults()}
  else if(el.id==='historyDate'){historyDate=el.value;renderHistory()}
  else if(el.matches('[data-portion-role]')){
   const grams=Number(el.value);if(!grams||grams<=0)return;
   if(el.dataset.portionRole==='base'&&draft.base){draft.base.g=grams;$('baseGrams').value=grams}
   else if(el.dataset.portionRole==='extra'&&draft.extras[Number(el.dataset.index)]){const i=Number(el.dataset.index);draft.extras[i].g=grams;const input=document.querySelector('[data-extra-grams="'+i+'"]');if(input)input.value=grams}
   save();updateBuilderEstimate()
  }else if(el.id==='mealType'){draft.meal=el.value;save()}
  else if(el.id==='mealName'){draft.title=el.value;save()}
  else if(el.id==='mealDate'){draft.date=el.value;save()}
  else if(el.id==='importFile'){importBackup(el.files[0]);el.value=''}
 });
 document.addEventListener('submit',e=>{
  if(!['goalsForm','customFoodForm','activityForm','weightForm'].includes(e.target.id))return;
  e.preventDefault();
  if(e.target.id==='goalsForm'){
   const b=Number($('dailyBudget').value),w=Number($('waterGoal').value);
   if(!Number.isFinite(b)||b<1||b>150||!Number.isFinite(w)||w<250||w>6000)return flashError('راجع أهدافك');
   state.budget=b;state.waterGoal=w;if(save()){renderHome();toast('تم حفظ الأهداف')}
  }else if(e.target.id==='customFoodForm')saveCustomFood();
  else if(e.target.id==='activityForm'){
   const mins=Number($('activityMinutes').value);if(!Number.isInteger(mins)||mins<1||mins>500)return flashError('مدة النشاط غير صالحة');
   state.activityLogs.push({id:uid(),date:today(),name:$('activityName').value,mins});if(save()){closeOverlay();renderHome();toast('تم تسجيل الحركة')}
  }else if(e.target.id==='weightForm'){
   const date=$('weightDate').value,kg=Number($('weightKg').value);
   if(!Number.isFinite(kg)||kg<20||kg>400||!/^\d{4}-\d{2}-\d{2}$/.test(date))return flashError('وزن أو تاريخ غير صالح');
   state.weights=state.weights.filter(x=>x.date!==date);state.weights.push({date,kg});if(save()){closeOverlay();renderHome();toast('حُفظ قياس الوزن')}
  }
 });
 $('themeToggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';save();theme()});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
 $('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')})
}
function init(){
 allFoods();bind();theme();showView('home');
 if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
init();
})();