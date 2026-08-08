# Báo cáo Technical & Operational Audit — Quiz-App / WordArena

**Người nhận:** Chủ dự án  
**Ngày báo cáo:** 08/08/2026 (UTC+7)  
**Repository:** `nguyenhdung2006/Quiz-App`  
**Phạm vi GitHub đã audit:** nhánh `main`, commit `27e4a4dbe25e3cf4d9af1bf5d8693eedf3c1f867` — *Add observability and rate limit controls*  
**Mức độ kết luận:** source/config/docs đã kiểm kê toàn bộ; dữ liệu RAM riêng tư trên Render chưa truy cập được nên nguyên nhân chính xác của memory incident vẫn cần metrics.

---

## 1. Kết luận điều hành

WordArena hiện là một sản phẩm học từ vựng tương đối đầy đủ, không còn là CRUD demo đơn giản. Backend đã có nhiều biện pháp hardening đáng kể: OAuth2 session, CSRF đúng kiểu SPA, CORS allowlist, server-side quiz verification, sync contract V2 với revision/tombstone, Flyway production guard, request correlation, Micrometer metrics và AI rate limit.

Tuy nhiên, dự án **chưa nên được tuyên bố production-ready**. Ba blocker cần xử lý trước:

1. **Render đã thật sự restart service do vượt memory limit lúc 23:18 ngày 07/08/2026**, nhưng chưa có biểu đồ RAM/traffic đúng thời điểm để phân loại leak hay spike.
2. **`POST /api/sync` có rủi ro memory spike/DoS:** request cho phép tối đa 5.000 từ và 5.000 `wrongWords`, chưa giới hạn tổng kích thước JSON trước khi Jackson parse. Validation độ dài chuỗi diễn ra sau khi body đã được giữ trong RAM.
3. **Production Release Gate hiện bị khóa bởi false positive:** secret scanner hiểu nhầm hai dòng `OPENAI_API_KEY=` và `AI_MODEL=...` trong tài liệu là secret thật, khiến control trả `FAIL` trên source sạch.

Đánh giá cập nhật:

| Hạng mục | Điểm | Nhận xét |
|---|---:|---|
| Phạm vi sản phẩm | 8.0/10 | Nhiều tính năng thực và có liên kết end-to-end |
| Backend architecture | 7.5/10 | Layer/package rõ; service lớn và query chưa scale |
| Security & integrity | 7.5/10 | CSRF và quiz integrity đã sửa; còn body-size/metrics exposure |
| Data & sync safety | 7.0/10 | Revision + tombstone tốt; snapshot/tombstone tăng không giới hạn |
| Testing design | 7.0/10 | 91 JUnit test và 28 Playwright test được khai báo; lần audit này chưa chạy trọn bộ do môi trường |
| Frontend maintainability | 5.5/10 | Vanilla JS phù hợp MVP nhưng nhiều global state/file lớn |
| Performance & memory | 5.5/10 | Full snapshot/full scan; chưa có JVM/request memory budget |
| DevOps/operability | 5.5/10 | Có gate, CI, runbook; gate đang fail giả và chưa có bằng chứng GO |
| Documentation | 6.0/10 | Rất nhiều tài liệu nhưng có finding lỗi thời và mâu thuẫn |

**Điểm kỹ thuật tổng thể đề xuất: 6.8/10.**  
**Production readiness hiện tại: 6.2/10.**  
Sau khi xử lý ba blocker trên và có một chu kỳ metrics ổn định, dự án phù hợp public beta nhỏ. Chưa phù hợp traffic lớn hoặc multi-instance.

---

## 2. Phạm vi kiểm kê

Repository có **340 file được track**, trong đó **94 file nằm trong `archive/`**. Phần active được đọc gồm:

- 90 file Java backend runtime, khoảng 5.831 dòng;
- 16 file Java test, khoảng 3.205 dòng, tổng 91 method có `@Test`;
- 17 file JavaScript frontend và 10 file CSS được liên kết/kiểm kê;
- 28 REST endpoint operation;
- 28 Playwright smoke test;
- 9 bảng PostgreSQL và 4 Flyway migration V1–V4;
- CI workflow, production release gate, Dockerfile, config, SQL và toàn bộ tài liệu kỹ thuật chính.

