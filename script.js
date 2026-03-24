/**
 * [V2: 디테일 수정본] 판매지수 & 판매량 듀얼 대시보드
 */
const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y';
const MASTER_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('마스터_DB')}`;
const SALES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('서점별 판매 부수')}`;

let allBooks = [];
let currentChannel = 'yes24';
let currentMetric = 'index'; 
let currentPage = 'dashboard';

async function init() {
    try {
        const [masterRes, salesRes] = await Promise.all([
            fetch(MASTER_URL).then(r => r.text()),
            fetch(SALES_URL).then(r => r.text())
        ]);
        
        const masterData = parseGviz(masterRes);
        const salesData = parseGviz(salesRes);

        const salesMap = new Map();
        salesData.forEach(r => {
            const titleKey = String(r.c[0]?.v || "").trim().replace(/\s+/g, '');
            if (titleKey) {
                salesMap.set(titleKey, {
                    y_qty_d: parseVal(r.c[4]), a_qty_d: parseVal(r.c[5]),
                    y_qty_w: parseVal(r.c[6]), a_qty_w: parseVal(r.c[7]),
                    y_qty_m: parseVal(r.c[8]), a_qty_m: parseVal(r.c[9]),
                    y_qty_t: parseVal(r.c[10]), a_qty_t: parseVal(r.c[11])
                });
            }
        });
        
        allBooks = masterData.map(row => {
            const c = row.c;
            const title = c[0] ? String(c[0].v) : "";
            const titleKey = title.trim().replace(/\s+/g, '');
            const sales = salesMap.get(titleKey) || { y_qty_d:0, a_qty_d:0, y_qty_w:0, a_qty_w:0, y_qty_m:0, a_qty_m:0, y_qty_t:0, a_qty_t:0 };

            return {
                title: title,
                openDateStr: c[3] ? String(c[3].f || c[3].v).replace('등록', '').trim() : "", 
                openDate: c[3] ? parseGoogleDate(c[3].v) : null,
                yes_cur: parseVal(c[6]), yes_day: parseVal(c[8]), yes_week: parseVal(c[10]), yes_month: parseVal(c[12]),
                ala_cur: parseVal(c[13]), ala_day: parseVal(c[15]), ala_week: parseVal(c[17]), ala_month: parseVal(c[19]),
                img: c[20] ? String(c[20].v) : "",
                ...sales
            };
        }).filter(b => b.title && b.title !== "null");

        render();
    } catch (e) { 
        console.error("데이터 로드 실패:", e);
    }
}

function parseGviz(text) {
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1)).table.rows;
}

// UI 컨트롤
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); }
function showPage(page) { currentPage = page; document.getElementById('page-title').innerHTML = page === 'dashboard' ? '출판콘텐츠사업단 <span>종합 대시보드</span>' : '출판콘텐츠사업단 <span>신간 판매 현황</span>'; document.getElementById('dashboard-view').style.display = page === 'dashboard' ? 'block' : 'none'; document.getElementById('stock-view').style.display = page === 'stock' ? 'block' : 'none'; if(document.getElementById('sidebar').classList.contains('open')) toggleMenu(); render(); }
function switchChannel(channel) { currentChannel = channel; document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.innerText.includes(channel === 'yes24' ? '예스' : '알라딘'))); render(); }
function switchMetric(metric) { 
    currentMetric = metric; 
    document.querySelectorAll('.metric-btn').forEach(btn => btn.classList.toggle('active', btn.innerText.includes(metric === 'index' ? '지수' : '판매량'))); 
    
    // 연한 베이지색 배경 교체
    if (metric === 'sales') {
        document.body.style.backgroundColor = '#fbfaf6'; 
    } else {
        document.body.style.backgroundColor = 'var(--bg-gray)'; 
    }
    render(); 
}

