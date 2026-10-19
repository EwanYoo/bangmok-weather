'use strict';
let provider='era5';
const REQUEST_COORDINATES={latitude:35.3249,longitude:127.9225},STATION_COORDINATES={latitude:35.4130,longitude:127.8791};
const SETTINGS_KEY='seokdae-weather-settings-v2',CACHE_KEY='seokdae-weather-cache-v3';
const CAFE_MAP_URL='https://map.kakao.com/link/map/%EB%B0%A9%EB%AA%A9%EB%A6%AC%EC%B9%B4%ED%8E%98,35.3249,127.9225';
function cafeMapLink(){return `<a class="place-link" href="${CAFE_MAP_URL}" target="_blank" rel="noopener noreferrer" aria-label="방목리카페 지도 보기 (새 창)">방목리카페</a>`;}
let memoryCache=new Map();
function readSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{};}catch{return {};}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({provider,mode,period:$('period').value,monthA:$('monthA').value,monthB:$('monthB').value,sameDays:$('sameDays').checked,year:$('year').value,view:typeof activeView==='undefined'?'weather':activeView}));}catch{}}
function sourceName(){return provider==='kma'?'기상청 산청 ASOS 289 관측':'Open-Meteo ECMWF ERA5 재분석';}
function sourceCSV(){return sourceName()+' · 시간자료 집계';}
function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function nextWeatherDay(day){return new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
function shiftWeatherHour(time,hours){return new Date(Date.parse(time+'+09:00')+hours*3600000+9*3600000).toISOString().slice(0,16);}
function todayKST(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
function providerLatest(){return new Date(Date.parse(todayKST())-(provider==='kma'?1:7)*86400000).toISOString().slice(0,10);}
function sourceDescription(){return provider==='kma'?'관측소 실측값 · 전일까지 조회. 겨울철 강수는 3시간 누적 기록이며 제공 지연이 있을 수 있습니다.':'방목리카페 주변 격자의 재분석값 · 7일 전까지 조회. 현장 실측값과 다를 수 있습니다.';}
function isWorking(){return busy||comparing||(typeof yearBusy!=='undefined'&&yearBusy);}
function lockDatabase(){ $('database').disabled=isWorking(); }
function refreshProvider(){
 latest=providerLatest();const min=provider==='kma'?'1972-03-30':'1940-01-01';
 $('period').min=mode==='monthly'?min.slice(0,7):min;$('period').max=mode==='monthly'?latest.slice(0,7):latest;
 if($('period').value>$('period').max)$('period').value=$('period').max;
 if($('period').value<$('period').min)$('period').value=$('period').min;
 for(const id of ['monthA','monthB']){$(id).min=min.slice(0,7);$(id).max=latest.slice(0,7);if($(id).value>$(id).max)$(id).value=$(id).max;if($(id).value<$(id).min)$(id).value=$(id).min;}
 const yearSelect=$('year'),yearMin=provider==='kma'?'1972':'1940',yearMax=latest.slice(0,4),preferred=yearSelect.value||readSettings().year||yearMax;yearSelect.min=yearMin;yearSelect.max=yearMax;
 if(yearSelect.dataset.range!==yearMin+'-'+yearMax){yearSelect.innerHTML=Array.from({length:Number(yearMax)-Number(yearMin)+1},(_,i)=>{const year=Number(yearMax)-i;return `<option value="${year}">${year}년</option>`;}).join('');yearSelect.dataset.range=yearMin+'-'+yearMax;yearSelect.value=String(Math.min(Number(yearMax),Math.max(Number(yearMin),/^\d{4}$/.test(preferred)?Number(preferred):Number(yearMax))));}
 if(yearSelect.value>yearMax)yearSelect.value=yearMax;if(yearSelect.value<yearMin)yearSelect.value=yearMin;if(typeof updateYearNavigation==='function')updateYearNavigation();
 $('databaseNote').innerHTML=provider==='era5'?sourceDescription().replace('방목리카페',cafeMapLink()):sourceDescription();$('latLabel').innerHTML=provider==='kma'?'산청 관측소 289 · 석대마을과 다른 위치':cafeMapLink()+' · 35.3249° N, 127.9225° E';$('apiHint').textContent=provider==='kma'?'기상청 관측 · 전일 자료 제공 지연 가능':'ERA5 재분석 · 7일 전까지 조회';updateWeekday();
}
function setupProvider(){
 $('database').onchange=()=>{if(isWorking()){$('database').value=provider;return;}provider=$('database').value;clear();resetComparison();resetYear();refreshProvider();if(mode==='daily')$('period').value=providerLatest();$('status').textContent='자료 출처를 변경했습니다. 기간을 선택하고 조회하세요.';$('compareStatus').textContent=$('yearStatus').textContent='선택한 출처로 조회하세요.';saveSettings();if(mode==='daily'&&typeof activeView!=='undefined'&&activeView==='weather')loadLatestDaily();};refreshProvider();
}
function restoreCache(){if(memoryCache.size)return;try{const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');for(const [key,value]of saved)if(Date.now()<value.expires)memoryCache.set(key,value);}catch{}}
function putCache(key,value){memoryCache.delete(key);memoryCache.set(key,value);while(memoryCache.size>18)memoryCache.delete(memoryCache.keys().next().value);try{localStorage.setItem(CACHE_KEY,JSON.stringify([...memoryCache]));}catch{/* Storage full/private mode: the current session cache remains usable. */}}
function readableError(data,status){
 const message=typeof data.error==='string'?data.error:typeof data.reason==='string'?data.reason:'';
 if(status===429||/limit|too many/i.test(message))return '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
 if(/date|range|available/i.test(message))return '선택 기간의 자료가 아직 없거나 조회 범위를 벗어났습니다. 날짜를 확인해 주세요.';
 if(provider==='kma'&&message)return message;
 return 'ERA5 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
async function fetchWeatherSource(start,end,{fresh=false}={}){
 const sourceProvider=provider,key=sourceProvider+'|'+start+'|'+end;restoreCache();const cached=memoryCache.get(key);
 if(!fresh&&cached&&cached.expires>Date.now())return {...cached.data,fromCache:true};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
 try{
  const url=sourceProvider==='kma'?'https://bang-kma-api-20261014.voidbn.chatgpt.site/weather?'+new URLSearchParams({start,end,schema:'rain-interval-v3',...(fresh?{refresh:Date.now()}: {})}):'https://archive-api.open-meteo.com/v1/archive?'+new URLSearchParams({latitude:String(REQUEST_COORDINATES.latitude),longitude:String(REQUEST_COORDINATES.longitude),start_date:start,end_date:nextWeatherDay(end),hourly:'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m',models:'era5',timezone:'Asia/Seoul',wind_speed_unit:'ms'});
  const res=await fetch(url,{signal:controller.signal,cache:fresh?'reload':'default'});let data;try{data=await res.json();}catch{throw Error('자료 제공 서버의 응답을 읽지 못했습니다. 다시 시도해 주세요.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('자료 제공 서버의 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.');
  if(!res.ok||data.error)throw Error(readableError(data,res.status));
  const fields=['temperature_2m','relative_humidity_2m','precipitation','wind_speed_10m','wind_direction_10m'];
  if(sourceProvider==='era5'&&(!Array.isArray(data.hourly?.time)||!fields.every(k=>Array.isArray(data.hourly[k])&&data.hourly[k].length===data.hourly.time.length)))throw Error('ERA5 자료 일부가 누락됐습니다. 다시 시도해 주세요.');
  if(sourceProvider==='kma'&&!Array.isArray(data.items))throw Error('기상청 자료 형식을 읽지 못했습니다. 다시 시도해 주세요.');
  data={...data,retrievedAt:data.retrievedAt||new Date().toISOString(),sourceProvider,requestCoordinates:REQUEST_COORDINATES,fromCache:false};
  const historical=end<new Date(Date.parse(todayKST())-7*86400000).toISOString().slice(0,10),ttl=historical?86400000:300000;
  putCache(key,{data,expires:Date.now()+ttl});return data;
 }catch(error){if(error.name==='TypeError')throw Error('자료 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');throw error;}finally{clearTimeout(timer);}
}
function winterAtEnd(time){const month=Number(shiftWeatherHour(time,-1).slice(5,7));return month<=3||month>=11;}
function sourceIntervals(data){
 if(data.sourceProvider==='era5')return data.hourly.time.map((end,i)=>({start:shiftWeatherHour(end,-1),end,hours:1,value:typeof data.hourly.precipitation[i]==='number'&&data.hourly.precipitation[i]>=0?data.hourly.precipitation[i]:null,recorded:typeof data.hourly.precipitation[i]==='number'&&data.hourly.precipitation[i]>=0}));
 const items=data.items,intervals=[];
 for(const r of items){
  // The server retains whether a precipitation field was actually supplied.
  const hours=r.rainIntervalHours|| (winterAtEnd(r.time)?3:1),expected=hours===1||Number(r.time.slice(11,13))%3===0;
  if(!expected)continue;
  const value=r.rain,recorded=r.rainRecorded??(typeof value==='number'&&value>0);
  intervals.push({start:shiftWeatherHour(r.time,-hours),end:r.time,hours,value,recorded});
 }
 return intervals;
}
async function fetchWeatherRange(start,end,options={}){
 const data=options.sourceData||await fetchWeatherSource(start,end,options),intervals=sourceIntervals(data).filter(r=>r.start.slice(0,10)>=start&&r.end<=nextWeatherDay(end)+'T00:00'),intervalByStart=new Map(intervals.map(r=>[r.start,r]));
 const h={time:[],temperature_2m:[],relative_humidity_2m:[],precipitation:[],wind_speed_10m:[],wind_direction_10m:[]};
 const sourceMap=data.sourceProvider==='kma'?new Map(data.items.map(r=>[r.time,r])):new Map(data.hourly.time.map((time,i)=>[time,{temp:data.hourly.temperature_2m[i],humidity:data.hourly.relative_humidity_2m[i],wind:data.hourly.wind_speed_10m[i],dir:data.hourly.wind_direction_10m[i]}]));
 for(let time=start+'T00:00';time<=end+'T23:00';time=shiftWeatherHour(time,1)){
  const row=sourceMap.get(time);h.time.push(time);h.temperature_2m.push(row?.temp??null);h.relative_humidity_2m.push(row?.humidity??null);h.wind_speed_10m.push(row?.wind??null);h.wind_direction_10m.push(row?.dir??null);h.precipitation.push(intervalByStart.get(time)?.value??null);
 }
 const days={};
 for(let day=start;day<=end;day=nextWeatherDay(day)){
  const segments=intervals.filter(r=>r.start.slice(0,10)===day),covered=segments.filter(r=>typeof r.value==='number'&&Number.isFinite(r.value)).reduce((n,r)=>n+r.hours,0),expected=new Map();let sum=0;
  for(const r of segments){if(typeof r.value==='number'&&Number.isFinite(r.value)){sum+=r.value;for(let time=r.start;time<r.end;time=shiftWeatherHour(time,1))expected.set(time,true);}}
  days[day]={rain:expected.size===24&&covered===24?sum:null,knownRain:sum,rainCoveredHours:Math.min(24,expected.size),intervals:segments};
 }
 const officialDays=new Map((data.sourceProvider==='kma'&&Array.isArray(data.dailyRain)?data.dailyRain:[]).filter(r=>typeof r.rain==='number'&&Number.isFinite(r.rain)&&r.rain>=0).map(r=>[r.date,r.rain]));
 for(const [day,record]of Object.entries(days)){record.rainOrigin=officialDays.has(day)?'기상청 공식 일자료':'시간 누적 구간';if(officialDays.has(day))record.rain=officialDays.get(day);}
 const rainBasis=officialDays.size?'기상청 공식 일자료'+(Object.keys(days).some(day=>!officialDays.has(day))?' · 일부 시간자료 집계':''):'시간 누적 구간 합계';
 const all=Object.values(days),complete=all.every(d=>d.rain!==null),rainTotal=complete?all.reduce((n,d)=>n+d.rain,0):null;
 let lastReceived=null;for(const [time,r]of sourceMap)if(time.slice(0,10)>=start&&time.slice(0,10)<=end&&[r.temp,r.humidity,r.wind].some(v=>typeof v==='number'&&Number.isFinite(v)))if(!lastReceived||time>lastReceived)lastReceived=time;
 const completeRainDays=Object.entries(days).filter(([,d])=>d.rain!==null).map(([day])=>day);
 return {rainBasis,hourly:h,days,intervals,rainTotal,knownRainTotal:all.reduce((n,d)=>n+d.knownRain,0),sourceProvider:data.sourceProvider,latitude:data.sourceProvider==='kma'?STATION_COORDINATES.latitude:data.latitude,longitude:data.sourceProvider==='kma'?STATION_COORDINATES.longitude:data.longitude,requestCoordinates:REQUEST_COORDINATES,station:data.station,retrievedAt:data.retrievedAt,fromCache:data.fromCache,lastReceived,lastCompleteRainDay:completeRainDays.at(-1)||null};
}
function rangeTotal(data){return data.rainTotal;}
function exportCSV(filename,rows){const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvMetadata(data,start,end){return [['출처',sourceName()],['집계기준','KST · 온도/습도/풍속은 유효 시간자료 평균 · 최저/최고는 시간값 · 강수: '+(data.rainBasis||'시간 누적 구간 합계')],['조회범위',start,end],['조회시각(KST)',new Date(data.retrievedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})],['기준장소','방목리카페',REQUEST_COORDINATES.latitude,REQUEST_COORDINATES.longitude],['실제 자료 위치',data.station?'산청 ASOS 289':'ERA5 격자',data.latitude,data.longitude],['마지막 기상 수신시각(KST)',data.lastReceived||'없음'],['마지막 강수 집계 완료일',data.lastCompleteRainDay||'없음'],['누적 강수량 표시(mm)',displayedRain(data),data.rainTotal===null?'확인분 · 미완료 포함 · 전체 합계 아님':'완료'],['강수 확인분 합계(mm)',data.knownRainTotal,'결측이 있으면 전체 합계가 아닙니다.']];}
