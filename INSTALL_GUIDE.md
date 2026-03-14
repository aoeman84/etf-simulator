# 📲 앱 설치 가이드 (PWA)

앱스토어 없이 맥북과 아이폰에 ETF 시뮬레이터를 앱처럼 설치하는 방법입니다.

---

## 🖥️ 맥북에 설치하기

### 방법 1 — Chrome / Edge (가장 쉬움)
1. 앱 주소를 Chrome 또는 Edge로 열기
2. 주소창 오른쪽 끝의 **설치 아이콘 (⬇)** 클릭
3. **"설치"** 클릭
4. → Dock에 독립 앱으로 추가됨 ✅

### 방법 2 — Safari
1. Safari로 앱 주소 열기
2. 메뉴바 **파일 → 나의 Dock에 추가**
3. → Dock에 바로가기 추가됨 ✅

---

## 📱 아이폰에 설치하기

> ⚠️ **반드시 Safari로** 열어야 합니다. Chrome 앱으로는 설치 불가.

1. Safari로 앱 주소 접속
2. 하단 **공유 버튼** (네모에 화살표 위로) 탭
3. **"홈 화면에 추가"** 탭
4. 이름 확인 후 **"추가"** 탭
5. → 홈 화면에 앱 아이콘 생성 ✅

설치 후에는:
- 앱스토어 앱과 동일하게 전체화면으로 실행
- 주소창 없이 네이티브 앱 느낌
- 오프라인에서도 마지막 데이터 캐시로 열람 가능

---

## 🌐 배포 없이 로컬에서 쓰는 방법

맥북에서만 혼자 쓰고 싶다면 인터넷 서버 없이 로컬에서 실행 가능합니다.

```bash
# 프로젝트 폴더에서
npm run build
npm run start
# → http://localhost:3000 으로 접속 후 Chrome에서 설치
```

터미널 창을 열어 둔 채로 앱을 사용하면 됩니다.  
맥북 재시작 시 다시 `npm run start`만 실행하면 돼요.

---

## ☁️ 아이폰까지 쓰려면? (Vercel 무료 배포)

아이폰에서 쓰려면 인터넷에 올려야 합니다. Vercel이 무료로 가장 쉬워요.

```bash
# 1. Vercel 설치
npm install -g vercel

# 2. 배포 (처음 한 번만 로그인)
vercel

# 3. 배포 완료 → 주소 생성 (예: etf-sim.vercel.app)
# 4. 그 주소를 아이폰 Safari로 열어서 홈 화면에 추가
```

**필요한 환경변수 (Vercel 대시보드 → Settings → Environment Variables)**
- `DATABASE_URL` — Neon.tech 무료 PostgreSQL
- `NEXTAUTH_SECRET` — 터미널에서 `openssl rand -base64 32`
- `NEXTAUTH_URL` — 배포된 URL (예: `https://etf-sim.vercel.app`)
- `RAPIDAPI_KEY` — Yahoo Finance API 키 (선택, 없으면 정적 가격 사용)

---

## 💡 자주 묻는 질문

**Q. 앱을 업데이트하면 자동으로 반영되나요?**  
A. 네. Vercel에 재배포하면 다음 앱 실행 시 자동 업데이트됩니다.

**Q. 오프라인에서도 쓸 수 있나요?**  
A. 캐시된 페이지는 오프라인에서도 열립니다. 단, 실시간 주가 연동은 인터넷 필요.

**Q. 아이폰 홈 화면 아이콘 모양을 바꾸고 싶어요.**  
A. `public/icons/` 폴더의 PNG 파일들을 교체하면 됩니다. (512×512 권장)