// 렌더링 로직
function render() {
    const isYes = currentChannel === 'yes24';
    const prefix = isYes ? 'yes' : 'ala';
    const s_prefix = isYes ? 'y' : 'a';
    const isIdx = currentMetric === 'index';
    
    const fresh = allBooks.filter(b => b.openDate && (new Date() - b.openDate) < 365*24*60*60*1000);

    if (currentPage === 'dashboard') {
        const view = document.getElementById('dashboard-view');
        view.innerHTML = '';
        if (fresh.length === 0) return view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">데이터가 없습니다.</p>';
        
        let configs = [];
        if (isIdx) {
            // [판매지수 조회] 뷰 세팅
            configs = [
                { t: '1. 현재 판매지수 Best 10', k: `${prefix}_cur`, type: 'abs', l: 10, sub: b => `누적 ${b[`${s_prefix}_qty_t`].toLocaleString()}권` },
                { t: '2. 작일 대비 상승 Best 5', k: `${prefix}_day`, type: 'rise', l: 5, sub: b => `어제 ${b[`${s_prefix}_qty_d`].toLocaleString()}권 판매` },
                { t: '3. 작일 대비 하락 도서 5권', k: `${prefix}_day`, type: 'fall', l: 5, sub: b => `어제 ${b[`${s_prefix}_qty_d`].toLocaleString()}권 판매` },
                { t: '4. 주간 상승 Best 5', k: `${prefix}_week`, type: 'rise', l: 5, sub: b => `주간 ${b[`${s_prefix}_qty_w`].toLocaleString()}권 판매` },
                { t: '5. 주간 하락 도서 5권', k: `${prefix}_week`, type: 'fall', l: 5, sub: b => `주간 ${b[`${s_prefix}_qty_w`].toLocaleString()}권 판매` },
                { t: '6. 한달 상승 Best 5', k: `${prefix}_month`, type: 'rise', l: 5, sub: b => `월간 ${b[`${s_prefix}_qty_m`].toLocaleString()}권 판매` },
                { t: '7. 한달 하락 도서 5권', k: `${prefix}_month`, type: 'fall', l: 5, sub: b => `월간 ${b[`${s_prefix}_qty_m`].toLocaleString()}권 판매` }
            ];
        } else {
            // [판매량 조회] 뷰 세팅
            configs = [
                { t: '1. 누적 판매량 Best 10', k: `${s_prefix}_qty_t`, type: 'qty', l: 10, sub: b => `판매지수 ${isNaN(b[`${prefix}_cur`]) ? 0 : b[`${prefix}_cur`].toLocaleString()}` },
                { t: '2. 어제 판매량 Best 5', k: `${s_prefix}_qty_d`, type: 'qty', l: 5, sub: b => `변화 지수 ${b[`${prefix}_day`] > 0 ? '+' : ''}${isNaN(b[`${prefix}_day`]) ? 0 : b[`${prefix}_day`].toLocaleString()}` },
                { t: '3. 주간 판매 Best 5', k: `${s_prefix}_qty_w`, type: 'qty', l: 5, sub: b => `변화 지수 ${b[`${prefix}_week`] > 0 ? '+' : ''}${isNaN(b[`${prefix}_week`]) ? 0 : b[`${prefix}_week`].toLocaleString()}` },
                { t: '4. 월간 판매 Best 5', k: `${s_prefix}_qty_m`, type: 'qty', l: 5, sub: b => `변화 지수 ${b[`${prefix}_month`] > 0 ? '+' : ''}${isNaN(b[`${prefix}_month`]) ? 0 : b[`${prefix}_month`].toLocaleString()}` }
            ];
        }
        
        configs.forEach(conf => {
            let data = fresh.filter(b => !isNaN(b[conf.k]));
            if (conf.type === 'rise') data = data.filter(b => b[conf.k] > 0);
            if (conf.type === 'fall') data = data.filter(b => b[conf.k] < 0);
            if (conf.type === 'qty') data = data.filter(b => b[conf.k] > 0); 
            
            data.sort((a,b) => conf.type === 'fall' ? a[conf.k]-b[conf.k] : b[conf.k]-a[conf.k]);
            data = data.slice(0, conf.l);
            
            if (data.length > 0) {
                let html = `<section><div class="section-title">${conf.t}</div>`;
                data.forEach((b, i) => {
                    let valStr = "", valCls = "";
                    if (conf.type === 'qty' || conf.type === 'abs') { 
                        valStr = b[conf.k].toLocaleString() + (conf.type === 'qty' ? '권' : ''); 
                        valCls = ''; // 기본 블랙
                    } else { 
                        const res = getStat(b[conf.k]); valStr = res.s; valCls = res.c; 
                    }

                    html += `<div class="book-card"><div class="rank">${i+1}</div><img src="${b.img}" class="book-img" onerror="this.src='https://via.placeholder.com/45x65'"><div class="book-info"><div class="book-title">${b.title}</div><div class="sub-val">${conf.sub(b)}</div></div><div class="book-val ${valCls}">${valStr}</div></div>`;
                });
                view.innerHTML += html + `</section>`;
            }
        });

    } else {
        // 메뉴 2: 신간 판매 현황
        const view = document.getElementById('stock-view');
        view.innerHTML = '';
        if (fresh.length === 0) return view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">데이터가 없습니다.</p>';
        
        fresh.sort((a,b) => b.openDate - a.openDate).forEach((b, i) => {
            let mainVal, subValHtml;
            if (isIdx) {
                const d = getStat(b[`${prefix}_day`]), w = getStat(b[`${prefix}_week`]), m = getStat(b[`${prefix}_month`]);
                mainVal = isNaN(b[`${prefix}_cur`]) ? '-' : b[`${prefix}_cur`].toLocaleString();
                subValHtml = `<div class="stock-sub-val ${d.c}">${d.s}</div><div class="stock-sub-val" style="font-size:0.65rem; color:#999; margin-top:2px;">주 ${w.s} | 월 ${m.s}</div>`;
            } else {
                mainVal = b[`${s_prefix}_qty_t`].toLocaleString() + '권';
                // 판매량 시 어제, 주, 월 모두 '권' 단위 추가 적용
                subValHtml = `<div class="stock-sub-val" style="color:#555;">어제 ${b[`${s_prefix}_qty_d`].toLocaleString()}권</div><div class="stock-sub-val" style="font-size:0.65rem; color:#999; margin-top:2px;">주 ${b[`${s_prefix}_qty_w`].toLocaleString()}권 | 월 ${b[`${s_prefix}_qty_m`].toLocaleString()}권</div>`;
            }
            view.innerHTML += `<div class="stock-item"><div class="rank">${i+1}</div><div class="book-info"><div class="stock-title">${b.title}</div><div class="stock-date">${b.openDateStr} 등록</div></div><div class="stock-val">${mainVal}</div><div class="stock-change-group">${subValHtml}</div></div>`;
        });
    }
}

// 유틸 함수
function getStat(val) {
    if (isNaN(val)) return { s: '-', c: 'val-no-change' };
    if (val === 0) return { s: '-0', c: 'val-no-change' };
    return { s: (val > 0 ? '↑' : '↓') + ' ' + Math.abs(val).toLocaleString(), c: val > 0 ? 'val-rise' : 'val-fall' };
}
function parseVal(cell) { if (!cell || cell.v === null || cell.v === "집계중") return NaN; return typeof cell.v === 'number' ? cell.v : Number(String(cell.v).replace(/,/g, '')); }
function parseGoogleDate(d) { const m = String(d).match(/Date\((\d+),(\d+),(\d+)\)/); return m ? new Date(m[1], m[2], m[3]) : new Date(d); }

init();