Repository đang public, không có open PR hoặc open issue. Commit mới nhất chỉ có trạng thái Vercel `success` được nhìn thấy qua GitHub; audit không thu được bằng chứng GitHub Actions pass cho commit này.

Ảnh VS Code của chủ dự án đang ở branch `chore/audit-reconciliation-and-upgrade`, còn báo cáo này audit GitHub `main`. Hai file `docs/ROADMAP.md` và `docs/TROUBLESHOOTING.md` thấy trong ảnh không tồn tại trên `main`; có khả năng chúng chưa được push hoặc chỉ nằm trên branch local. Con số “451 Problems” trong VS Code không đủ để kết luận có 451 lỗi code; ảnh cho thấy extension spell checker đang báo rất nhiều cảnh báo Markdown.

---

## 3. Dự án hiện có những gì

### 3.1. Sản phẩm và frontend

- Google login, session bootstrap, logout có CSRF;
- profile người học;
- vocabulary CRUD, favorite, mastered, tag, CEFR, IPA, context, examples, collocations, synonyms/antonyms, notes;
- local-first storage, account namespace, import/export;
- cloud snapshot và sync V2;
- quiz, combo/challenge, sound/effects, wrong bank và quiz history;
- spaced repetition “Review Today”;
- analytics overview, accuracy trend, weak words, review pressure, tag/level performance;
- AI Explain Wrong Answer và AI Deck Generator với rule-based fallback;
- curated decks;
- onboarding, theme và responsive UI.

### 3.2. Backend

- Spring Boot 3.5.14, Java 17, Spring Security OAuth2, JPA, Validation, Actuator;
- CSRF cookie/header contract: `XSRF-TOKEN` + `X-XSRF-TOKEN`;
- CORS credentialed allowlist;
- vocabulary CRUD, sync, profile, achievements, quiz history;
- server tự tính đúng/sai, score, combo, XP và achievement từ answer đã kiểm chứng;
- optimistic concurrency bằng `sync_revision`;
- stable `wordUid`, delete tombstone và legacy ID bridge;
- spaced repetition 1/3/7/14/30 ngày;
- OpenAI Responses API, schema guardrail, timeout và fallback;
- in-memory AI rate limiter;
- request ID, structured log, Actuator/Micrometer và health counters;
- production database fail-fast guard.

### 3.3. Database và vận hành

Các bảng: `app_users`, `vocabulary`, `word_tombstones`, `word_stats`, `wrong_bank`, `quiz_history`, `quiz_history_answers`, `achievements`, `user_achievements`.

Production profile dùng Hibernate `validate`, Flyway enabled, `clean` disabled và cấm `baseline-on-migrate=true`. CI có PostgreSQL 16 service, backend tests, Flyway rehearsal và Playwright workflow. Production Release Gate bổ sung environment validation, secret scan, backup/restore evidence và staging smoke.

---

## 4. Incident Render: vượt memory limit

### 4.1. Điều đã xác nhận

