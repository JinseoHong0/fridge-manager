
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const labels = {ACTIVE:'보관중', CONSUMED:'소비완료', DISCARDED:'폐기'};
const titles = {fridge:'내 냉장고', recommend:'AI 맞춤 레시피', book:'내 레시피북', stats:'월별 소비 통계'};
const won = new Intl.NumberFormat('ko-KR');
const datePart = value => value.slice(0,10);
const localDate = () => new Date().toLocaleDateString('sv-SE');
function monthValue(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('sv-SE').slice(0,7);
}
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty = message => `<p class="empty">${html(message)}</p>`;
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const renderIcons = () => window.lucide?.createIcons();
const action = (key, id, text, attrs='') => `<button type="button" data-action="${key}" data-id="${Number(id)}" ${attrs}>${text}</button>`;
let items = [], storages = [], suggestions = [], zone = '', view = 'fridge', mode = 'login';
let session = new AbortController(), inventoryVersion = 0, bookVersion = 0, statsVersion = 0;
let saveEditor = null, deleteEditor = null, recommending = false;
let spendChart = null, spendParts = [];

function toast(message, bad=false) {
  const el = document.createElement('div');
  el.className = bad ? 'toast bad' : 'toast';
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 5200);
}
function showError(err) {
  if (err.name === 'AbortError') return;
  const message = err instanceof TypeError ? '서버에 연결할 수 없습니다. 다시 시도해 주세요.' : err.message;
  if ($('#dialog').open) $('#form-error').textContent = message;
  if (!$('#auth').hidden) $('#auth-error').textContent = message;
  toast(message, true);
}
function handle(element, event, callback) {
  element.addEventListener(event, async e => {
    try { await callback(e); } catch (err) { showError(err); }
  });
}
async function api(path, method='GET', body, timeoutMs) {
  const signal = timeoutMs === undefined ? session.signal :
    AbortSignal.any([session.signal, AbortSignal.timeout(timeoutMs)]);
  const res = await fetch(path, {method, signal, headers:{'Content-Type':'application/json'},
    credentials:'same-origin', body:body === undefined ? undefined : JSON.stringify(body)});
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  signal.throwIfAborted();
  if (res.ok) return data;
  if (res.status === 401) {
    signedOut();
    if (path === '/auth/me') return null;
    throw new Error(path === '/auth/login' ? '401 · 이메일 또는 비밀번호를 확인해 주세요.' : '401 · 세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
  throw new Error(`${res.status} · ${data?.message || '요청을 처리할 수 없습니다.'}`);
}
function authMode(next) {
  mode = next;
  const register = mode === 'register', form = $('#auth-form');
  $('#name-row').hidden = $('#password-hint').hidden = !register;
  form.elements.name.required = register;
  form.elements.password.minLength = register ? 8 : 0;
  form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-title').textContent = $('#auth-submit').textContent = register ? '회원가입' : '로그인';
  $('#auth-error').textContent = '';
  $$('[data-auth]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.auth === mode)));
}
function signedOut() {
  session.abort(); session = new AbortController();
  statsVersion++;
  clearStatsChart();
  if ($('#dialog').open) $('#dialog').close();
  $('#workspace').hidden = $('#navigation').hidden = $('#account').hidden = true;
  $('#boot').hidden = true; $('#auth').hidden = false;
  items = []; storages = []; suggestions = []; zone = ''; recommending = false;
  for (const id of ['saved','suggestions','recommend-status','items','choices','summary','report','zones','toasts','editor']) $('#'+id).replaceChildren();
  for (const id of ['keyword','status','risk','book-query']) $('#'+id).value = '';
  $('#username').textContent = '';
  $('#auth-form').reset(); authMode('login');
}
async function signedIn(user) {
  $('#auth').hidden = $('#boot').hidden = true;
  $('#workspace').hidden = $('#navigation').hidden = $('#account').hidden = false;
  $('#username').textContent = user.name;
  $('#auth-form').reset();
  $('#today').textContent = new Intl.DateTimeFormat('ko-KR',{dateStyle:'full'}).format(new Date());
  $('#status').value = 'ACTIVE';
  $('#month').value = monthValue();
  await navigate('fridge');
}
let authenticating = false;
async function authenticate(demo=false) {
  if (authenticating) return;
  authenticating = true;
  const form = $('#auth-form');
  $('#demo').disabled = $('#auth-submit').disabled = true;
  try {
    const {name,email,password} = Object.fromEntries(new FormData(form));
    if (!demo && mode === 'register') {
      await api('/auth/register','POST',{name,email,password});
      authMode('login'); form.elements.password.value = ''; form.elements.password.focus();
      toast('가입했습니다. 이메일과 비밀번호로 로그인해 주세요.'); return;
    }
    const data = await api('/auth/login','POST',demo ? {email:'a@test.com',password:'pass1234'} : {email,password});
    await signedIn(data.user);
  } finally { authenticating = false; $('#demo').disabled = $('#auth-submit').disabled = false; }
}
$$('[data-auth]').forEach(b => b.onclick = () => authMode(b.dataset.auth));
handle($('#auth-form'),'submit',e => { e.preventDefault(); return authenticate(); });
$('#auth-form').addEventListener('invalid', e => {
  if (mode === 'register' && e.target.name === 'password') $('#auth-error').textContent = '비밀번호는 8자 이상 입력해 주세요.';
}, true);
handle($('#demo'),'click',() => authenticate(true));
handle($('#logout'),'click',async () => { await api('/auth/logout','POST'); signedOut(); toast('로그아웃했습니다.'); });

async function navigate(next) {
  if (view === 'stats' && next !== 'stats') {
    statsVersion++;
    clearStatsChart();
  }
  view = next; $('#title').textContent = titles[next]; document.title = `${titles[next]} · 냉장노트`;
  for (const key of Object.keys(titles)) $('#'+key).hidden = key !== next;
  $$('[data-view]').forEach(b => b.setAttribute('aria-current',b.dataset.view === next ? 'page' : 'false'));
  $('#new-item').hidden = next !== 'fridge';
  if (next === 'fridge' || next === 'recommend') await refreshInventory();
  if (next === 'book') await loadBook();
  if (next === 'stats') await loadStats();
}
$$('[data-view]').forEach(b => handle(b,'click',() => navigate(b.dataset.view)));
async function refreshInventory() {
  const version = ++inventoryVersion;
  const [ingredients, areas] = await Promise.all([api('/ingredients'),api('/storages')]);
  if (version !== inventoryVersion) return;
  items = ingredients; storages = areas;
  if (!storages.some(s => String(s.id) === zone)) zone = '';
  renderFridge(); renderChoices();
}
function renderFridge() {
  const active = items.filter(i => i.status === 'ACTIVE');
  const imminent = active.filter(i => i.riskLevel === 'IMMINENT').length;
  const expired = active.filter(i => i.riskLevel === 'EXPIRED').length;
  $('#summary').innerHTML = `
    <li>전체 보관 <strong>${won.format(active.length)}개</strong></li>
    <li class="near">임박 <strong>${won.format(imminent)}개</strong></li>
    <li class="past">만료 <strong>${won.format(expired)}개</strong></li>`;
  $('#zones').innerHTML = [{id:'',name:'전체'},...storages].map(s =>
    `<button type="button" data-zone="${html(s.id)}" aria-pressed="${String(s.id) === zone}">${html(s.name)}</button>`).join('');
  $('#manage-zone').hidden = !zone;
  renderItems();
}
function renderItems() {
  const keyword = $('#keyword').value.trim().toLocaleLowerCase();
  const filtered = items.filter(i => (!zone || String(i.storageId) === zone) &&
    (!$('#status').value || i.status === $('#status').value) &&
    (!$('#risk').value || i.riskLevel === $('#risk').value) && i.name.toLocaleLowerCase().includes(keyword));
  $('#item-count').textContent = `${filtered.length}개`;
  $('#items').innerHTML = filtered.map(i => {
    const expired = i.riskLevel === 'EXPIRED', inactive = i.status !== 'ACTIVE';
    const expiresOn = datePart(i.expiresAt);
    const consumeAttrs = expired
      ? 'disabled title="소비기한이 지난 식재료는 폐기만 할 수 있어요."'
      : (inactive ? 'disabled' : '');
    return `<article class="card ingredient-card">
      <div class="ingredient-body">
        <div class="ingredient-head">
          <div>
            <h3>${html(i.name)}</h3>
            <p class="ingredient-location">${html(i.storage.name)}${inactive ? ' · ' + html(labels[i.status]) : ''}</p>
          </div>
          <span class="badge ${html(i.riskLevel)}" title="${html(i.riskLabel)}">${html(i.dDayLabel)}</span>
        </div>
        <p class="ingredient-meta"><time datetime="${html(expiresOn)}">${html(expiresOn.replaceAll('-', '.'))}까지</time> · ${won.format(i.price)}원</p>
        ${i.memo ? `<p class="ingredient-memo">${html(i.memo)}</p>` : ''}
      </div>
      <div class="actions">
        ${action('item',i.id,'수정')}
        ${action('consume',i.id,'소비완료',consumeAttrs)}
        ${action('discard',i.id,'폐기',inactive ? 'disabled' : '')}
        ${action('delete-item',i.id,'삭제','class="danger"')}
      </div>
    </article>`;
  }).join('') || empty('표시할 식재료가 없습니다.');
}
for (const id of ['keyword','status','risk']) $('#'+id).addEventListener('input',renderItems);
$('#zones').addEventListener('click',e => {
  const b = e.target.closest('[data-zone]');
  if (!b) return;
  zone = b.dataset.zone;
  for (const button of $$('#zones [data-zone]')) {
    button.setAttribute('aria-pressed', String(button === b));
  }
  $('#manage-zone').hidden = !zone;
  renderItems();
});
function renderChoices() {
  const selected = new Set($$('#choices input:checked').map(el => el.value));
  const usableItems = items.filter(i => i.status === 'ACTIVE' && i.riskLevel !== 'EXPIRED');
  $('#choices').innerHTML = usableItems.map(i => `<label><input type="checkbox" value="${i.id}" ${selected.has(String(i.id)) ? 'checked' : ''}>
    ${html(i.name)} <span class="badge ${html(i.riskLevel)}">${html(i.riskLabel)} · ${html(i.dDayLabel)}</span></label>`).join('')
    || '<p class="muted">추천에 사용할 수 있는 식재료가 없어요. 소비기한이 지나지 않은 재료를 등록해 주세요.</p>';
  $('#generate').disabled = recommending || usableItems.length === 0;
  $('#generate').innerHTML = recommending ? '<span class="spinner"></span> 레시피 추천 중…' : icon('sparkles')+' 레시피 추천받기';
  renderIcons();
}
function youtube(url, title) {
  let href = 'https://www.youtube.com/results?' + new URLSearchParams({search_query:title});
  let label = '유튜브에서 요리 제목 검색';
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && ['youtube.com','www.youtube.com','youtu.be','m.youtube.com'].includes(u.hostname)) {
      href = u.href;
      label = '유튜브 참고 영상';
    }
  } catch { /* 연결된 영상이 없으면 요리 제목으로 검색한다. */ }
  return `<a class="button" href="${html(href)}" target="_blank" rel="noopener noreferrer">${label}${icon('arrow-up-right')}</a>`;
}
function recipeCard(r, index, saved) {
  const steps = Array.isArray(r.steps) ? r.steps : r.steps.split(/\r?\n/);
  const ingredients = Array.isArray(r.usedIngredients) ? r.usedIngredients.join(', ') : r.usedIngredients;
  return `<article class="card recipe-card"><h3>${html(r.title)}</h3><span class="badge">${icon('clock')} ${html(r.cookingTime)}</span>
    <p><b>사용 식재료</b><br>${html(ingredients)}</p><ol>${steps.filter(Boolean).map(s => `<li>${html(s)}</li>`).join('')}</ol>
    ${r.memo ? `<p class="memo"><b>개인 메모</b><br>${html(r.memo)}</p>` : ''}
    <div class="actions">${youtube(r.videoUrl,r.title)}${saved ? action('memo',r.id,'메모 수정')+action('delete-recipe',r.id,'삭제','class="danger"') :
    action('save-recipe',index,r.saved ? '저장 완료':'내 레시피북에 저장',r.saved ? 'disabled':'')}</div></article>`;
}
function renderSuggestions() {
  $('#suggestions').innerHTML = suggestions.map((r,i) => recipeCard(r,i,false)).join('') || empty('추천 결과가 없습니다.');
  renderIcons();
}
handle($('#generate'),'click',async () => {
  if (recommending) return;
  const {signal} = session;
  const status = $('#recommend-status');
  status.className = 'muted';
  status.textContent = '식재료에 맞는 레시피를 준비하고 있어요.';
  recommending = true;
  renderChoices();
  try {
    const ingredientIds = $$('#choices input:checked:not(:disabled)').map(el => Number(el.value));
    const result = await api('/recipes/recommend', 'POST', {ingredientIds}, 25_000);
    if (!Array.isArray(result?.recommendations) || result.recommendations.length === 0) {
      throw new Error('추천 결과를 받지 못했어요. 다시 시도해 주세요.');
    }
    suggestions = result.recommendations;
    renderSuggestions();
    status.textContent = result.source === 'fallback'
      ? `기본 추천 레시피 ${suggestions.length}개를 표시했어요.`
      : `맞춤 레시피 ${suggestions.length}개를 찾았어요.`;
  } catch (err) {
    if (signal.aborted) throw err;
    status.className = 'error';
    status.textContent = err.name === 'TimeoutError' ? '추천 응답이 지연되고 있어요. 다시 시도해 주세요.' :
      err instanceof TypeError ? '추천 서버에 연결할 수 없어요. 다시 시도해 주세요.' : err.message;
  } finally {
    if (!signal.aborted) {
      recommending = false;
      renderChoices();
    }
  }
});
async function loadBook() {
  const version = ++bookVersion;
  const q = new URLSearchParams({keyword:$('#book-query').value.trim()});
  const recipes = await api('/recipes?'+q);
  if (version !== bookVersion) return;
  $('#saved').innerHTML = recipes.map((r,i) => recipeCard(r,i,true)).join('') || empty('표시할 레시피가 없습니다.');
  renderIcons();
}
handle($('#book-query'),'input',loadBook);
const formatWon = amount => `${won.format(amount)}원`;
const coffeePrice = 4500;
const coffeeCount = new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 1});

