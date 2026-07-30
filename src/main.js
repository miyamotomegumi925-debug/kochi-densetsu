import { dbSelect, dbInsert } from './supabase.js?v=20260730-4';

const menu = document.querySelector('.mobile-menu');
const menuButton = document.querySelector('.menu-btn');
menuButton.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuButton.textContent = open ? '×' : '☰';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
});

let gameAudioContext;
const unlockAudio = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  gameAudioContext ??= new AudioContextClass();
  if (gameAudioContext.state === 'suspended') await gameAudioContext.resume();
  return gameAudioContext;
};
const playStartSound = async () => {
  const context = await unlockAudio();
  if (!context) return false;
  const master = context.createGain();
  master.connect(context.destination);
  master.gain.setValueAtTime(.28, context.currentTime);
  master.gain.exponentialRampToValueAtTime(.001, context.currentTime + 1.25);
  [261.63,329.63,392,523.25,659.25,783.99,1046.5].forEach((frequency,index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = context.currentTime + index * .105;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(.001, time);
    gain.gain.linearRampToValueAtTime(.22, time + .012);
    gain.gain.setValueAtTime(.22, time + .072);
    gain.gain.exponentialRampToValueAtTime(.001, time + .102);
    oscillator.connect(gain); gain.connect(master);
    oscillator.start(time); oscillator.stop(time + .11);
  });
  return true;
};

const startButton = document.querySelector('.primary');
startButton.addEventListener('pointerdown', unlockAudio, { passive:true });
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', async () => {
  const isStart = button.classList.contains('primary');
  if (isStart) {
    const sounded = await playStartSound();
    button.textContent = sounded ? '♪ GAME START!' : 'GAME START!';
    document.body.classList.add('game-starting');
    setTimeout(() => { document.body.classList.remove('game-starting'); button.textContent = 'PRESS START'; }, 900);
  }
  setTimeout(() => document.getElementById(button.dataset.go)?.scrollIntoView({ behavior:'smooth' }), isStart ? 700 : 0);
  menu.classList.remove('open');
  menuButton.textContent = '☰';
  menuButton.setAttribute('aria-expanded', 'false');
}));

document.querySelector('#read-legend').addEventListener('click', event => {
  event.currentTarget.textContent = '冒険手帳に記録しました ✓';
});

const dialog = document.querySelector('#post-dialog');
const postForm = document.querySelector('#post-form');
const communityGrid = document.querySelector('#community-grid');
const emptyState = document.querySelector('#community-empty');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const getYouTubeId = value => {
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (['youtube.com','m.youtube.com'].includes(host)) id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] || '';
    return /^[\w-]{6,15}$/.test(id) ? id : '';
  } catch { return ''; }
};
const renderPosts = posts => {
  document.querySelector('#post-count').textContent = `${String(posts.length).padStart(3,'0')} POSTS`;
  emptyState.hidden = posts.length > 0;
  communityGrid.innerHTML = posts.map((post,index) => {
    const videoId = getYouTubeId(post.youtube);
    return `<article class="community-card"><div class="quest-no">QUEST ${String(posts.length-index).padStart(3,'0')}</div><div class="meta"><span>投稿</span><span>📍 ${escapeHtml(post.place)}</span></div><h3>${escapeHtml(post.legend)}</h3><dl><dt>✨ なぜ伝説？</dt><dd>${escapeHtml(post.why)}</dd><dt>🎒 会いかた</dt><dd>${escapeHtml(post.access)}</dd></dl>${videoId ? `<a class="youtube-link" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer"><span>▶</span><b>YouTubeで見る</b><small>動画で伝説をたしかめる →</small></a>` : ''}<footer><span>BY ${escapeHtml(post.author || '名もなき冒険者')}</span><time datetime="${escapeHtml(post.created_at)}">${new Date(post.created_at).toLocaleDateString('ja-JP')}</time></footer></article>`;
  }).join('');
};
const loadPublicData = async () => {
  try {
    const [posts,publishedLegends,settingRows] = await Promise.all([
      dbSelect('submissions','select=*&status=eq.approved&order=created_at.desc'),
      dbSelect('legends','select=*&status=eq.published&order=sort_order.asc,created_at.desc'),
      dbSelect('site_settings','select=*')
    ]);
    const publicSettings = Object.fromEntries(settingRows.map(row => [row.key,row.value]));
    renderPosts(posts);
    document.querySelector('#db-legend-count').textContent = String(publishedLegends.length).padStart(3,'0');
    document.querySelector('#db-legends').innerHTML = publishedLegends.map(legend => {
      const videoId = getYouTubeId(legend.youtube);
      return `<article><span>${escapeHtml(legend.category)} / ${escapeHtml(legend.area)}</span><h3>${escapeHtml(legend.title)}</h3><p>📍 ${escapeHtml(legend.place)}</p><p>${escapeHtml(legend.summary)}</p>${videoId ? `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">▶ 動画を見る</a>` : ''}</article>`;
    }).join('');
    applyHomeSettings(publicSettings, publishedLegends);
    const { initKochiMap } = await import('./maps.js?v=20260730-4');
    initKochiMap([...publishedLegends, ...posts]);
  } catch (error) {
    console.error(error);
    emptyState.innerHTML = '<b>▶ データベース準備中</b><p>管理者が接続設定を行っています。</p>';
  }
};

