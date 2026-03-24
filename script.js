/**
 * [V8 최종] 마스터 DB + 판매량 데이터 실시간 병합 및 정렬 대시보드
 */

const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y';
// URL에 직접 쿼리를 날려 데이터를 가져옵니다.
const MASTER_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('마스터_DB')}&range=A2:U`;
const SALES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('서점별 판매 부수')}&range=A2:L`;

let allBooks = [];
let currentChannel = 'yes24';
let currentPage = 'dashboard';
let p2ViewMode = 'index'; 
let best10Sort = 'index'; // 'index' or 'sales'

async function init() {
    localStorage.clear();
    document.getElementById('update-time').innerText = "🔄 판매 데이터를 ISBN 매칭 중입니다...";
    
    try {
        const [mText, sText] = await Promise.all([
            fetch(MASTER_URL).then(res => res.text()),
            fetch(SALES_URL).then(res => res.text())
        ]);

        const masterData = parseGviz(mText);
        const salesData = parseGviz(sText);

        // [핵심] 판매량 맵 생성 - ISBN을 다양한 형식으로 변환하여 매칭 확률 증대
        const sMap = new Map();
        salesData.forEach(row => {
            const isbn = normalizeISBN(row.c[3]?.v); // D열 ISBN
            if (isbn) {
                sMap.set(isbn, {
                    y_d: parseVal(row.c[4]), a_d: parseVal(row.c[5]), // E, F
                    y_w: parseVal(row.c[6]), a_w: parseVal(row.c[7]), // G, H
                    y_m: parseVal(row.c[8]), a_m: parseVal(row.c[9]), // I, J
                    y_t: parseVal(row.c[10]), a_t: parseVal(row.c[11]) // K, L
                });
            }
        });

        // 데이터 병합
        allBooks = masterData.map(m => {
            const isbn = normalizeISBN(m.c[2]?.v); // C열 ISBN
            const s = sMap.get(isbn) || { y_d:0, a_d:0, y_w:0, a_w:0, y_m:0, a_m:0, y_t:0, a_t:0 };
            
            return {
                title: m.c[0] ? String(m.c[0].v) : "",
                openDate: m.c[3] ? parseGoogleDate(m.c[3].v) : null,
                openDateStr: m.c[3] ? String(m.c[3].f || m.c[3].v) : "",
                img: m.c[20] ? String(m.c[20].v) : "",
                // 지수 데이터 (마스터 DB)
                y_idx_c: parseVal(m.c[6]), y_idx_d: parseVal(m.c[8]), y_idx_w: parseVal(m.c[10]), y_idx_m: parseVal(m.c[12]),
                a_idx_c: parseVal(m.c[13]), a_idx_d: parseVal(m.c[15]), a_idx_w: parseVal(m.c[17]), a_idx_m: parseVal(m.c[19]),
                ...s
            };
        }).filter(b => b.title && b.title !== "null");

        render();
        updateTimestamp();
    } catch (e) {
        console.error(e);
        document.getElementById('update-time').innerText = "⚠️ 데이터 로드 중 오류가 발생했습니다.";
    }
}

// ISBN 정규화: 숫자, 지수표현, 문자열 모두 일반 문자열로 통일
function normalizeISBN(val) {
    if (!val) return null;
    let s = String(val).trim();
    if (s.includes('E+')) s = Number(s).toFixed(0); // 지수 형태 방지
    return s.replace(/[^0-9X]/gi, ''); // 숫자만 남김
}

function parseGviz(text) {
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1)).table.rows;
}

function render() {
    const isYes = currentChannel === 'yes24';
    const p = isYes ? 'y' : 'a';
    const fresh = allBooks.filter(b => b.openDate && (new Date() - b.openDate) < 365*24*60*60*1000);

    if (currentPage === 'dashboard') {
        renderDashboard(fresh, p);
    } else {
        renderStockList(fresh, p);
    }
}