function previousStatsMonth(month) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function statsDelta(amount, previous, field) {
  if (!previous) return '<span class="stats-delta">지난달 비교 불가</span>';
  if (previous.totalCount === 0) return '<span class="stats-delta">지난달 기록 없음</span>';
  const change = amount - previous[field];
  const sign = change < 0 ? '-' : change > 0 ? '+' : '';
  const tone = field === 'wastedAmount' && change !== 0 ? (change < 0 ? ' is-better' : ' is-higher') : '';
  return `<span class="stats-delta${tone}">지난달 대비 ${sign}${formatWon(Math.abs(change))}</span>`;
}

function statsMetric(label, amount, symbol, comparison = '') {
  return `<article class="metric">
    <span class="metric-label">${icon(symbol)}${label}</span>
    <strong>${won.format(amount)}<small>원</small></strong>
    ${comparison}
  </article>`;
}

function statsInsight(stats) {
  if (stats.wastedAmount === 0) {
    return `<p class="stats-insight">${icon('circle-check')}<span><strong>폐기 금액 0원!</strong> 식재료를 알뜰하게 관리했어요.</span></p>`;
  }
  const cups = stats.wastedAmount / coffeePrice;
  const equivalent = cups < 0.1 ? '아메리카노 0.1잔 미만' : `아메리카노 약 ${coffeeCount.format(cups)}잔`;
  return `<p class="stats-insight">${icon('coffee')}<span>폐기로 낭비한 <strong>${formatWon(stats.wastedAmount)}</strong>은 ${equivalent} 값이에요. <small>(1잔 ${formatWon(coffeePrice)} 기준)</small></span></p>`;
}

