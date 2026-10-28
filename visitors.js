'use strict';
(() => {
  const root = document.getElementById('visitorCounter');
  if (!root) return;
  const endpoint = 'https://bang-kma-api-20261014.voidbn.chatgpt.site/visits';
  const storageKey = 'stone-visitor-day-v1';
  const publicApp = location.origin === 'https://ewanyoo.github.io' && /^\/stone(?:\/|$)/.test(location.pathname);
  const todayValue = document.getElementById('visitorToday');
  const totalValue = document.getElementById('visitorTotal');
  const note = document.getElementById('visitorStatus');
  const start = document.getElementById('visitorStart');
  const retry = document.getElementById('visitorRetry');
  let running = false, lastDay = '';
  const validStats = s => /^\d{4}-\d{2}-\d{2}$/.test(s?.day || '') && Number.isSafeInteger(s.today) && s.today >= 0 && Number.isSafeInteger(s.total) && s.total >= s.today;
  async function request(method = 'GET', body) {
    const response = await fetch(endpoint, {
      method, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(8000),
      ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}),
    });
    if (!response.ok) { const error = new Error('counter'); error.status = response.status; throw error; }
    const result = await response.json();
    if (!validStats(result)) throw new Error('counter');
    return result;
  }
  function show(stats) {
    todayValue.textContent = stats.today.toLocaleString('ko-KR');
    totalValue.textContent = stats.total.toLocaleString('ko-KR');
    start.textContent = stats.startDate ? `집계 시작: ${stats.startDate}` : '설치 후 첫 방문부터 집계합니다.';
    lastDay = stats.day;
  }
  async function register(stats) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let record;
      try {
        record = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (record?.day !== stats.day || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record?.token || '')) {
          record = {day: stats.day, token: crypto.randomUUID(), counted: false};
          localStorage.setItem(storageKey, JSON.stringify(record));
        }
      } catch {
        note.textContent = '브라우저 저장 기능을 사용할 수 없어 이번 방문은 집계하지 않습니다. 방문 수 조회는 가능합니다.';
        return stats;
      }
      if (record.counted) return stats;
      try {
        const result = await request('POST', {day: record.day, token: record.token});
        // Save success only after the server confirms. A failed response can be
        // retried with the same token without counting again.
        try { localStorage.setItem(storageKey, JSON.stringify({...record, counted: true})); } catch {}
        return result;
      } catch (error) {
        if (error.status === 409 && attempt === 0) { stats = await request(); continue; }
        throw error;
      }
    }
    throw new Error('counter');
  }
  async function refresh() {
    if (running) return;
    running = true; retry.hidden = true; note.textContent = '';
    try {
      const update = async () => {
        let stats = await request();
        show(stats);
        if (publicApp) show(await register(stats));
      };
      if (publicApp && navigator.locks) await navigator.locks.request('stone-visitor-day', update);
      else await update();
    } catch {
      note.textContent = '방문 수를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.';
      retry.hidden = false;
    } finally { running = false; }
  }
  retry.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => {
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (!document.hidden && lastDay && day !== lastDay) refresh();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  refresh();
})();