// [메뉴 1] 종합 대시보드 렌더링
function renderDashboard(data, p) {
    const view = document.getElementById('dashboard-view');
    view.innerHTML = '';

    // 섹션 1. 현재 판매 Best 10 (정렬 기능)
    let top10 = [...data].sort((a,b) => best10Sort === 'index' ? b[`${p}_idx_c`] - a[`${p}_idx_c`] : b[`${p}_t`] - a[`${p}_t`]);
    top10 = top10.slice(0, 10);

    let html = `
        <div class="section-wrapper">
            <div class="section-header">
                <div class="section-title title-best">🏆 1. 현재 판매 Best 10</div>
                <select class="sort-select" onchange="changeBestSort(this.value)">
                    <option value="index" ${best10Sort==='index'?'selected':''}>지수순 정렬</option>
                    <option value="sales" ${best10Sort==='sales'?'selected':''}>누적판매순 정렬</option>
                </select>
            </div>`;
    top10.forEach((b, i) => html += makeCard(i+1, b, `${p}_idx_c`, `${p}_t`, '현재지수', '누적판매'));
    html += `</div>`;

    // 섹션 2, 3, 4 (어제, 주간, 월간)
    const periods = [
        { n: '어제', k: 'd', b: 'TODAY', no: 2 },
        { n: '주간', k: 'w', b: 'WEEKLY', no: 3 },
        { n: '월간', k: 'm', b: 'MONTHLY', no: 4 }
    ];

    periods.forEach(pd => {
        html += `<div class="period-divider"><span class="period-badge">${pd.b}</span><div class="period-line"></div></div>`;
        
        // A. 지수 상승 & 판매량 (병합 섹션)
        const rise = [...data].filter(b => b[`${p}_idx_${pd.k}`] > 0).sort((a,b) => b[`${p}_idx_${pd.k}`] - a[`${p}_idx_${pd.k}`]).slice(0, 5);
        const bestQty = [...data].filter(b => b[`${p}_${pd.k}`] > 0).sort((a,b) => b[`${p}_${pd.k}`] - a[`${p}_${pd.k}`]).slice(0, 5);

        html += `<div class="section-wrapper">
                    <div class="section-title title-rise">📈 ${pd.no}. ${pd.n} 지수 상승 / 판매량 Best 5</div>`;
        rise.forEach((b, i) => html += makeComplexCard(i+1, b, `${p}_idx_${pd.k}`, `${p}_idx_c`, `${p}_${pd.k}`, pd.n));
        html += `</div>`;

        // B. 지수 하락 (하단에 녹임)
        const fall = [...data].filter(b => b[`${p}_idx_${pd.k}`] < 0).sort((a,b) => a[`${p}_idx_${pd.k}`] - b[`${p}_idx_${pd.k}`]).slice(0, 5);
        if (fall.length > 0) {
            html += `<div class="section-wrapper">
                        <div class="section-title title-fall">📉 ${pd.no}. ${pd.n} 지수 하락 도서 Top 5</div>`;
            fall.forEach((b, i) => html += makeCard(i+1, b, `${p}_idx_${pd.k}`, `${p}_idx_c`, '지수하락', '현재지수'));
            html += `</div>`;
        }
    });

    view.innerHTML = html;
}