function clearStatsChart() {
  spendChart?.destroy();
  spendChart = null;
  spendParts = [];
}

function drawStatsChart() {
  const canvas = $('#spend-chart');
  if (!canvas || !window.Chart || spendChart || spendParts.length === 0) return;

  const colors = getComputedStyle(canvas);
  spendChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: spendParts.map(part => part.label),
      datasets: [{
        data: spendParts.map(part => part.amount),
        backgroundColor: spendParts.map(part => colors.getPropertyValue(`--spend-${part.kind}`).trim()),
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      layout: {padding: 5},
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : {duration: 320},
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: ({label, raw}) => `${label} ${formatWon(raw)}`}},
      },
    },
  });
  canvas.closest('.spend-donut').classList.add('has-chart');
}

function spendingBreakdown(stats, parts) {
  const chart = stats.totalSpent > 0
    ? '<div class="spend-plot"><canvas id="spend-chart" aria-hidden="true"></canvas></div>'
    : '';
  const legend = parts.map(part => `<li>
    <span class="spend-key"><span class="spend-dot ${part.kind}"></span>${part.label}</span>
    <strong>${formatWon(part.amount)}</strong>
  </li>`).join('');
  return `<section class="stats-card">
    <h2>지출 구성</h2>
    <div class="spend-overview">
      <div class="spend-donut">
        ${chart}
        <div class="spend-center"><span>총 지출</span><strong>${formatWon(stats.totalSpent)}</strong></div>
      </div>
      <ul class="spend-legend" aria-label="상태별 금액">${legend}</ul>
    </div>
    <div class="stats-rates">
      <div><span>소비율</span><strong>${stats.consumptionRate}%</strong><small>${stats.consumedCount}개</small></div>
      <div><span>폐기율</span><strong>${stats.discardRate}%</strong><small>${stats.discardedCount}개</small></div>
    </div>
    <p class="muted stats-note">전체 ${stats.totalCount}개 기준 · 보관 중 ${stats.activeCount}개</p>
  </section>`;
}

