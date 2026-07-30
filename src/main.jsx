import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, CalendarDays, Compass, Map, Menu, Search, Sparkles, X } from 'lucide-react';
import './styles.css';

const legends = [
  { no:'001', tag:'食', place:'黒潮町', title:'潮風が育てる、幻の黒糖。', note:'火入れは一年に、ほんの数日。', tone:'sun', icon:'◒' },
  { no:'012', tag:'祭り', place:'香南市', title:'夜空を焦がす、絵金の町。', note:'闇の中でだけ、屏風絵が目を覚ます。', tone:'night', icon:'火' },
  { no:'027', tag:'職人', place:'土佐市', title:'海を渡った、和紙の手ざわり。', note:'千年の流れを、指先ですくう人。', tone:'paper', icon:'紙' },
];

const categories = [
  ['食','うまいは、物語だ。','箸'], ['酒','一献に、土地が宿る。','酉'],
  ['職人','手の中に、時がある。','手'], ['祭り','一年に一度、町が燃える。','火'],
  ['絶景','言葉をなくす、場所へ。','山'], ['人','会うために、旅をする。','人']
];

function App(){
  const [menu, setMenu] = useState(false);
  const [activeArea, setActiveArea] = useState('中央部');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setMenu(false); };
  return <main>
    <nav className="nav">
      <button className="brand" onClick={()=>scrollTo('top')} aria-label="トップへ">
        <span className="brand-mark">伝</span><span>コウチの伝説<small>LEGENDS OF KOCHI</small></span>
      </button>
      <div className="nav-links">
        <button onClick={()=>scrollTo('today')}>今日の伝説</button>
        <button onClick={()=>scrollTo('zukan')}>伝説図鑑</button>
        <button onClick={()=>scrollTo('map')}>地図から探す</button>
        <button onClick={()=>scrollTo('join')}>伝説を教える</button>
      </div>
      <button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="メニュー">{menu?<X/>:<Menu/>}</button>
    </nav>
    {menu && <div className="mobile-menu">
      {['today','zukan','map','join'].map((id,i)=><button key={id} onClick={()=>scrollTo(id)}>{['今日の伝説','伝説図鑑','地図から探す','伝説を教える'][i]}</button>)}
    </div>}

    <header id="top" className="hero">
      <img src="/hero-kochi.png" alt="山と川と海が広がる高知の夜明け" />
      <div className="hero-shade"/>
      <div className="hero-copy">
        <p className="eyebrow"><Compass size={15}/> YOU ARE THE ADVENTURER</p>
        <h1>まだ、誰も知らない<br/><em>高知</em>に出会う。</h1>
        <p className="lead">ここは観光案内所ではない。<br/>人に語りたくなる「伝説」を探す、冒険の入口だ。</p>
        <button className="primary" onClick={()=>scrollTo('today')}>冒険をはじめる <ArrowRight size={18}/></button>
      </div>
      <div className="hero-index"><span>33.5597° N</span><i/><span>133.5311° E</span></div>
      <button className="scroll" onClick={()=>scrollTo('today')}><ArrowDown size={16}/><span>SCROLL TO DISCOVER</span></button>
    </header>

    <section id="today" className="today section">
      <div className="section-kicker"><span>DAILY DISCOVERY</span><i/></div>
      <div className="today-grid">
        <div className="today-title">
          <p>7月28日の発見</p><h2>今日の<br/><strong>伝説。</strong></h2>
          <div className="day-stamp"><CalendarDays/><span>毎日、ひとつ。<br/><b>高知の物語を更新。</b></span></div>
        </div>
        <article className="feature-card">
          <div className="feature-art"><span>四万十の<br/>青のり</span><b>001</b></div>
          <div className="feature-body">
            <div className="meta"><span>食</span><span>📍 四万十市</span></div>
            <h3>川の香りを、<br/>春の食卓へ。</h3>
            <p>一年のうち、いちばん寒い季節。四万十川の河口で、鮮やかな緑がゆらめく。地元の人が待ちわびる、短い旬の物語。</p>
            <button onClick={()=>setSaved(!saved)}>{saved?'冒険手帳に記録しました':'この伝説を読む'} <ArrowRight size={17}/></button>
          </div>
        </article>
      </div>
    </section>

    <section className="latest section">
      <div className="heading-row"><div><p className="eyebrow dark">NEW LEGENDS</p><h2>あたらしい伝説</h2></div><button>すべて見る <ArrowRight size={17}/></button></div>
      <div className="legend-grid">
        {legends.map(l=><article className={`legend-card ${l.tone}`} key={l.no}>
          <div className="legend-visual"><b>{l.icon}</b><span>LEGEND<br/>No.{l.no}</span></div>
          <div className="legend-content"><div className="meta"><span>{l.tag}</span><span>📍 {l.place}</span></div><h3>{l.title}</h3><p>{l.note}</p><ArrowRight className="card-arrow"/></div>
        </article>)}
      </div>
    </section>

    <section id="zukan" className="zukan">
      <div className="section inner">
        <div className="section-kicker light"><span>THE LEGEND ARCHIVES</span><i/></div>
        <div className="zukan-head"><div><h2>伝説図鑑</h2><p>気になる入口から、冒険へ。</p></div><span className="number">036<small>DISCOVERED</small></span></div>
        <div className="category-grid">{categories.map((c,i)=><button key={c[0]} style={{'--delay':`${i*.05}s`}}><span className="category-icon">{c[2]}</span><span><b>{c[0]}</b><small>{c[1]}</small></span><ArrowRight/></button>)}</div>
      </div>
    </section>

    <section id="map" className="map-section section">
      <div className="map-copy">
        <p className="eyebrow dark">EXPLORE THE MAP</p><h2>地図をひらけば、<br/>冒険がはじまる。</h2>
        <p>山を越え、川をくだり、海へ。<br/>場所から、まだ知らない物語を探そう。</p>
        <div className="areas">{['東部','中央部','西部','四万十'].map(a=><button className={activeArea===a?'active':''} onClick={()=>setActiveArea(a)} key={a}>{a}<small>{a==='東部'?'8':a==='中央部'?'14':a==='西部'?'6':'8'} LEGENDS</small></button>)}</div>
      </div>
      <div className="map-art" aria-label={`高知県 ${activeArea} の伝説を表示中`}>
        <div className="map-shape">
          {[['室戸岬','84%','29%'],['高知市','49%','31%'],['仁淀川','38%','48%'],['四万十','17%','70%']].map((p,i)=><button key={p[0]} className={(activeArea==='東部'&&i===0)||(activeArea==='中央部'&&(i===1||i===2))||(activeArea==='四万十'&&i===3)?'hot':''} style={{left:p[1],top:p[2]}}><i/><span>{p[0]}</span></button>)}
        </div>
        <div className="map-legend"><Map size={18}/><span>選択中：<b>{activeArea}</b></span></div>
      </div>
    </section>

    <section className="season">
      <div className="season-copy"><p className="eyebrow">SEASONAL LEGEND / SUMMER</p><h2>夏は、<br/>一瞬で過ぎてゆく。</h2><p>今だけ会える伝説を、見逃さないように。</p><button>夏の伝説を探す <ArrowRight size={18}/></button></div>
      <div className="fireflies">{[1,2,3,4,5,6,7,8].map(i=><i key={i}/>)}</div>
    </section>

    <section id="join" className="join section">
      <div className="join-mark"><Sparkles/><span>いいもの<br/>ファンクラブ</span></div>
      <p className="eyebrow dark">JOIN THE QUEST</p><h2>あなたの「誰かに教えたい」を、<br/>次の伝説に。</h2><p>有名じゃなくていい。ランキングも、点数もない。<br/>あなたの心に残った高知を、私たちに教えてください。</p>
      <button onClick={()=>alert('投稿フォームは次の開発フェーズで公開予定です。')}>伝説を教える <ArrowRight size={18}/></button>
    </section>
    <footer><div className="footer-brand"><span className="brand-mark">伝</span><div><b>コウチの伝説</b><small>まだ、誰も知らない高知に出会う。</small></div></div><p>高知で一番ワクワクする冒険メディアを目指して。</p><span>© 2026 LEGENDS OF KOCHI</span></footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>);