- Gmail có đúng **một** email memory-limit trong toàn bộ kết quả tìm kiếm: 16:18:47 UTC ngày 07/08/2026, tức **23:18:47 UTC+7**.
- Render ghi rõ instance vượt memory limit và bị automatic restart; service tạm thời unavailable.
- Ảnh log cho thấy Spring Boot khởi động lại sau đó và hoàn thành bình thường. Phần log nhìn thấy không có Java `OutOfMemoryError` hoặc stack trace ứng dụng.
- Ảnh Render hiển thị service là free instance. Theo [Render instance types](https://render.com/docs/compute-plans), Free web service có **512 MB RAM và 0,1 CPU**. Free service cũng spin down khi idle, nên lần start sau đó không tự động chứng minh có leak.
- Render khuyến nghị dùng biểu đồ RAM/CPU trong [Service Metrics](https://render.com/docs/service-metrics). Dashboard riêng tư không truy cập được trong phiên audit vì dừng ở màn hình đăng nhập.

### 4.2. Điều chưa thể kết luận

Email của Render đưa ra ba khả năng chung: leak, traffic spike hoặc instance quá nhỏ. Email không phân loại nguyên nhân. Ảnh log chỉ chụp sau restart nên không cho biết RAM tăng dần hay tăng đột ngột.

Do đó, phát biểu “project bị memory leak” hiện **chưa có đủ bằng chứng**. Một container có thể bị cgroup kill vì RSS tổng vượt 512 MB mà JVM không kịp ghi `OutOfMemoryError`.

### 4.3. Các nguồn rủi ro, xếp theo ưu tiên điều tra

| Khả năng | Mức | Evidence |
|---|---|---|
| Instance 512 MB quá sát với Spring Boot/JPA/Security/Flyway/Actuator | Cao | Docker chạy đầy đủ stack trên Free 512 MB; startup mất khoảng 2–5 phút do 0,1 CPU và DB mạng |
| JSON sync lớn gây allocation spike | Cao về thiết kế, chưa biết có xảy ra lúc incident | `SyncRequest` cho 5.000 `vocab` + 5.000 `wrongWords`; không có request-body cap trước Jackson |
| Traffic/request concurrency spike | Trung bình | Email Render nêu khả năng; thiếu traffic graph |
| In-memory OAuth sessions | Trung bình/thấp ở quy mô hiện tại | Session store mặc định nằm trong JVM và chưa có explicit session budget |
| Analytics/review/full snapshot tải list lớn | Trung bình dài hạn | Nhiều endpoint tải toàn bộ vocabulary/history rồi stream/aggregate |
| AI rate-limit map | Thấp | Có cleanup mỗi 100 check, entry stale một ngày; không giống leak vô hạn nhanh |
| Health/Micrometer counters | Thấp | Key status code bị giới hạn tự nhiên; không có user/path cardinality động |
| Leak thực sự trong code | Chưa xác định | Không có heap dump, NMT hoặc memory trend |

Oracle mô tả JVM Java 17 mặc định chọn max heap khoảng 1/4 bộ nhớ khả dụng, nhưng RSS còn gồm metaspace, code cache, thread stacks, direct buffers và thư viện native; xem [Java 17 ergonomics](https://docs.oracle.com/en/java/javase/17/gctuning/ergonomics.html). Vì vậy chỉ nhìn heap không đủ.

### 4.4. Cách kiểm tra đúng trên Render

1. Vào **Metrics → Application Metrics**, chọn 07/08/2026 từ 23:00 đến 23:30.
2. Ghi lại bốn số: memory limit, peak RAM, RAM trước peak 10 phút, request/CPU cùng thời điểm.
3. Phân loại đồ thị:
   - RAM tăng bậc thang và không giảm sau GC → nghi leak hoặc retained cache/session;
   - một spike thẳng đứng cùng request/CPU → payload/concurrency;
   - RAM nền đã 80–90% ngay sau boot → instance thiếu headroom.
4. Ở Logs, lọc ±10 phút quanh incident theo `[SYNC]`, `[ANALYTICS]`, `[AI]`, `[SNAPSHOT]`, request ID và HTTP status.
5. Gọi Actuator metrics sau boot và sau workload: `jvm.memory.used`, `jvm.buffer.memory.used`, `jvm.threads.live`, `process.memory.usage`, `jdbc.connections.active`.
6. Tạm bật Native Memory Tracking ở staging, không bật lâu trên Free instance vì có overhead.

### 4.5. Sửa vận hành đề xuất

- Không nâng plan ngay như một cách che lỗi. Trước hết lấy memory graph và reproduce ở staging.
- Thêm JVM budget có kiểm thử, ví dụ bắt đầu ở staging với `-Xms64m -Xmx192m -XX:MaxMetaspaceSize=128m -XX:+ExitOnOutOfMemoryError`; điều chỉnh theo RSS thực tế. Không copy mù sang production.
- Bật GC log ngắn hạn và alert RAM ở 75%/90%.
- Nếu baseline sau boot đã quá cao dù workload nhỏ, Starter vẫn chỉ 512 MB nên không giải quyết; cần Standard 2 GB hoặc giảm dependency/runtime footprint.

---

## 5. Đối chiếu `technical-audit-report.md`

Tài liệu ngày 30/07 có giá trị lịch sử nhưng **không còn mô tả đúng source hiện tại**. Nó phải được gắn commit SHA/trạng thái “superseded” hoặc viết lại.

| Finding trong audit cũ | Trạng thái hiện tại |
|---|---|
| CSRF disabled với cookie session | **Đã sửa**: cookie token, header token, endpoint bootstrap, logout CSRF và test |
| Client có thể fake quiz XP/progress | **Đã sửa phần chính**: backend recompute totals/correct/score/combo/XP từ server vocabulary |
| Sync không có delete semantics/tombstone | **Đã sửa**: V2 revision, stable UUID, tombstones, legacy bridge |
| Production dùng `ddl-auto=update`, Flyway off | **Đã sửa ở prod profile**: validate + Flyway + fail-fast guard |
| Observability rất mỏng | **Đã cải thiện**: request ID, metrics, counters, structured logs; chưa có external alert/memory evidence |
| Full scan/in-memory analytics/review | **Còn đúng** |
| `CurrentUserService.requireUser` ghi DB mọi request | **Còn đúng** |
| Frontend monolith/global state | **Còn đúng** |
| In-memory rate limit không dùng được multi-instance | **Còn đúng**, chấp nhận được nếu single instance |
| Migration production chưa được đối chiếu trực tiếp | **Còn cần bằng chứng** từ Supabase/restore rehearsal |

Ngoài ra, `production-hardening-status.md` vẫn ghi “không có cloud-side tombstone” trong phần Remaining Risks, trái với chính Sync V2/V3/V4. Documentation đang tự mâu thuẫn.

---

## 6. Findings mới và còn hiệu lực

### P0 — phải sửa trước public beta/release gate

#### P0.1. Giới hạn request body cho `/api/sync`

`SyncRequest` giới hạn số phần tử nhưng không giới hạn tổng JSON trước deserialize. Với nhiều trường text đến 2.000 ký tự, 5.000 từ có thể tạo payload hàng chục đến hàng trăm MB; `wrongWords` còn là field legacy không được dùng trong `SyncService` nhưng vẫn bị Jackson parse.

**Yêu cầu sửa:**

- đặt hard request-body limit khoảng 2–5 MB trước Jackson;
- thêm cascade `@Valid` cho các list DTO;
- giảm/chunk `vocab` thay vì một full snapshot 5.000 phần tử;
- bỏ `wrongWords` khỏi contract mới sau giai đoạn tương thích;
- thêm test gửi Content-Length/body vượt giới hạn và test 500/5.000 item.

#### P0.2. Sửa secret scan false positive

Regex `password-assignment` dùng `\s*`, cho phép match qua newline. Nó match chính xác chuỗi:

```text
API_KEY=
AI_MODEL=gpt-4.1-mini
```

trong `docs/INTEGRATIONS.md`, rồi báo critical secret. Gate vì thế trả `FAIL` dù không có secret.

**Yêu cầu sửa:** dùng `[ \t]*` thay cho `\s*` quanh phép gán, xử lý value rỗng và thêm Node unit test cho multiline/placeholder/secret thật.

#### P0.3. Chốt root cause và RAM budget

Lưu snapshot Metrics của incident, thêm alert, thiết lập JVM budget qua staging và ghi runbook. Khi chưa có bằng chứng này, memory issue có thể lặp lại.

### P1 — ưu tiên trong 1–2 sprint

1. `CurrentUserService.requireUser()` đang `save()` và log “Login success” ở mọi API request. Chỉ update `lastActiveDate` khi đổi ngày hoặc tách activity update khỏi auth lookup.
2. `LearningAnalyticsService.overview()` tải words/history rồi gọi thêm `reviewPressure`, `accuracyTrend`, `tagPerformance`, các hàm lại tải list lần nữa. Gom query/load một lần hoặc aggregate ở SQL.
3. `SpacedRepetitionService.queue()` tải toàn bộ từ rồi filter/sort Java. Tạo repository query theo `next_review`, tag, level và limit.
4. Snapshot trả toàn bộ vocabulary + toàn bộ tombstone. Thiết kế pagination/delta sync theo revision; tombstone chỉ compact khi có client acknowledgement, không xóa mù.
5. `/actuator/metrics/**` đang public. Nếu không thật sự cần public, bảo vệ hoặc chỉ cho monitoring channel; health/info có thể tiếp tục public.
6. Thêm server-issued quiz attempt ID/non-replay nếu XP/achievement có giá trị cạnh tranh. Hiện answer hợp lệ có thể submit lặp lại.
7. Xác minh schema production và restore rehearsal thay vì chỉ dựa vào migration rehearsal local.

### P2 — maintainability

- Tách `frontend/js/app.js` (1.821 dòng) và `learning-studio.js` (1.446 dòng) thành module theo auth/sync/profile/import/dashboard.
- Tách `modern.css` (5.484 dòng); `design-system.css` 1.576 dòng hiện không được `index.html` load.
- Tách `VocabularyService` và `SyncService` thành use-case nhỏ hơn.
- Loại dependency không dùng sau khi chứng minh: Thymeleaf starter, Lombok; đánh giá H2/devtools chỉ cho local profile/build.
- Chuẩn hóa OpenAPI/API error/status code và pagination contract.
- Dọn `archive/` khỏi runtime repository hoặc chuyển thành tag/release; hiện archive có 94 file, kể cả hai `.class` được commit.
- Đồng bộ tài liệu với code và branch; đưa backlog thành GitHub issues thay vì để toàn bộ trong Markdown.

---

## 7. Kết quả verification của lần audit

| Check | Kết quả | Diễn giải |
|---|---|---|
| Checkout GitHub main | PASS | Commit `27e4a4d...` |
| Frontend JS syntax, toàn bộ `frontend/js/*.js` | PASS | `node --check` |
| Frontend static build gate | PASS | `[PASS] frontend-static-build` |
| npm audit | PASS | 0 vulnerability trong dependency tree hiện tại |
| Production secret scan | **FAIL** | False positive xác định được ở `docs/INTEGRATIONS.md` |
| Backend Maven tests | NOT VERIFIED | Môi trường audit không truy cập được Maven Central; không phải test failure |
| Playwright 28 tests | NOT VERIFIED | Chromium binary không tải được từ CDN; tất cả dừng trước khi chạy test logic |
| GitHub Actions latest commit | NOT VERIFIED | Chỉ quan sát được Vercel status thành công; không có workflow run evidence qua kết nối hiện tại |
| Render private Metrics | BLOCKED | Dashboard yêu cầu đăng nhập trong cloud browser |

Không được báo “28 frontend tests failed”: chúng không khởi chạy vì thiếu browser executable. Tương tự, Maven không đến giai đoạn compile/test vì dependency repository bị chặn DNS.

---

## 8. Kế hoạch thực thi đề xuất

### Trong 24 giờ

1. Xuất/chụp Render Memory + CPU graph quanh 23:18 ngày 07/08.
2. Sửa secret-scan regex và thêm unit test.
3. Thêm request-body limit cho `/api/sync`, giảm max payload, thêm regression test.
4. Chạy lại backend tests, Playwright và Production Release Gate trên GitHub; lưu artifact.

### Trong 7 ngày

1. Thử JVM memory budget ở staging và load test sync/analytics.
2. Bật alert RAM; ghi baseline RAM ngay sau boot và sau 30 phút.
3. Tối ưu `CurrentUserService`, review queue query và analytics duplicate loads.
4. Cập nhật/supersede `technical-audit-report.md` và sửa mâu thuẫn trong `production-hardening-status.md`.

### Sau khi ổn định

1. Delta/paginated sync và tombstone acknowledgement.
2. Modularize frontend theo từng phần, không rewrite framework ngay.
3. Xem xét plan 2 GB chỉ khi metrics chứng minh 512 MB không đủ sau khi đã giới hạn workload.

---

## 9. Quyết định đề xuất cho chủ dự án

**Quyết định hiện tại: NO-GO cho tuyên bố production-ready; CONDITIONAL GO cho personal beta sau khi xử lý P0.**

Không nên ưu tiên thêm feature mới ngay. Sprint tiếp theo nên chỉ tập trung vào:

1. memory evidence + JVM/request budget;
2. release gate hoạt động thật;
3. regression test và documentation reconciliation.

Đây là ba việc tạo giá trị vận hành lớn hơn nhiều so với nâng Java 17 lên bản mới, đổi framework frontend hoặc thêm Redis. Java 17 vẫn là LTS phù hợp; nâng runtime lúc đang điều tra incident sẽ làm thay đổi quá nhiều biến và khó xác định root cause.