function wasteRanking(ingredients, monthLabel) {
  const top = ingredients.filter(item => item.status === 'DISCARDED')
    .sort((a, b) => b.price - a.price || a.id - b.id)
    .slice(0, 5);
  const list = top.length === 0 ? '<p class="stats-empty">이 달에 폐기한 식재료가 없어요.</p>' :
    `<ol class="waste-ranking">${top.map((item, index) => `<li>
      <span class="waste-rank" aria-hidden="true">${index + 1}</span>
      <div class="waste-item"><strong>${html(item.name)}</strong><small>${html(item.storage?.name ?? '구역 없음')}</small></div>
      <strong class="waste-price">${formatWon(item.price)}</strong>
    </li>`).join('')}</ol>`;
  return `<section class="stats-card">
    <div class="stats-card-title"><h2>${monthLabel} 아까웠던 폐기 식재료</h2><span class="stats-tag">TOP 5</span></div>
    ${list}
  </section>`;
}

function storageBreakdown(ingredients) {
  const groups = new Map();
  for (const item of ingredients) {
    if (!groups.has(item.storageId)) {
      groups.set(item.storageId, {name: item.storage?.name ?? '구역 없음', spent: 0, discarded: 0});
    }
    const group = groups.get(item.storageId);
    group.spent += item.price;
    if (item.status === 'DISCARDED') group.discarded++;
  }
  const zones = [...groups.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, 'ko'));
  const totalSpent = zones.reduce((sum, zone) => sum + zone.spent, 0);
  const totalDiscarded = zones.reduce((sum, zone) => sum + zone.discarded, 0);
  return `<section class="stats-card stats-storage">
    <h2>보관 구역별 현황</h2>
    <p class="muted stats-note">막대는 이 달 전체 지출액과 전체 폐기 건수에서 각 구역이 차지하는 비중이에요.</p>
    <ul class="storage-list">${zones.map(zone => `<li>
      <strong class="storage-name">${html(zone.name)}</strong>
      <div class="storage-bar">
        <div><span>지출액</span><strong>${formatWon(zone.spent)}</strong></div>
        <progress aria-hidden="true" max="${Math.max(totalSpent, 1)}" value="${zone.spent}"></progress>
      </div>
      <div class="storage-bar waste">
        <div><span>폐기</span><strong>${won.format(zone.discarded)}건</strong></div>
        <progress aria-hidden="true" max="${Math.max(totalDiscarded, 1)}" value="${zone.discarded}"></progress>
      </div>
    </li>`).join('')}</ul>
  </section>`;
}

