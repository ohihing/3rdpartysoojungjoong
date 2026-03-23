// [v4] 데이터 증발 방지 및 강제 새로고침 기능 추가
const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y'; // 수정용 시트 ID로 확인해주세요
const SHEET_NAME = '마스터_DB';
const JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

let allBooks = [];
let currentChannel = 'yes24';
let currentPage = 'dashboard';

const CACHE_KEY = 'book_sales_data_v4';
const CACHE_TIME_KEY = 'book_sales_timestamp_v4';

async function init(isForce = false) {
    const nowSeoul = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const savedData = localStorage.getItem(CACHE_KEY);
    const lastUpdateTimestamp = localStorage.getItem(CACHE_TIME_KEY);

    const seoul7AM = new Date(nowSeoul);
    seoul7AM.setHours(7, 0, 0, 0);

    let needFetch = isForce; // 강제 새로고침 시 무조건 페치

    if (!isForce) {
        if (!savedData || !lastUpdateTimestamp) {
            needFetch = true;
        } else {
            try {
                const lastFetchSeoul = new Date(new Date(parseInt(lastUpdateTimestamp)).toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
                if (nowSeoul > seoul7AM && lastFetchSeoul < seoul7AM) {
                    needFetch = true;
                } else {
                    allBooks = JSON.parse(savedData);
                    // 데이터가 비어있다면 강제로 다시 가져옴
                    if (!allBooks || allBooks.length === 0) needFetch = true;
                    else needFetch = false;
                }
            } catch (e) { needFetch = true; }
        }
    }

    if (!needFetch) {
        render();
        updateTimestamp(true, lastUpdateTimestamp);
    } else {
        await fetchData();
    }
}

async function fetchData() {
    console.log("📡 시트에서 데이터를 가져옵니다...");
    try {
        const response = await fetch(JSON_URL);
        const text = await response.text();
        
        // 구글 시트 데이터가 정상적인지 확인 (로그인 페이지 방지)
        if (text.includes("<!DOCTYPE html>") || !text.includes("google.visualization")) {
            throw new Error("시트 권한이 없거나 주소가 잘못되었습니다.");
        }

        const jsonData = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        
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

        if (allBooks.length === 0) throw new Error("가져온 데이터가 0건입니다.");

        localStorage.setItem(CACHE_KEY, JSON.stringify(allBooks));
        localStorage.setItem(CACHE_TIME_KEY, new Date().getTime().toString());

        render();
        updateTimestamp(false, new Date().getTime());
    } catch (e) { 
        console.error(e);
        document.getElementById('update-time').innerHTML = `<span style="color:#eb4d4b">⚠️ ${e.message}</span>`;
    }
}

// 강제 새로고침 함수 (UI에서 호출 가능)
function forceRefresh() {
    const btn = document.getElementById('update-time');
    btn.innerText = "새로고침 중...";
    init(true);
}

function updateTimestamp(isCached, timestamp) {
    const date = new Date(parseInt(timestamp));
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
    let formatted = formatter.format(date).replace(/\. /g, '. ').trim();
    const label = isCached ? "(저장됨)" : "(최신)";
    // 클릭하면 새로고침되는 기능 추가
    document.getElementById('update-time').innerHTML = `최근 업데이트: ${formatted} ${label} <span onclick="forceRefresh()" style="cursor:pointer; text-decoration:underline; margin-left:10px;">[강제새로고침]</span>`;
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
    
    // [수정] 필터링 조건 완화: 날짜가 없어도 표시되게 하거나 기간을 늘림
    // 현재는 등록일 기준 2년 이내 도서로 넉넉하게 잡았습니다.
    const fresh = allBooks.filter(b => b.openDate && (new Date() - b.openDate) < 730*24*60*60*1000);

    if (currentPage === 'dashboard') {
        const view = document.getElementById('dashboard-view');
        view.innerHTML = '';
        if (fresh.length === 0) {
            view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">표시할 도서 데이터가 없습니다.<br>시트의 등록 날짜를 확인해주세요.</p>';
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
            view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">표시할 도서 데이터가 없습니다.</p>';
            return;
        }
        fresh.sort((a,b) => b.openDate - a.openDate).forEach((b, i) => {
            const d = getStat(b[`${prefix}_day`]), w = getStat(b[`${prefix}_week`]), m = getStat(b[`${prefix}_month`]);
            view.innerHTML += `<div class="stock-item"><div class="rank">${i+1}</div><div class="book-info"><div class="stock-title">${b.title}</div><div class="stock-date">${b.openDateStr}</div></div><div class="stock-val">${isNaN(b[`${prefix}_cur`]) ? '-' : b[`${prefix}_cur`].toLocaleString()}</div><div class="stock-change-group"><div class="stock-sub-val ${d.c}">${d.s}</div><div class="stock-sub-val" style="font-size:0.6rem; color:#999">주 ${w.s} | 월 ${m.s}</div></div></div>`;
        });
    }
}

init();
