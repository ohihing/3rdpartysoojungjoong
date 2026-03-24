/**
 * [V6 최종] 마스터_DB + 서점별 판매 부수 실시간 병합 대시보드
 */

const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y';
const MASTER_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('마스터_DB')}&range=A2:U`;
const SALES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('서점별 판매 부수')}&range=A2:L`;

let allBooks = [];
let currentChannel = 'yes24';
let currentPage = 'dashboard';
let p2ViewMode = 'index';

async function init() {
    localStorage.clear();
    document.getElementById('update-time').innerText = "🔄 시트 데이터를 병합하여 분석 중입니다...";
    
    try {
        // 1. 두 시트 동시 호출
        const [masterRes, salesRes] = await Promise.all([
            fetch(MASTER_URL).then(res => res.text()),
            fetch(SALES_URL).then(res => res.text())
        ]);

        const masterRows = parseSheetData(masterRes);
        const salesRows = parseSheetData(salesRes);

        // 2. 판매량 데이터 ISBN 맵 생성
        const salesMap = new Map();
        salesRows.forEach(r => {
            const isbn = String(r.c[3]?.v || "").trim(); // D열 ISBN
            if (isbn) {
                salesMap.set(isbn, {
                    yes_day: parseVal(r.c[4]), ala_day: parseVal(r.c[5]),
                    yes_week: parseVal(r.c[6]), ala_week: parseVal(r.c[7]),
                    yes_month: parseVal(r.c[8]), ala_month: parseVal(r.c[9]),
                    yes_total: parseVal(r.c[10]), ala_total: parseVal(r.c[11])
                });
            }
        });

        // 3. 마스터 데이터와 결합
        allBooks = masterRows.map(m => {
            const isbn = String(m.c[2]?.v || "").trim(); // C열 ISBN
            const s = salesMap.get(isbn) || { yes_day:0, ala_day:0, yes_week:0, ala_week:0, yes_month:0, ala_month:0, yes_total:0, ala_total:0 };
            
            return {
                title: m.c[0] ? String(m.c[0].v) : "",
                openDate: m.c[3] ? parseGoogleDate(m.c[3].v) : null,
                openDateStr: m.c[3] ? String(m.c[3].f || m.c[3].v) : "",
                img: m.c[20] ? String(m.c[20].v) : "",
                // 예스 지수 (G, I, K, M)
                yes_cur: parseVal(m.c[6]), yes_idx_day: parseVal(m.c[8]), yes_idx_week: parseVal(m.c[10]), yes_idx_month: parseVal(m.c[12]),
                // 알라딘 지수 (N, P, R, T)
                ala_cur: parseVal(m.c[13]), ala_idx_day: parseVal(m.c[15]), ala_idx_week: parseVal(m.c[17]), ala_idx_month: parseVal(m.c[19]),
                ...s
            };
        }).filter(b => b.title && b.title !== "null");

        render();
        updateTimestamp();
    } catch (e) {
        console.error(e);
        document.getElementById('update-time').innerText = "⚠️ 데이터 병합 오류 (시트 공유 확인 필요)";
    }
}

function parseSheetData(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1)).table.rows;
}

// ------------------------- [렌더링 로직] -------------------------

function render() {
    const isYes = currentChannel === 'yes24';
    const p = isYes ? 'yes' : 'ala';
    
    // 출간 1년 이내 필터
    const fresh = allBooks.filter(b => b.openDate && (new Date() - b.openDate) < 365*24*60*60*1000);

    if (currentPage === 'dashboard') {
        renderDashboard(fresh, p);
    } else {
        renderStockList(fresh, p);
    }
}

// [페이지 1] 종합 대시보드
function renderDashboard(data, p) {
    const view = document.getElementById('dashboard-view');
    let html = '';

    // 1. 현재 판매 Best 10
    const top10 = [...data].sort((a,b) => b[`${p}_cur`] - a[`${p}_cur`]).slice(0, 10);
    html += `<div class="section-wrapper"><div class="section-title sales">🏆 1. 현재 판매 Best 10 (출간 1년 내)</div>`;
    top10.forEach((b, i) => {
        html += makeBookCard(i+1, b, `${p}_cur`, `${p}_total`, '현재지수', '누적판매');
    });
    html += `</div>`;

    // 기간별 (어제, 주간, 월간)
    const periods = [
        { name: '어제', key: 'day', badge: 'TODAY', no: 2 },
        { name: '주간', key: 'week', badge: 'WEEKLY', no: 3 },
        { name: '월간', key: 'month', badge: 'MONTHLY', no: 4 }
    ];

    periods.forEach(pd => {
        html += `<div class="period-divider"><span class="period-badge">${pd.badge}</span><div class="period-line"></div></div>`;
        
        // 상승 Best 5
        const rise = [...data].filter(b => b[`${p}_idx_${pd.key}`] > 0).sort((a,b) => b[`${p}_idx_${pd.key}`] - a[`${p}_idx_${pd.key}`]).slice(0, 5);
        if (rise.length > 0) {
            html += `<div class="section-wrapper"><div class="section-title rise">📈 ${pd.no}. ${pd.name} 지수 상승 Best 5</div>`;
            rise.forEach((b, i) => html += makeComplexCard(i+1, b, `${p}_idx_${pd.key}`, `${p}_cur`, `${p}_${pd.key}`, pd.name));
            html += `</div>`;
        }

        // 판매 Best 5
        const sales = [...data].filter(b => b[`${p}_${pd.key}`] > 0).sort((a,b) => b[`${p}_${pd.key}`] - a[`${p}_${pd.key}`]).slice(0, 5);
        if (sales.length > 0) {
            html += `<div class="section-wrapper"><div class="section-title sales">💰 ${pd.no}. ${pd.name} 판매량 Best 5</div>`;
            sales.forEach((b, i) => html += makeBookCard(i+1, b, `${p}_${pd.key}`, `${p}_cur`, '판매량', '현재지수', true));
            html += `</div>`;
        }

        // 하락 5권
        const fall = [...data].filter(b => b[`${p}_idx_${pd.key}`] < 0).sort((a,b) => a[`${p}_idx_${pd.key}`] - b[`${p}_idx_${pd.key}`]).slice(0, 5);
        if (fall.length > 0) {
            html += `<div class="section-wrapper"><div class="section-title fall">📉 ${pd.no}. ${pd.name} 지수 하락 도서</div>`;
            fall.forEach((b, i) => html += makeBookCard(i+1, b, `${p}_idx_${pd.key}`, `${p}_cur`, '지수하락', '현재지수'));
            html += `</div>`;
        }
    });

    view.innerHTML = html;
}

