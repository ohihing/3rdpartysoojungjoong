/**
 * [실시간 1년 필터 버전] 원본 페이지용
 */
const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y';
const SHEET_NAME = '마스터_DB';
const JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

let allBooks = [];
let currentChannel = 'yes24';
let currentPage = 'dashboard';

async function init() {
    localStorage.clear(); // 찌꺼기 제거
    const updateEl = document.getElementById('update-time');
    updateEl.innerText = "🔄 신간 데이터를 실시간으로 불러오는 중...";
    
    try {
        const response = await fetch(JSON_URL);
        const text = await response.text();
        
        // 데이터 구조 추출
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("시트 데이터 형식이 올바르지 않습니다.");
        
        const jsonData = JSON.parse(text.substring(start, end + 1));
        
        allBooks = jsonData.table.rows.map(row => {
            const c = row.c;
            return {
                title: c[0] ? String(c[0].v) : "",
                openDateStr: c[3] ? String(c[3].f || c[3].v).replace('등록', '').trim() : "", 
                openDate: c[3] ? parseGoogleDate(c[3].v) : null,
                yes_cur: parseVal(c[6]), yes_day: parseVal(c[8]), yes_week: parseVal(c[10]), yes_month: parseVal(c[12]),
                ala_cur: parseVal(c[13]), ala_day: parseVal(c[15]), ala_week: parseVal(c[17]), ala_month: parseVal(c[19]),
                img: c[20] ? String(c[20].v) : ""
            };
        }).filter(b => b.title && b.title !== "null");

        render();
        updateTimestamp();
    } catch (e) { 
        console.error("데이터 로드 실패:", e);
        updateEl.innerHTML = `<span style="color:#eb4d4b;">⚠️ 로드 실패: 시트 이름이나 컬럼을 확인해주세요.</span>`;
    }
}

function updateTimestamp() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
    let formatted = formatter.format(now).replace(/\. /g, '. ').trim();
    document.getElementById('update-time').innerText = `최근 업데이트: ${formatted} (실시간)`;
}

function getStat(val) {
    if (isNaN(val)) return { s: '-', c: 'val-no-change' };
    if (val === 0) return { s: '-0', c: 'val-no-change' };
    return { s: (val > 0 ? '↑' : '↓') + ' ' + Math.abs(val).toLocaleString(), c: val > 0 ? 'val-rise' : 'val-fall' };
}

function parseGoogleDate(d) {
    const m = String(d).match(/Date\((\d+),(\d+),(\d+)\)/);
    return m ? new Date(m[1], m[2], m[3]) : new Date(d);
}

function parseVal(cell) {
    if (!cell || cell.v === null || cell.v === "집계중") return NaN;
    return typeof cell.v === 'number' ? cell.v : Number(String(cell.v).replace(/,/g, ''));
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
}

function showPage(page) {
    currentPage = page;
    document.getElementById('page-title').innerHTML = page === 'dashboard' ? '출판콘텐츠사업단 <span>신간 판매 현황</span>' : '신간 <span>판매지수 현황</span>';
    document.getElementById('dashboard-view').style.display = page === 'dashboard' ? 'block' : 'none';
    document.getElementById('stock-view').style.display = page === 'stock' ? 'block' : 'none';
    if(document.getElementById('sidebar').classList.contains('open')) toggleMenu();
    render();
}

function switchChannel(channel) {
    currentChannel = channel;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.innerText.includes(channel === 'yes24' ? '예스' : '알라딘')));
    render();
}

function render() {
    const isYes = currentChannel === 'yes24';
    const prefix = isYes ? 'yes' : 'ala';
    
    // [확인] 1년(365일) 이내 출간 도서만 필터링
    const fresh = allBooks.filter(b => b.openDate && (new Date() - b.openDate) < 365*24*60*60*1000);

    if (currentPage === 'dashboard') {
        const view = document.getElementById('dashboard-view');
        view.innerHTML = '';
        if (fresh.length === 0) {
            view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">최근 1년 이내 등록된 도서가 없습니다.</p>';
            return;
        }
        const configs = [
            { t: '1. 현재 판매지수 Best 10', k: `${prefix}_cur`, type: 'abs', p: '현재', l: 10 },
            { t: '2. 작일 대비 상승 Best 5', k: `${prefix}_day`, type: 'rise', p: '어제', l: 5 },
            { t: '3. 작일 대비 하락 도서 5권', k: `${prefix}_day`, type: 'fall', p: '어제', l: 5 },
            { t: '4. 최근 1주일 상승 Best 5', k: `${prefix}_week`, type: 'rise', p: '1주일', l: 5 },
            { t: '5. 최근 1주일 하락 도서 5권', k: `${prefix}_week`, type: 'fall', p: '1주일', l: 5 },
            { t: '6. 최근 1달 상승 Best 5', k: `${prefix}_month`, type: 'rise', p: '한달', l: 5 },
            { t: '7. 최근 1달 하락 도서 5권', k: `${prefix}_month`, type: 'fall', p: '한달', l: 5 }
        ];
        
        let lastP = "";
        configs.forEach(conf => {
            let data = fresh.filter(b => !isNaN(b[conf.k]));
            if (conf.type === 'rise') data = data.filter(b => b[conf.k] > 0);
            if (conf.type === 'fall') data = data.filter(b => b[conf.k] < 0);
            data.sort((a,b) => conf.type === 'fall' ? a[conf.k]-b[conf.k] : b[conf.k]-a[conf.k]);
            data = data.slice(0, conf.l);
            
            if (data.length > 0) {
                if (conf.p !== lastP) {
                    view.innerHTML += `<div class="period-divider"><span class="period-badge">${conf.p}</span><div class="period-line"></div></div>`;
                    lastP = conf.p;
                }
                let html = `<section><div class="section-title ${conf.type}">${conf.t}</div>`;
                data.forEach((b, i) => {
                    const res = getStat(b[conf.k]);
                    const valStr = conf.type === 'abs' ? (b[conf.k] ? b[conf.k].toLocaleString() : '0') : res.s;
                    html += `<div class="book-card"><div class="rank">${i+1}</div><img src="${b.img}" class="book-img" onerror="this.src='https://via.placeholder.com/45x65'"><div class="book-info"><div class="book-title">${b.title}</div><div class="book-val ${conf.type==='abs'?'':res.c}">${valStr}</div></div></div>`;
                });
                view.innerHTML += html + `</section>`;
            }
        });
    } else {
        const view = document.getElementById('stock-view');
        view.innerHTML = '';
        if (fresh.length === 0) {
            view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">표시할 데이터가 없습니다.</p>';
            return;
        }
        fresh.sort((a,b) => b.openDate - a.openDate).forEach((b, i) => {
            const d = getStat(b[`${prefix}_day`]), w = getStat(b[`${prefix}_week`]), m = getStat(b[`${prefix}_month`]);
            view.innerHTML += `<div class="stock-item"><div class="rank">${i+1}</div><div class="book-info"><div class="stock-title">${b.title}</div><div class="stock-date">${b.openDateStr}</div></div><div class="stock-val">${isNaN(b[`${prefix}_cur`]) ? '-' : b[`${prefix}_cur`].toLocaleString()}</div><div class="stock-change-group"><div class="stock-sub-val ${d.c}">${d.s}</div><div class="stock-sub-val" style="font-size:0.6rem; color:#999">주 ${w.s} | 월 ${m.s}</div></div></div>`;
        });
    }
}

init();
