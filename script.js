/**
 * [V3: 교보문고 통합본] 판매지수 & 판매량 듀얼 대시보드
 */
const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y';
const MASTER_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('마스터_DB')}`;
const SALES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('서점별 판매 부수')}`;

let allBooks = [];
let currentChannel = 'yes24';
let currentMetric = 'index'; 
let currentPage = 'dashboard';
let currentKyoSub = 'total'; // store, online, whole, total

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
                // 교보문고 데이터 매핑 (M열~X열)
                const ks_d = parseVal(r.c[12]), ki_d = parseVal(r.c[13]), kw_d = parseVal(r.c[14]);
                const ks_w = parseVal(r.c[15]), ki_w = parseVal(r.c[16]), kw_w = parseVal(r.c[17]);
                const ks_m = parseVal(r.c[18]), ki_m = parseVal(r.c[19]), kw_m = parseVal(r.c[20]);
                const ks_t = parseVal(r.c[21]), ki_t = parseVal(r.c[22]), kw_t = parseVal(r.c[23]);

                salesMap.set(titleKey, {
                    y_qty_d: parseVal(r.c[4]), a_qty_d: parseVal(r.c[5]),
                    y_qty_w: parseVal(r.c[6]), a_qty_w: parseVal(r.c[7]),
                    y_qty_m: parseVal(r.c[8]), a_qty_m: parseVal(r.c[9]),
                    y_qty_t: parseVal(r.c[10]), a_qty_t: parseVal(r.c[11]),
                    // 교보문고 채널별 매핑
                    k_s_d: ks_d, k_i_d: ki_d, k_w_d: kw_d, k_total_d: ks_d+ki_d+kw_d,
                    k_s_w: ks_w, k_i_w: ki_w, k_w_w: kw_w, k_total_w: ks_w+ki_w+kw_w,
                    k_s_m: ks_m, k_i_m: ki_m, k_w_m: kw_m, k_total_m: ks_m+ki_m+kw_m,
                    k_s_t: ks_t, k_i_t: ki_t, k_w_t: kw_t, k_total_t: ks_t+ki_t+kw_t
                });
            }
        });
        
        allBooks = masterData.map(row => {
            const c = row.c;
            const title = c[0] ? String(c[0].v) : "";
            const titleKey = title.trim().replace(/\s+/g, '');
            const sales = salesMap.get(titleKey) || {};

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

function switchChannel(channel) { 
    currentChannel = channel; 
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const t = btn.innerText;
        btn.classList.toggle('active', (channel==='yes24' && t.includes('예스')) || (channel==='aladin' && t.includes('알라딘')) || (channel==='kyobo' && t.includes('교보문고')));
    });

    // 교보문고 선택 시 지수 버튼 비활성화 및 판매량 모드로 강제 전환
    if (channel === 'kyobo') {
        document.getElementById('kyobo-sub-tab').style.display = 'flex';
        document.getElementById('m-btn-index').style.opacity = '0.3';
        document.getElementById('m-btn-index').style.pointerEvents = 'none';
        if (currentMetric === 'index') switchMetric('sales');
    } else {
        document.getElementById('kyobo-sub-tab').style.display = 'none';
        document.getElementById('m-btn-index').style.opacity = '1';
        document.getElementById('m-btn-index').style.pointerEvents = 'auto';
    }
    render(); 
}

function switchKyoSub(sub) {
    currentKyoSub = sub;
    document.querySelectorAll('.sub-btn').forEach(btn => {
        const t = btn.innerText;
        btn.classList.toggle('active', (sub==='store' && t==='매장') || (sub==='online' && t==='인터넷') || (sub==='whole' && t==='도매') || (sub==='total' && t==='누적'));
    });
    render();
}