const legendCardHtml = legend => `<article class="legend-card paper"><div class="legend-visual"><b>${escapeHtml(legend.category?.slice(0,1) || '伝')}</b><span>LEGEND<br>No.${escapeHtml(legend.legend_no || '---')}</span></div><div class="legend-content"><div class="meta"><span>${escapeHtml(legend.category)}</span><span>📍 ${escapeHtml(legend.place)}</span></div><h3>${escapeHtml(legend.title)}</h3><p>${escapeHtml(legend.summary)}</p><span class="card-arrow">→</span></div></article>`;
function applyHomeSettings(settings, publishedLegends) {
  const featured = settings.home_featured || {};
  const today = publishedLegends.find(x => x.id === featured.today_legend_id);
  if (today) {
    document.querySelector('#today-feature-card').innerHTML = `<div class="feature-art" role="img" aria-label="${escapeHtml(today.title)}"><span>${escapeHtml(today.place)}</span><b>${escapeHtml(today.legend_no || '---')}</b></div><div class="feature-body"><div class="meta"><span>${escapeHtml(today.category)}</span><span>📍 ${escapeHtml(today.place)}</span></div><h3>${escapeHtml(today.title)}</h3><p>${escapeHtml(today.summary)}</p>${today.detail_url ? `<a class="feature-link" href="${escapeHtml(today.detail_url)}">▶ この伝説を読む</a>` : ''}</div>`;
  }
  const newLegends = (featured.new_legend_ids || []).map(id => publishedLegends.find(x => x.id === id)).filter(Boolean);
  if (newLegends.length) document.querySelector('#featured-legend-grid').innerHTML = newLegends.map(legendCardHtml).join('');
  const seasonal = settings.seasonal;
  if (seasonal) {
    document.querySelector('#season').hidden = seasonal.enabled === false;
    document.querySelector('#season-label').textContent = `SEASONAL LEGEND / ${seasonal.label || seasonal.season || ''}`;
    document.querySelector('#season-title').textContent = seasonal.title || '';
    document.querySelector('#season-description').textContent = seasonal.description || '';
    const link = document.querySelector('#season-link');
    if (seasonal.link?.startsWith('#')) link.dataset.go = seasonal.link.slice(1);
  }
}

document.querySelector('#join-btn').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
postForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(postForm);
  const youtube = data.get('youtube').trim();
  const youtubeInput = postForm.elements.youtube;
  const status = document.querySelector('#form-status');
  if (youtube && !getYouTubeId(youtube)) {
    youtubeInput.setCustomValidity('YouTubeの動画URLを入力してください。');
    youtubeInput.reportValidity();
    return;
  }
  youtubeInput.setCustomValidity('');
  status.textContent = '送信中…';
  try {
    await dbInsert('submissions', {
      place:data.get('place').trim(), legend:data.get('legend').trim(),
      why:data.get('why').trim(), access:data.get('access').trim(),
      youtube:youtube || null, author:data.get('author').trim() || null, status:'pending'
    });
    status.textContent = '✓ 投稿を受け付けました！ 管理者の確認後に公開されます。';
    setTimeout(() => { dialog.close(); postForm.reset(); status.textContent = ''; }, 1200);
  } catch (error) {
    let message = '送信できませんでした。';
    try {
      const detail = JSON.parse(error.message);
      if (detail.code === '42501') message += ' 投稿権限が拒否されています（RLS）。';
      else if (detail.code === '23514') message += ' 入力文字数または入力内容を確認してください。';
      else message += ` ${detail.message || detail.code || ''}`;
    } catch {
      message += ' 通信状態を確認して、もう一度お試しください。';
    }
    status.textContent = message;
    console.error(error);
  }
});

document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-area]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.querySelector('#area-label').textContent = button.dataset.area;
  document.dispatchEvent(new CustomEvent('kochi-area-change', { detail:{ area:button.dataset.area } }));
}));

loadPublicData();