// [페이지 2] 신간 현황
function renderStockList(data, p) {
    const content = document.getElementById('stock-list-content');
    const sorted = [...data].sort((a,b) => b.openDate - a.openDate);
    
    let html = '<div class="stock-list-wrapper">';
    sorted.forEach((b, i) => {
        const d = getStat(b[`${p}_idx_day`]), w = getStat(b[`${p}_idx_week`]), m = getStat(b[`${p}_idx_month`]);
        const s_d = b[`${p}_day`], s_t = b[`${p}_total`];
        
        let dataHtml = p2ViewMode === 'index' ? 
            `<div class="stock-val-group"><div class="stock-main-val">${b[`${p}_cur`].toLocaleString()}</div><div class="stock-change ${d.c}">${d.s}</div></div>
             <div class="stock-val-group"><div class="stock-sub-val ${w.c}">주 ${w.s}</div><div class="stock-sub-val ${m.c}">월 ${m.s}</div></div>` :
            `<div class="stock-val-group"><div class="stock-main-val">${s_d.toLocaleString()}권</div><div class="stock-change">어제 판매</div></div>
             <div class="stock-val-group"><div class="stock-main-val">총 ${s_t.toLocaleString()}</div><div class="stock-sub-val">누적판매</div></div>`;

        html += `<div class="stock-item"><div class="rank">${i+1}</div><div class="book-info"><div class="stock-title">${b.title}</div><div class="stock-date">${b.openDateStr}</div></div>${dataHtml}</div>`;
    });
    content.innerHTML = html + '</div>';
}

// --- 유틸리티 ---

function makeBookCard(rank, b, mainK, subK, mainL, subL, isQty = false) {
    const mainV = b[mainK];
    const stat = (mainL.includes('지수') || mainL === '지수하락') ? getStat(mainV) : {s: mainV.toLocaleString() + (isQty?'권':''), c:''};
    return `<div class="book-card"><div class="rank">${rank}</div><img src="${b.img}" class="book-img" onerror="this.src='https://via.placeholder.com/48x70'"><div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${b.openDateStr} 등록</div></div><div class="highlight-val"><div class="main-val ${mainL==='지수하락'?'val-fall':stat.c}">${stat.s}</div><div class="sub-val">${subL}: ${b[subK].toLocaleString()}${subL.includes('판매')?'권':''}</div></div></div>`;
}

function makeComplexCard(rank, b, riseK, curK, qtyK, pdN) {
    const stat = getStat(b[riseK]);
    return `<div class="book-card"><div class="rank">${rank}</div><img src="${b.img}" class="book-img"><div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">지수 <span class="${stat.c}">${stat.s}</span> (${b[curK].toLocaleString()})</div></div><div class="highlight-val"><div class="main-val" style="color:#f39c12">${b[qtyK].toLocaleString()}권</div><div class="sub-val">${pdN} 판매량</div></div></div>`;
}

function getStat(v) {
    if (isNaN(v) || v === null) return { s: '-', c: '' };
    if (v === 0) return { s: '0', c: '' };
    return { s: (v > 0 ? '↑ ' : '↓ ') + Math.abs(v).toLocaleString(), c: v > 0 ? 'val-rise' : 'val-fall' };
}

function parseVal(c) { return (c && typeof c.v === 'number') ? c.v : 0; }
function parseGoogleDate(d) { const m = String(d).match(/Date\((\d+),(\d+),(\d+)\)/); return m ? new Date(m[1], m[2], m[3]) : new Date(d); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); }
function showPage(p) { currentPage = p; render(); toggleMenu(); }
function switchChannel(c) { currentChannel = c; document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0 && c==='yes24') || (i===1 && c==='aladin'))); render(); }
function switchP2View(m) { p2ViewMode = m; document.querySelectorAll('.switch-btn').forEach((b,i) => b.classList.toggle('active', (i===0 && m==='index') || (i===1 && m==='sales'))); render(); }
function updateTimestamp() { document.getElementById('update-time').innerText = `최근 업데이트: ${new Date().toLocaleString()} (실시간 병합)`; }

init();