function renderMonthlyStats(stats, previous, ingredients) {
  // 서버와 같은 기준으로 구매일 또는 소비기한이 선택한 달인 식재료를 모은다.
  const monthlyItems = ingredients.filter(item =>
    item.purchasedAt.slice(0, 7) === stats.month || item.expiresAt.slice(0, 7) === stats.month);
  const monthLabel = stats.month === monthValue() ? '이번 달' : `${Number(stats.month.slice(5))}월`;
  spendParts = [
    {kind: 'consumed', label: '소비 금액', amount: stats.consumedAmount},
    {kind: 'held', label: '보관 중 금액', amount: stats.totalSpent - stats.consumedAmount - stats.wastedAmount},
    {kind: 'waste', label: '폐기 금액', amount: stats.wastedAmount},
  ];
  $('#report').innerHTML = `
    ${statsInsight(stats)}
    <div class="metrics">
      ${statsMetric('총 지출 금액', stats.totalSpent, 'wallet', statsDelta(stats.totalSpent, previous, 'totalSpent'))}
      ${statsMetric('소비 금액', stats.consumedAmount, 'utensils')}
      ${statsMetric('폐기 낭비 금액', stats.wastedAmount, 'trash-2', statsDelta(stats.wastedAmount, previous, 'wastedAmount'))}
    </div>
    <div class="stats-details">
      ${spendingBreakdown(stats, spendParts)}
      ${wasteRanking(monthlyItems, monthLabel)}
    </div>
    ${storageBreakdown(monthlyItems)}`;
  renderIcons();
  drawStatsChart();
}

