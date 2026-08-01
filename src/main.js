import { dbSelect, dbInsert, uploadSubmissionImage } from './supabase.js?v=20260801-1';

function ensureHeroIntroduction() {
  const consolePanel = document.querySelector('.game-console');
  if (!consolePanel || consolePanel.querySelector('.hero-intro')) return;
  consolePanel.insertAdjacentHTML('afterbegin', `
    <div class="hero-intro">
      <p class="hero-tagline">まだ、誰も知らない高知に出会う。</p>
      <h1>高知に眠る100の伝説を集める旅。</h1>
      <p class="hero-description">人、文化、食、風景、祭り。まだ知らない高知の物語を、毎日ひとつ発見する冒険メディアです。</p>
    </div>
    <nav class="hero-commands" aria-label="このサイトでできること">
      <button type="button" data-go="today"><span aria-hidden="true">▶</span> 伝説を読む</button>
      <button type="button" data-go="map"><span aria-hidden="true">⌖</span> 地図から探す</button>
      <button type="button" data-go="join"><span aria-hidden="true">＋</span> 伝説を教える</button>
    </nav>`);
  consolePanel.querySelector('.hero-copy h1')?.remove();
  const heroCopy = consolePanel.querySelector('.hero-copy');
  const hud = consolePanel.querySelector('.game-hud');
  if (heroCopy && hud) heroCopy.after(hud);
}

ensureHeroIntroduction();

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
const questOverlay = document.querySelector('.quest-start-overlay');
const todaySection = document.querySelector('#today');
const todayHeading = document.querySelector('#today-title');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let questStarting = false;
let questTimers = [];

todayHeading?.setAttribute('tabindex', '-1');
const scheduleQuestStep = (callback, delay) => {
  const timer = window.setTimeout(callback, delay);
  questTimers.push(timer);
  return timer;
};
const clearQuestTimers = () => {
  questTimers.forEach(window.clearTimeout);
  questTimers = [];
};
const scrollToSection = (id, behavior = 'smooth') => {
  document.getElementById(id)?.scrollIntoView({ behavior, block:'start' });
};
const finishQuestStart = isReduced => {
  if (!questStarting) return;
  clearQuestTimers();
  questStarting = false;
  questOverlay.classList.remove('quest-start-active');
  questOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('game-starting');
  scrollToSection('today', isReduced ? 'auto' : 'smooth');
  todaySection.classList.add('quest-arrived');
  scheduleQuestStep(() => todayHeading?.focus({ preventScroll:true }), isReduced ? 0 : 160);
  scheduleQuestStep(() => todaySection.classList.remove('quest-arrived'), isReduced ? 180 : 850);
  startButton.textContent = 'PRESS START';
  startButton.removeAttribute('aria-busy');
};
const startQuest = event => {
  event?.preventDefault();
  if (questStarting) {
    finishQuestStart(reducedMotion.matches);
    return;
  }
  questStarting = true;
  clearQuestTimers();
  todaySection.classList.remove('quest-arrived');
  startButton.setAttribute('aria-busy', 'true');
  startButton.textContent = 'GAME START!';
  document.body.classList.add('game-starting');
  questOverlay.setAttribute('aria-hidden', 'false');
  questOverlay.classList.add('quest-start-active');
  playStartSound().catch(() => false);
  scheduleQuestStep(() => finishQuestStart(reducedMotion.matches), reducedMotion.matches ? 180 : 1450);
};

startButton.addEventListener('pointerdown', () => { unlockAudio().catch(() => null); }, { passive:true });
startButton.addEventListener('click', startQuest);
startButton.addEventListener('keydown', event => {
  if (event.key === ' ') startQuest(event);
});
questOverlay.addEventListener('click', () => finishQuestStart(reducedMotion.matches));
document.querySelectorAll('[data-go]:not(.primary)').forEach(button => button.addEventListener('click', async () => {
  scrollToSection(button.dataset.go);
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
postForm.querySelector('[name="author"]').closest('label').insertAdjacentHTML('beforebegin', '<label><span>📷 写真（任意）</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small class="field-help">JPEG・PNG・WebP、5MBまで</small></label>');
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
const enableAnalytics = analytics => {
  const measurementId = analytics?.enabled !== false ? analytics?.measurement_id?.trim().toUpperCase() : '';
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || document.querySelector('script[data-google-analytics]')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    anonymize_ip:true,
    allow_google_signals:false,
    allow_ad_personalization_signals:false
  });
  const script = document.createElement('script');
  script.async = true;
  script.dataset.googleAnalytics = measurementId;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
};
const renderPosts = posts => {
  document.querySelector('#post-count').textContent = `${String(posts.length).padStart(3,'0')} POSTS`;
  emptyState.hidden = posts.length > 0;
  communityGrid.innerHTML = posts.map((post,index) => {
    const videoId = getYouTubeId(post.youtube);
    return `<article class="community-card">${post.image_url ? `<img class="community-image" src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.legend)}">` : ''}<div class="quest-no">QUEST ${String(posts.length-index).padStart(3,'0')}</div><div class="meta"><span>投稿</span><span>📍 ${escapeHtml(post.place)}</span></div><h3>${escapeHtml(post.legend)}</h3><dl><dt>✨ なぜ伝説？</dt><dd>${escapeHtml(post.why)}</dd><dt>🎒 会いかた</dt><dd>${escapeHtml(post.access)}</dd></dl>${videoId ? `<a class="youtube-thumbnail" href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(post.legend)}のYouTube動画を見る"><img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="${escapeHtml(post.legend)}の動画サムネイル" loading="lazy"><span class="youtube-play" aria-hidden="true">▶</span><span class="youtube-caption">YouTubeで見る</span></a>` : ''}<footer><span>BY ${escapeHtml(post.author || '名もなき冒険者')}</span><time datetime="${escapeHtml(post.created_at)}">${new Date(post.created_at).toLocaleDateString('ja-JP')}</time></footer></article>`;
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
    enableAnalytics(publicSettings.analytics);
    renderPosts(posts);
    document.querySelector('#db-legend-count').textContent = String(publishedLegends.length).padStart(3,'0');
    document.querySelector('#db-legends').innerHTML = publishedLegends.map(legend => {
      const videoId = getYouTubeId(legend.youtube);
      return `<article id="legend-${escapeHtml(legend.id)}" data-legend-category="${escapeHtml(legend.category)}">${legend.image_url ? `<img class="db-legend-image" src="${escapeHtml(legend.image_url)}" alt="${escapeHtml(legend.title)}">` : ''}<span>${escapeHtml(legend.category)} / ${escapeHtml(legend.area)}</span><h3>${escapeHtml(legend.title)}</h3><p>📍 ${escapeHtml(legend.place)}</p><p>${escapeHtml(legend.summary)}</p>${videoId ? `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer">▶ 動画を見る</a>` : ''}</article>`;
    }).join('');
    setupCategoryLinks();
    applyHomeSettings(publicSettings, publishedLegends);
    const { initKochiMap } = await import('./maps.js?v=20260801-4');
    initKochiMap([...publishedLegends, ...posts]);
  } catch (error) {
    console.error(error);
    emptyState.innerHTML = '<b>▶ データベース準備中</b><p>管理者が接続設定を行っています。</p>';
  }
};

