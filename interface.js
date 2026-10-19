'use strict';
let activeView='weather',interfaceReady=false;
const mobileLayout=window.matchMedia('(max-width:700px)');
function setQueryExpanded(expanded){$('queryControls').hidden=!expanded;$('compactControls').hidden=expanded;}
function compactQuery(view=activeView){if(view!==activeView)return;const period=activeView==='weather'?$('period').value:activeView==='compare'?$('monthA').value+' / '+$('monthB').value:$('year').value+'년';$('compactLabel').textContent=sourceName()+' · '+period;if(mobileLayout.matches)setQueryExpanded(false);}
function selectView(view){
 activeView=view;for(const button of document.querySelectorAll('[data-view]')){const selected=button.dataset.view===view;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
 for(const [key,pane,form,status,retry]of [['weather','weatherPane','form','status','retryWeather'],['compare','comparison','compareForm','compareStatus','retryCompare'],['year','yearPane','yearForm','yearStatus','retryYear']]){$(pane).hidden=$(form).hidden=$(status).hidden=view!==key;$(retry).hidden=view!==key||$(retry).dataset.error!=='true';}
 $('queryTitle').textContent=view==='weather'?'일별·월별 날씨 조회':view==='compare'?'월별 강수량 비교':'연간 월별 추이';setQueryExpanded(true);if(view==='compare'&&comparison)drawComparison(comparison.a,comparison.b);if(view==='weather')draw();if(view==='year'&&yearly)drawYear();saveSettings();if(interfaceReady&&view==='weather'&&mode==='daily'&&!busy)loadLatestDaily();
}
for(const button of document.querySelectorAll('[data-view]')){button.onclick=()=>selectView(button.dataset.view);button.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const views=['weather','compare','year'],index=views.indexOf(activeView),view=event.key==='Home'?views[0]:event.key==='End'?views[2]:views[(index+(event.key==='ArrowRight'?1:2))%3];selectView(view);document.querySelector('[data-view="'+view+'"]').focus();}};}
$('editQuery').onclick=()=>{setQueryExpanded(true);$('database').focus();};$('database').addEventListener('change',()=>setQueryExpanded(true));
function adjustLayout(){if(!mobileLayout.matches)setQueryExpanded(true);$('detailPanel').open=!mobileLayout.matches;$('coordinateDisclosure').open=false;}
mobileLayout.addEventListener('change',adjustLayout);
const savedBeforeInitialization=readSettings();initializeWeather();selectView(['weather','compare','year'].includes(savedBeforeInitialization.view)?savedBeforeInitialization.view:'weather');adjustLayout();
interfaceReady=true;
if(activeView==='weather'){if(mode==='daily')loadLatestDaily();else load();}else if(activeView==='compare')$('compareStatus').textContent='이전 조건을 복원했습니다. 비교 버튼을 눌러 조회하세요.';else $('yearStatus').textContent='이전 연도를 복원했습니다. 연간 조회 버튼을 눌러 조회하세요.';

for(const id of ['period','monthA','monthB'])$(id).addEventListener('click',()=>{if($(id).disabled)return;try{$(id).showPicker?.();}catch{/* Native typing/selection stays available when the browser has no picker API. */}});