async function loadStats() {
  const version = ++statsVersion;
  const month = $('#month').value;
  for (const button of $$('[data-month-offset]')) {
    button.setAttribute('aria-pressed', String(month === monthValue(Number(button.dataset.monthOffset))));
  }
  clearStatsChart();
  const report = $('#report');
  report.innerHTML = empty(month ? '월별 통계를 불러오는 중이에요.' : '조회할 월을 선택해 주세요.');
  if (!month) return;

  const statsUrl = value => '/ingredients/stats/monthly?' + new URLSearchParams({month: value});
  const {signal} = session;
  try {
    const [stats, previous, ingredients] = await Promise.all([
      api(statsUrl(month)),
      api(statsUrl(previousStatsMonth(month))).catch(err => {
        if (signal.aborted) throw err;
        return null;
      }),
      api('/ingredients'),
    ]);
    if (version !== statsVersion || signal.aborted) return;
    if (stats.totalCount === 0) {
      report.innerHTML = empty('이 달에 집계할 식재료가 없어요. 다른 달을 선택해 보세요.');
      return;
    }
    renderMonthlyStats(stats, previous, ingredients);
  } catch (err) {
    if (version !== statsVersion || err.name === 'AbortError') return;
    if (!$('#workspace').hidden) {
      report.innerHTML = empty('월별 통계를 불러오지 못했어요. 다시 조회해 주세요.');
    }
    throw err;
  }
}
handle($('#month'),'change',loadStats);
for (const button of $$('[data-month-offset]')) {
  handle(button,'click',() => {
    $('#month').value = monthValue(Number(button.dataset.monthOffset));
    return loadStats();
  });
}