// [메뉴 2] 신간 판매 현황 렌더링 (등록일 순)
function renderStockList(data, p) {
    const content = document.getElementById('stock-list-content');
    const sorted = [...data].sort((a,b) => b.openDate - a.openDate); // 최신 등록일순
    
    let html = '<div class="stock-list-wrapper">';
    sorted.forEach((b, i) => {
        const d = getStat(b[`${p}_idx_d`]), w = getStat(b[`${p}_idx_w`]), m = getStat(b[`${p}_idx_m`]);
        let dataHtml = p2ViewMode === 'index' ? 
            `<div class="stock-val-group"><div class="stock-main-val">${b[`${p}_idx_c`].toLocaleString()}</div><div class="stock-change ${d.c}">${d.s}</div></div>
             <div class="stock-val-group"><div class="stock-sub-val ${w.c}">주 ${w.s}</div><div class="stock-sub-val ${m.c}">월 ${m.s}</div></div>` :
            `<div class="stock-val-group"><div class="stock-main-val">${b[`${p}_d`].toLocaleString()}권</div><div class="stock-change">어제 판매</div></div>
             <div class="stock-val-group"><div class="stock-main-val">총 ${b[`${p}_t`].toLocaleString()}권</div><div class="stock-sub-val">누적부수</div></div>`;

        html += `<div class="stock-item"><div class="rank">${i+1}</div><div class="book-info"><div class="stock-title">${b.title}</div><div class="stock-date">${b.openDateStr}</div></div>${dataHtml}</div>`;
    });
    content.innerHTML = html + '</div>';
}

// --- 유틸리티 및 UI 제어 ---

function makeCard(rank, b, mainK, subK, mainL, subL) {
    const mainV = b[mainK];
    const stat = (mainL.includes('지수') || mainL === '지수하락') ? getStat(mainV) : {s: mainV.toLocaleString() + '권', c:''};
    return `<div class="book-card"><div class="rank">${rank}</div><img src="${b.img}" class="book-img" onerror="this.src='https://via.placeholder.com/48x70'"><div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${b.openDateStr} 등록</div></div><div class="highlight-val"><div class="main-val ${mainL==='지수하락'?'val-fall':stat.c}">${stat.s}</div><div class="sub-val">${subL}: ${b[subK].toLocaleString()}${subL.includes('판매')||subL==='누적판매'?'권':''}</div></div></div>`;
}

function makeComplexCard(rank, b, riseK, curK, qtyK, pdN) {
    const stat = getStat(b[riseK]);
    return `<div class="book-card"><div class="rank">${rank}</div><img src="${b.img}" class="book-img"><div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">지수 <span class="${stat.c}">${stat.s}</span> (${b[curK].toLocaleString()})</div></div><div class="highlight-val"><div class="main-val" style="color:var(--gold)">${b[qtyK].toLocaleString()}권</div><div class="sub-val">${pdN} 판매량</div></div></div>`;
}

function getStat(v) {
    if (isNaN(v) || v === null) return { s: '-', c: '' };
    if (v === 0) return { s: '0', c: '' };
    return { s: (v > 0 ? '↑ ' : '↓ ') + Math.abs(v).toLocaleString(), c: v > 0 ? 'val-rise' : 'val-fall' };
}
function parseVal(c) { return (c && typeof c.v === 'number') ? c.v : 0; }
function parseGoogleDate(d) { const m = String(d).match(/Date\((\d+),(\d+),(\d+)\)/); return m ? new Date(m[1], m[2], m[3]) : new Date(d); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); }
function showPage(p) { currentPage = p; document.getElementById('m-dash').classList.toggle('active', p==='dashboard'); document.getElementById('m-stock').classList.toggle('active', p==='stock'); document.getElementById('page-title').innerHTML = p==='dashboard'?'출판콘텐츠사업단 <span>통합 판매 대시보드</span>':'출판콘텐츠사업단 <span>신간 판매 현황</span>'; document.getElementById('dashboard-view').style.display = p==='dashboard'?'block':'none'; document.getElementById('stock-view').style.display = p==='dashboard'?'none':'block'; toggleMenu(); render(); }
function switchChannel(c) { currentChannel = c; document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0 && c==='yes24') || (i===1 && c==='aladin'))); render(); }
function switchP2View(m) { p2ViewMode = m; document.getElementById('s-idx').classList.toggle('active', m==='index'); document.getElementById('s-qty').classList.toggle('active', m==='sales'); render(); }
function changeBestSort(v) { best10Sort = v; render(); }
function updateTimestamp() { document.getElementById('update-time').innerText = `최근 업데이트: ${new Date().toLocaleString()} (판매량 매칭 완료)`; }

init();
