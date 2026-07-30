import { dbSelect, dbInsert, dbUpdate, dbDelete, signInAdmin } from './supabase.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session = JSON.parse(sessionStorage.getItem('kochi-admin-session') || 'null');
let submissions = [];
let legends = [];

async function loadDashboard() {
  try {
    [submissions, legends] = await Promise.all([
      dbSelect('submissions', 'select=*&order=created_at.desc', session.access_token),
      dbSelect('legends', 'select=*&order=sort_order.asc,created_at.desc', session.access_token)
    ]);
    $('#pending-count').textContent = submissions.filter(x => x.status === 'pending').length;
    $('#approved-count').textContent = submissions.filter(x => x.status === 'approved').length;
    $('#legend-count').textContent = legends.length;
    renderSubmissions();
    renderLegends();
  } catch (error) {
    if (/JWT|token|401/i.test(error.message)) logout();
    else alert(`読み込みエラー: ${error.message}`);
  }
}

function renderSubmissions() {
  const filter = $('#submission-filter').value;
  const rows = filter === 'all' ? submissions : submissions.filter(x => x.status === filter);
  $('#admin-submissions').innerHTML = rows.length ? rows.map(x => `<article class="admin-card"><div class="admin-card-head"><span class="status ${x.status}">${x.status}</span><time>${new Date(x.created_at).toLocaleString('ja-JP')}</time></div><h3>${esc(x.legend)}</h3><p>📍 ${esc(x.place)} ／ BY ${esc(x.author || '名もなき冒険者')}</p><dl><dt>なぜ伝説？</dt><dd>${esc(x.why)}</dd><dt>会いかた</dt><dd>${esc(x.access)}</dd></dl>${x.youtube ? `<a href="${esc(x.youtube)}" target="_blank" rel="noopener">YouTube ↗</a>` : ''}<div class="admin-actions"><button data-action="approved" data-id="${x.id}">公開</button><button data-action="rejected" data-id="${x.id}">非公開</button><button data-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">対象の投稿はありません。</p>';
}

function renderLegends() {
  $('#admin-legends').innerHTML = legends.length ? legends.map(x => `<article class="admin-card"><div class="admin-card-head"><span class="status ${x.status}">${x.status}</span><span>${esc(x.category)} / ${esc(x.area)}</span></div><h3>${esc(x.title)}</h3><p>📍 ${esc(x.place)}</p><p>${esc(x.summary)}</p><div class="admin-actions"><button data-legend-action="${x.status === 'published' ? 'draft' : 'published'}" data-id="${x.id}">${x.status === 'published' ? '下書きへ' : '公開する'}</button><button data-legend-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">図鑑はまだ登録されていません。</p>';
}

async function authenticate(email, password) {
  const result = await signInAdmin(email, password);
  session = result;
  sessionStorage.setItem('kochi-admin-session', JSON.stringify(session));
  $('#login-panel').hidden = true;
  $('#dashboard').hidden = false;
  await loadDashboard();
}

function logout() {
  session = null;
  sessionStorage.removeItem('kochi-admin-session');
  $('#dashboard').hidden = true;
  $('#login-panel').hidden = false;
}

$('#admin-login').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  $('#login-error').textContent = '';
  try { await authenticate(data.get('email'), data.get('password')); }
  catch { $('#login-error').textContent = 'ログインできません。管理者のメールアドレスとパスワードを確認してください。'; }
};
$('#logout').onclick = logout;
$('#submission-filter').onchange = renderSubmissions;
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === button));
  $('#tab-submissions').hidden = button.dataset.tab !== 'submissions';
  $('#tab-legends').hidden = button.dataset.tab !== 'legends';
});
$('#admin-submissions').onclick = async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'delete') {
    if (!confirm('この投稿を削除しますか？')) return;
    await dbDelete('submissions', button.dataset.id, session.access_token);
  } else await dbUpdate('submissions', button.dataset.id, { status: button.dataset.action, updated_at: new Date().toISOString() }, session.access_token);
  await loadDashboard();
};
$('#legend-form').onsubmit = async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  $('#legend-status').textContent = '登録中…';
  try { await dbInsert('legends', data, session.access_token); event.currentTarget.reset(); $('#legend-status').textContent = '✓ 登録しました'; await loadDashboard(); }
  catch (error) { $('#legend-status').textContent = `エラー: ${error.message}`; }
};
$('#admin-legends').onclick = async event => {
  const button = event.target.closest('[data-legend-action]'); if (!button) return;
  if (button.dataset.legendAction === 'delete') {
    if (!confirm('この伝説を削除しますか？')) return;
    await dbDelete('legends', button.dataset.id, session.access_token);
  } else await dbUpdate('legends', button.dataset.id, { status: button.dataset.legendAction, updated_at: new Date().toISOString() }, session.access_token);
  await loadDashboard();
};

if (session?.access_token) { $('#login-panel').hidden = true; $('#dashboard').hidden = false; loadDashboard(); }
