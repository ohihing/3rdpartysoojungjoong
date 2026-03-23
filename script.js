/**
 * [실시간 동기화 버전] 캐시 삭제 / 실시간 페칭 전용
 * 업데이트 날짜: 2026-03-23
 */

const SHEET_ID = '1IKN1Wk27bpFyNYcCv0kjDa_blAe10wMUbMGwt0b2j8Y'; // 수정용 시트 ID
const SHEET_NAME = '마스터_DB';
const JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

let allBooks = [];
let currentChannel = 'yes24';
let currentPage = 'dashboard';

// --- [핵심] 페이지 접속 시 항상 새로 가져오기 ---
async function init() {
    // 이전 캐시 찌꺼기들 완전히 삭제 (충돌 방지)
    localStorage.clear(); 
    
    const updateEl = document.getElementById('update-time');
    updateEl.innerText = "🔄 실시간 데이터를 불러오는 중...";
    
    await fetchData();
}

async function fetchData() {
    try {
        const response = await fetch(JSON_URL);
        const text = await response.text();
        
        // 시트 공유 설정 확인용 방어 코드
        if (text.includes("<!DOCTYPE html>") || !text.includes("google.visualization")) {
            throw new Error("시트 공유 권한이 '링크가 있는 모든 사용자(뷰어)'인지 확인해주세요.");
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

        if (allBooks.length === 0) throw new Error("가져온 데이터가 0건입니다. 시트 내용을 확인해주세요.");

        render();
        updateTimestamp();
    } catch (e) { 
        console.error(e);
        document.getElementById('update-time').innerHTML = `<span style="color:#eb4d4b; font-weight:bold;">⚠️ ${e.message}</span>`;
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
    document.getElementById('update-time').innerHTML = `최근 업데이트: ${formatted} (실시간)`;
}

// --- 아래 렌더링 및 유틸리티 로직은 기존과 동일 ---

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

function toggle