function switchMetric(metric) { 
    currentMetric = metric; 
    document.querySelectorAll('.metric-btn').forEach(btn => btn.classList.toggle('active', btn.innerText.includes(metric === 'index' ? '지수' : '판매량'))); 
    
    // 💡 [핵심 변경] 판매량 조회 시 버튼(#e0e0e0)보다 짙은 그레이 배경색 적용
    document.body.style.backgroundColor = (metric === 'sales') ? '#cbd5e1' : 'var(--bg-gray)'; 
    render(); 
}

// 렌더링 로직
function render() {
    const isKyo = currentChannel === 'kyobo';
    const isYes = currentChannel === 'yes24';
    const prefix = isYes ? 'yes' : 'ala';
    const s_prefix = isYes ? 'y' : 'a';
    const isIdx = currentMetric === 'index';
    
    const now = new Date();
    // 신간(365일 이내), 최신간(30일 이내) 필터링
    const fresh = allBooks.filter(b => b.openDate && (now - b.openDate) < 365*24*60*60*1000);
    const superFresh = allBooks.filter(b => b.openDate && (now - b.openDate) < 30*24*60*60*1000);

    if (currentPage === 'dashboard') {
        const view = document.getElementById('dashboard-view');
        view.innerHTML = '';
        if (fresh.length === 0) return view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">데이터가 없습니다.</p>';
        
        let configs = [];
        if (isIdx) {
            // [판매지수 조회] 뷰 세팅
            configs = [
                { t: '1. 현재 판매지수 Best 10', k: `${prefix}_cur`, type: 'abs', l: 10, sub: b => `누적 ${b[`${s_prefix}_qty_t`].toLocaleString()}권`, data: fresh },
                { t: '2. 작일 대비 상승 Best 5', k: `${prefix}_day`, type: 'rise', l: 5, sub: b => `어제 ${b[`${s_prefix}_qty_d`].toLocaleString()}권 판매`, data: fresh },
                { t: '3. 작일 대비 하락 도서 5권', k: `${prefix}_day`, type: 'fall', l: 5, sub: b => `어제 ${b[`${s_prefix}_qty_d`].toLocaleString()}권 판매`, data: fresh },
                { t: '4. 주간 상승 Best 5', k: `${prefix}_week`, type: 'rise', l: 5, sub: b => `주간 ${b[`${s_prefix}_qty_w`].toLocaleString()}권 판매`, data: fresh },
                { t: '5. 월간 상승 Best 5', k: `${prefix}_month`, type: 'rise', l: 5, sub: b => `월간 ${b[`${s_prefix}_qty_m`].toLocaleString()}권 판매`, data: fresh }
            ];
        } else if (isKyo) {
            // [교보문고 판매량 조회] 뷰 세팅
            const k_key = currentKyoSub === 'store' ? 's' : (currentKyoSub === 'online' ? 'i' : (currentKyoSub === 'whole' ? 'w' : 'total'));
            const subTxt = b => `교보 누적 ${(b.k_total_t || 0).toLocaleString()}부`;
            configs = [
                { t: '1. 누적 판매량 Best 10', k: `k_${k_key}_t`, type: 'qty', l: 10, sub: subTxt, data: fresh },
                { t: '2. 최신간도서 Best 5', k: `k_${k_key}_m`, type: 'qty', l: 5, sub: subTxt, data: superFresh }, // 30일 이내 대상, 한달 판매량 기준
                { t: '3. 어제 판매량 Best 5', k: `k_${k_key}_d`, type: 'qty', l: 5, sub: subTxt, data: fresh },
                { t: '4. 주간 판매 Best 5', k: `k_${k_key}_w`, type: 'qty', l: 5, sub: subTxt, data: fresh },
                { t: '5. 월간 판매 Best 5', k: `k_${k_key}_m`, type: 'qty', l: 5, sub: subTxt, data: fresh }
            ];
        } else {
            // [예스/알라딘 판매량 조회] 뷰 세팅
            const subTxt = b => `판매지수 ${isNaN(b[`${prefix}_cur`]) ? 0 : b[`${prefix}_cur`].toLocaleString()}`;
            configs = [
                { t: '1. 누적 판매량 Best 10', k: `${s_prefix}_qty_t`, type: 'qty', l: 10, sub: subTxt, data: fresh },
                { t: '2. 최신간도서 Best 5', k: `${s_prefix}_qty_m`, type: 'qty', l: 5, sub: subTxt, data: superFresh }, // 30일 이내 대상, 한달 판매량 기준
                { t: '3. 어제 판매량 Best 5', k: `${s_prefix}_qty_d`, type: 'qty', l: 5, sub: subTxt, data: fresh },
                { t: '4. 주간 판매 Best 5', k: `${s_prefix}_qty_w`, type: 'qty', l: 5, sub: subTxt, data: fresh },
                { t: '5. 월간 판매 Best 5', k: `${s_prefix}_qty_m`, type: 'qty', l: 5, sub: subTxt, data: fresh }
            ];
        }
        
        configs.forEach(conf => {
            const targetData = conf.data;
            let data = targetData.filter(b => !isNaN(b[conf.k]) && b[conf.k] !== null);
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
                        // 교보는 '부', 예스알라딘은 '권'
                        valStr = b[conf.k].toLocaleString() + (conf.type === 'qty' ? (isKyo ? '부' : '권') : ''); 
                        valCls = ''; 
                    } else { 
                        const res = getStat(b[conf.k]); valStr = res.s; valCls = res.c; 
                    }

                    html += `<div class="book-card"><div class="rank">${i+1}</div><img src="${b.img}" class="book-img" onerror="this.src='https://via.placeholder.com/45x65'"><div class="book-info"><div class="book-title">${b.title}</div><div class="sub-val">${conf.sub(b)}</div></div><div class="book-val ${valCls}">${valStr}</div></div>`;
                });
                view.innerHTML += html + `</section>`;
            }
        });

    } else {
        // 메뉴 2: 신간 판매 현황 뷰 (재고 리스트업)
        const view = document.getElementById('stock-view');
        view.innerHTML = '';
        if (fresh.length === 0) return view.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">데이터가 없습니다.</p>';
        
        fresh.sort((a,b) => b.openDate - a.openDate).forEach((b, i) => {
            let mainVal, subValHtml;
            if (isIdx) {
                const d = getStat(b[`${prefix}_day`]), w = getStat(b[`${prefix}_week`]), m = getStat(b[`${prefix}_month`]);
                mainVal = isNaN(b[`${prefix}_cur`]) ? '-' : b[`${prefix}_cur`].toLocaleString();
                subValHtml = `<div class="stock-sub-val ${d.c}">${d.s}</div><div class="stock-sub-val" style="font-size:0.65rem; color:#999; margin-top:2px;">주 ${w.s} | 월 ${m.s}</div>`;
            } else if (isKyo) {
                // 신간 판매현황 교보문고 스타일
                const k_key = currentKyoSub === 'store' ? 's' : (currentKyoSub === 'online' ? 'i' : (currentKyoSub === 'whole' ? 'w' : 'total'));
                mainVal = (b[`k_${k_key}_t`] || 0).toLocaleString() + '부';
                subValHtml = `<div class="stock-sub-val" style="color:#555;">어제 ${(b[`k_${k_key}_d`]||0).toLocaleString()}부</div><div class="stock-sub-val" style="font-size:0.65rem; color:#999; margin-top:2px;">주 ${(b[`k_${k_key}_w`]||0).toLocaleString()}부 | 월 ${(b[`k_${k_key}_m`]||0).toLocaleString()}부</div>`;
            } else {
                mainVal = b[`${s_prefix}_qty_t`].toLocaleString() + '권';
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
function parseVal(cell) { if (!cell || cell.v === null || cell.v === "집계중" || cell.v === "-") return NaN; return typeof cell.v === 'number' ? cell.v : Number(String(cell.v).replace(/,/g, '')); }
function parseGoogleDate(d) { const m = String(d).match(/Date\((\d+),(\d+),(\d+)\)/); return m ? new Date(m[1], m[2], m[3]) : new Date(d); }

init();