function setupCategoryLinks() {
  const buttons = document.querySelectorAll('.category-grid button');
  buttons.forEach(button => {
    const category = button.querySelector('b')?.textContent.trim();
    button.dataset.category = category;
    button.setAttribute('aria-label', `${category}の伝説を見る`);
    button.onclick = () => {
      buttons.forEach(item => item.classList.toggle('active', item === button));
      const cards = [...document.querySelectorAll('#db-legends [data-legend-category]')];
      let visibleCount = 0;
      cards.forEach(card => {
        const visible = card.dataset.legendCategory === category;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      let empty = document.querySelector('#db-legend-filter-empty');
      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'db-legend-filter-empty';
        empty.className = 'db-filter-empty';
        document.querySelector('#db-legends').after(empty);
      }
      empty.hidden = visibleCount > 0;
      empty.textContent = `${category}の伝説は現在準備中です。`;
      document.querySelector('#db-legends').scrollIntoView({ behavior:'smooth', block:'start' });
    };
  });
}

const legendCardHtml = legend => `<article class="legend-card paper"><div class="legend-visual">${legend.image_url ? `<img src="${escapeHtml(legend.image_url)}" alt="${escapeHtml(legend.title)}">` : `<b>${escapeHtml(legend.category?.slice(0,1) || '伝')}</b>`}<span>LEGEND<br>No.${escapeHtml(legend.legend_no || '---')}</span></div><div class="legend-content"><div class="meta"><span>${escapeHtml(legend.category)}</span><span>📍 ${escapeHtml(legend.place)}</span></div><h3>${escapeHtml(legend.title)}</h3><p>${escapeHtml(legend.summary)}</p><span class="card-arrow">→</span></div></article>`;
function applyHomeSettings(settings, publishedLegends) {
  const featured = settings.home_featured || {};
  const today = publishedLegends.find(x => x.id === featured.today_legend_id);
  if (today) {
    document.querySelector('#today-feature-card').innerHTML = `<div class="feature-art" role="img" aria-label="${escapeHtml(today.title)}">${today.image_url ? `<img src="${escapeHtml(today.image_url)}" alt="">` : `<span>${escapeHtml(today.place)}</span>`}<b>${escapeHtml(today.legend_no || '---')}</b></div><div class="feature-body"><div class="meta"><span>${escapeHtml(today.category)}</span><span>📍 ${escapeHtml(today.place)}</span></div><h3>${escapeHtml(today.title)}</h3><p>${escapeHtml(today.summary)}</p>${today.detail_url ? `<a class="feature-link" href="${escapeHtml(today.detail_url)}">▶ この伝説を読む</a>` : ''}</div>`;
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
  const image = data.get('image');
  const submitButton = postForm.querySelector('[type="submit"]');
  const status = document.querySelector('#form-status');
  if (youtube && !getYouTubeId(youtube)) {
    youtubeInput.setCustomValidity('YouTubeの動画URLを入力してください。');
    youtubeInput.reportValidity();
    return;
  }
  youtubeInput.setCustomValidity('');
  if (image?.size > 5 * 1024 * 1024) { status.textContent = '画像は5MB以下にしてください。'; return; }
  if (image?.size && !['image/jpeg','image/png','image/webp'].includes(image.type)) { status.textContent = 'JPEG・PNG・WebP画像を選択してください。'; return; }
  submitButton.disabled = true;
  status.textContent = '送信中…';
  try {
    const imageUrl = image?.size ? await uploadSubmissionImage(image) : null;
    await dbInsert('submissions', {
      place:data.get('place').trim(), legend:data.get('legend').trim(),
      why:data.get('why').trim(), access:data.get('access').trim(),
      youtube:youtube || null, author:data.get('author').trim() || null,
      image_url:imageUrl, status:'pending'
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
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-area]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.querySelector('#area-label').textContent = button.dataset.area;
  document.dispatchEvent(new CustomEvent('kochi-area-change', { detail:{ area:button.dataset.area } }));
}));

loadPublicData();