function openEditor(title, fields, submit, saveText='저장', remove=null) {
  const dialog = $('#dialog');
  $('#dialog-title').textContent = title;
  $('#editor').innerHTML = fields + `<p id="form-error" class="error" role="alert"></p><div class="end">
    ${remove ? '<button type="button" class="danger" id="remove-zone">구역 삭제</button>' : ''}
    <button type="button" id="cancel">취소</button><button class="primary">${saveText}</button></div>`;
  saveEditor = submit; deleteEditor = remove;
  $('#cancel').onclick = () => dialog.close();
  dialog.showModal();
}
$('#close').onclick = () => $('#dialog').close();
$('#dialog').addEventListener('close',() => { saveEditor = null; deleteEditor = null; });
async function runEditor(work) {
  const form = $('#editor'), buttons = [...form.querySelectorAll('button')];
  $('#form-error').textContent = '';
  buttons.forEach(b => b.disabled = true);
  try { await work(); } finally { buttons.forEach(b => b.disabled = false); }
}
handle($('#editor'),'submit',e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  return runEditor(() => saveEditor(data));
});
handle($('#editor'),'click',e => {
  if (e.target.closest('#remove-zone')) return runEditor(deleteEditor);
});
function input(label,name,type,value='',attrs='') {
  return `<label>${label}<input name="${name}" type="${type}" value="${html(value)}" ${attrs}></label>`;
}
function textarea(label,name,value='') {
  return `<label>${label}<textarea name="${name}" rows="3">${html(value)}</textarea></label>`;
}
async function inventoryChanged(message) {
  if ($('#dialog').open) $('#dialog').close();
  toast(message);
  await refreshInventory();
}
async function openItem(id) {
  const item = id ? await api('/ingredients/'+id) : null;
  if (!storages.length) { toast('식재료를 등록할 보관 구역을 먼저 추가해 주세요.'); return openZone(); }
  const selected = String(item?.storageId ?? (zone || storages[0].id));
  const options = storages.map(s => `<option value="${s.id}" ${String(s.id) === selected ? 'selected':''}>${html(s.name)}</option>`).join('');
  const info = item ? `<div class="badges"><span class="badge">${html(labels[item.status])}</span><span class="badge ${html(item.riskLevel)}">${html(item.riskLabel)} · ${html(item.dDayLabel)}</span></div>` : '';
  openEditor(item ? '식재료 상세 / 수정' : '식재료 등록',info+
    input('식재료명','name','text',item?.name,'required')+
    `<label>보관 구역<select name="storageId">${options}</select></label><div class="pair">`+
    input('구매일','purchasedAt','date',item ? datePart(item.purchasedAt) : localDate(),'required')+
    input('소비기한','expiresAt','date',item ? datePart(item.expiresAt) : '','required')+'</div>'+
    input('가격 (원)','price','number',item?.price ?? 0,'min="0" step="1" required')+textarea('메모','memo',item?.memo),
    async data => {
      const payload = {...data,storageId:Number(data.storageId),price:Number(data.price)};
      if (item) payload.status = item.status;
      await api(item ? '/ingredients/'+id : '/ingredients',item ? 'PUT':'POST',payload);
      await inventoryChanged(item ? '식재료를 수정했습니다.' : '식재료를 등록했습니다.');
    });
}
async function openZone(id) {
  const s = id ? await api('/storages/'+id) : null;
  openEditor(s ? '보관 구역 상세 / 수정' : '보관 구역 추가',
    (s ? `<p class="muted">이 구역의 식재료 ${s.ingredients.length}개</p>` : '')+
    input('구역 이름','name','text',s?.name,'required')+
    input('보관 온도 / 방법','tempInfo','text',s?.tempInfo)+
    input('표시 순서','sortOrder','number',s?.sortOrder ?? storages.length+1,'min="1" required'),
    async data => {
      const area = await api(s ? '/storages/'+id : '/storages',s ? 'PUT':'POST',{...data,sortOrder:Number(data.sortOrder)});
      zone = String(area.id);
      await inventoryChanged(s ? '보관 구역을 수정했습니다.' : '보관 구역을 추가했습니다.');
    },'저장',s ? async () => {
      if (!confirm(`‘${s.name}’ 구역과 그 안의 식재료 ${s.ingredients.length}개를 함께 삭제할까요?`)) return;
      await api('/storages/'+id,'DELETE'); zone = ''; await inventoryChanged('보관 구역을 삭제했습니다.');
    } : null);
}
handle($('#manage-zone'),'click',() => openZone(zone));
handle($('#new-item'),'click',() => openItem());
handle($('#workspace'),'click',async e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const id = Number(b.dataset.id);
  b.disabled = true;
  try {
    switch (b.dataset.action) {
      case 'item': await openItem(id); break;
      case 'add-zone': await openZone(); break;
      case 'consume':
      case 'discard': {
        const discard = b.dataset.action === 'discard';
        await api(`/ingredients/${id}/status`,'PATCH',{status:discard ? 'DISCARDED':'CONSUMED'});
        await inventoryChanged(discard ? '폐기 처리했습니다.' : '소비완료로 표시했습니다.'); break;
      }
      case 'delete-item':
        if (!confirm('이 식재료를 삭제할까요?')) return;
        await api('/ingredients/'+id,'DELETE'); await inventoryChanged('식재료를 삭제했습니다.'); break;
      case 'save-recipe': {
        const r = suggestions[id];
        const {title,cookingTime,usedIngredients,steps,videoUrl} = r;
        await api('/recipes','POST',{title,cookingTime,usedIngredients,steps,videoUrl});
        r.saved = true; renderSuggestions(); toast('내 레시피북에 저장했습니다.');
        if (view === 'book') await loadBook();
        break;
      }
      case 'memo': {
        const {title,cookingTime,usedIngredients,steps,videoUrl,memo} = await api('/recipes/'+id);
        openEditor('개인 메모 수정',`<h3>${html(title)}</h3>`+textarea('개인 메모','memo',memo),async data => {
          await api('/recipes/'+id,'PUT',{title,cookingTime,usedIngredients,steps,videoUrl,memo:data.memo});
          $('#dialog').close(); toast('메모를 수정했습니다.'); await loadBook();
        }); break;
      }
      case 'delete-recipe':
        if (!confirm('저장한 레시피를 삭제할까요?')) return;
        await api('/recipes/'+id,'DELETE'); toast('레시피를 삭제했습니다.'); await loadBook(); break;
    }
  } finally { b.disabled = false; }
});
async function start() {
  try {
    const data = await api('/auth/me');
    if (data) await signedIn(data.user);
  } catch (err) { if ($('#workspace').hidden) signedOut(); showError(err); }
}
$('#lucide-cdn').addEventListener('load', renderIcons, {once: true});
$('#chart-cdn').addEventListener('load', drawStatsChart, {once: true});
renderIcons();
start();
