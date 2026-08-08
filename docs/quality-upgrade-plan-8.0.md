# Kế Hoạch Nâng Cấp Chất Lượng Lên 8.0

Ngày: 2026-08-08

Phạm vi: branch hiện tại `chore/audit-reconciliation-and-upgrade`, source code,
docs, backend/frontend tests, GitHub workflows, Docker/config, package scripts,
Maven config, và release-gate scripts. Đây chỉ là audit và kế hoạch hành động;
không có runtime code nào được thay đổi cho tài liệu này.

## Ước Tính Điểm Hiện Tại

Điểm chất lượng/sẵn sàng hiện tại ước tính: `6.9/10` với khoảng thực tế
`6.7-7.1`.

Đây không phải là việc dùng lại mù quáng điểm audit cũ `6.8/10`. Source hiện
tại đã mạnh hơn đáng kể so với các phát hiện cũ ở mức 5.6/10 và giai đoạn đầu
6.8/10:

- CSRF đã được bật cho các cookie/session unsafe requests.
- Official quiz XP, stats, mastery, và achievements được tính ở server-side.
- Sync V2 dùng `wordUid`, `expectedRevision`, tombstones, và legacy ID bridge.
- Production profile ghim Hibernate ở `validate`, bật Flyway, tắt Flyway clean,
  và từ chối unsafe production DB config khi startup.
- CI và production release gate đã tồn tại với các kiểm soát backend, frontend,
  Flyway, security, observability, staging, và backup.
- Kiểm chứng local ngay trước kế hoạch này gồm backend tests, frontend static
  build, và Playwright đều pass trên commit refactor trước đó.

Điểm vẫn dưới 8.0 vì production evidence, bounded resource usage, hành vi với
tài khoản lớn, frontend architecture, visual regression, và kỷ luật vận hành
chưa đủ mạnh. Code-hardening đã gần mức 8+, nhưng production readiness vẫn gần
6.2 hơn cho đến khi external release gate evidence là thật.

## Vì Sao Dự Án Chưa Đạt 8.0

Source hiện tại là một nền tảng beta tốt, chưa phải một hệ thống vận hành ở mức
production-grade. Các khoảng trống lớn nhất là:

- Một lần Render memory-limit restart đã được xác nhận nhưng chưa có phân loại
  nguyên nhân gốc.
- `/api/sync` validate kích thước list sau khi Jackson deserializes toàn bộ JSON
  body.
- CI status cho audited HEAD đã được xác minh PASS một phần, nhưng GitHub
  Production Release Gate cho đúng candidate vẫn chưa được xác minh.
- Staging smoke và restore rehearsal vẫn là external evidence, không phải source
  facts.
- Public Actuator metrics hiện được gate/config cho phép có chủ ý, nhưng docs
  cũng đặt câu hỏi liệu public metrics có nên tiếp tục mở hay không.
- Review, analytics, sync, và snapshot flows vẫn load các list lớn theo từng
  user.
- Frontend vẫn phụ thuộc vào global script order và các file lớn.
- Playwright smoke đã có, nhưng screenshot/visual regression chưa là gate.
- Docs hiện tại phần lớn đã được reconcile, nhưng vẫn còn một vài file chứa
  phát biểu lịch sử hoặc wording lạc quan có thể gây nhiễu cho release
  decisions.

## Blockers Cần Xử Lý Trước

| Blocker | Trạng thái | Bằng chứng | Hành động bắt buộc |
| --- | --- | --- | --- |
| Render memory-limit restart | OPEN | Docs hiện tại ghi nhận một Render memory-limit restart đã xác nhận, nhưng source không thể xác định leak vs payload spike vs instance headroom. | Capture Render Metrics quanh sự cố, correlate request/log evidence, đặt JVM/RSS budget đã test, và thêm alert thresholds. |
| `/api/sync` pre-deserialization payload cap | OPEN | `SyncRequest` có giới hạn list `@Size(max=5000)`, nhưng Spring/Jackson phải parse body trước. | Thêm request-body cap ở container/filter/proxy level, thêm oversized-body tests, sau đó thiết kế chunk/delta sync. |
| Release gate secret scan | PASS LOCALLY / NEEDS GITHUB GATE VERIFICATION | Task 2 đã PASS local: `npm run gate:secret-scan` tạo `secret-scan.json` với `findingCount: 0`. Fallback của `secret-scan.mjs` đã được sửa để không scan ignored local `.env`; script vẫn ưu tiên commit-candidate files bằng `git ls-files --cached --others --exclude-standard`. Không có tracked secret được xác nhận. | Chạy GitHub Production Release Gate trên đúng candidate trước release; thêm scanner fixtures nếu có false-positive mới. |
| GitHub Actions cho commit hiện tại | PARTIAL / NEEDS RELEASE GATE VERIFICATION | Task 1 đã xác minh CI run `31262520384` PASS cho audited HEAD, nhưng chưa có verified GitHub Production Release Gate run cho cùng candidate. | Kiểm tra Production Release Gate status và artifact cho pushed commit SHA trước release. |
| Staging smoke | BLOCKED / NEEDS VERIFICATION | `staging-smoke.mjs` bị chặn nếu thiếu `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, và `STAGING_TEST_USER_HINT`; OAuth browser callback vẫn cần browser credential evidence thật. | Configure staging secrets, chạy smoke, và lưu artifact. |
| Restore/backup rehearsal | BLOCKED / NEEDS VERIFICATION | Gate yêu cầu `docs/restore-rehearsal-evidence.md` hoặc `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`; hiện chưa có evidence file. | Thực hiện non-production restore rehearsal và ghi lại safe evidence. |

## Bảng Ưu Tiên

| Hạng | Độ khó | Tác động | Khu vực | Điểm yếu | Vì sao quan trọng | Cách xử lý đề xuất | Cách kiểm chứng | Mức tăng điểm dự kiến |
| ---: | ---------- | ------ | ---- | -------- | -------------- | --------------- | ------------ | ------------------: |
| 1 | Easy | High | CI/CD/release gate | CI status cho audited HEAD đã PASS một phần; Production Release Gate cho candidate vẫn chưa verified. | Local pass không phải release signal, và CI PASS không thay thế release-gate artifact. | Kiểm tra Production Release Gate cho đúng commit SHA; link artifacts trong release notes. | GitHub checks hiển thị CI PASS và Production Release Gate PASS hoặc documented BLOCKED controls cho cùng SHA. | 0.15 |
| 2 | Easy | High | CI/CD/release gate | Local secret scan gate đã PASS sau fallback fix; GitHub Production Release Gate vẫn cần verify cho candidate. | False-positive hoặc bỏ sót real secret sẽ chặn safe release. | Giữ `secret-scan.mjs` ưu tiên `git ls-files --cached --others --exclude-standard`; fallback chỉ bỏ qua ignored local `.env` khi Git listing không khả dụng. Chạy GitHub gate cho đúng SHA. | Local `secret-scan.json` có `findingCount: 0`; không có tracked `.env` hoặc secret-like files; GitHub gate được ghi evidence riêng. | 0.20 |
| 3 | Easy | High | Deployment/production operations | Staging smoke được cấu hình làm gate nhưng chưa có evidence. | Production confidence cần hành vi URL deployed thật, không chỉ local mocks. | Configure staging URLs/test hint và chạy `npm run gate:staging-smoke`; thêm manual OAuth login/logout evidence. | Staging smoke PASS cộng OAuth browser notes. | 0.25 |
| 4 | Easy | High | Deployment/production operations | Thiếu restore rehearsal evidence. | Backups chưa được chứng minh cho đến khi restore được rehearsal. | Restore một non-production backup, verify app startup/health, và tạo `docs/restore-rehearsal-evidence.md` không chứa raw data. | `gate:backup-rollback` PASS. | 0.30 |
| 5 | Easy | High | Observability/monitoring | Render memory incident thiếu root-cause data. | Restart lặp lại có thể làm mất niềm tin và che giấu leaks hoặc spikes thật. | Export Render Metrics quanh sự cố, ghi lại RAM/CPU/request trend, và phân loại leak/spike/headroom. | Incident note có metrics timestamps và kết luận. | 0.25 |
| 6 | Easy | High | Observability/monitoring | Alerting rules mới chỉ được document, chưa connected. | Metrics không có alerts thì không bảo vệ uptime. | Thêm Render hoặc external alert thresholds cho health, 5xx, RAM 75/90%, AI failures, sync conflicts. | Alert config screenshot/export cộng test notification. | 0.20 |
| 7 | Easy | High | Documentation/product readiness | Docs chứa stale test counts và mâu thuẫn về metrics exposure. | Release decisions trở nên mơ hồ khi docs không thống nhất với source. | Update non-archive docs: bỏ hoặc đánh dấu historical các exact test counts chưa được rerun trong Task 6, làm rõ `metrics` exposure policy, đánh dấu historical schema docs là historical nếu stale. | `rg` xác nhận không còn current doc nào nói chỉ health/info được expose trong khi config expose metrics. | 0.10 |
| 8 | Medium | Critical | Security | `/api/sync` thiếu body-size cap trước deserialization. | JSON body lớn có thể làm spike memory trước khi Bean Validation chạy. | Thêm Spring/Tomcat/proxy max request size cho sync, reject sớm với 413, document limits. | MockMvc/container test cho oversized body và local memory smoke. | 0.45 |
| 9 | Medium | High | Database/performance | Review queue load toàn bộ user words rồi filter/sort trong Java. | Tài khoản lớn sẽ đốt memory/CPU và làm chậm due review. | Thêm repository query theo `nextReview <= now`, optional tag/level, ordered priority, bounded limit. | Repository/service tests cộng query plan trên PostgreSQL. | 0.25 |
| 10 | Medium | High | Database/performance | Analytics load words/history nhiều lần và aggregate trong memory. | Analytics có thể chậm và khuếch đại memory pressure. | Load một lần mỗi request, thêm bounded history windows hoặc SQL aggregates cho overview/trend/tag metrics. | Backend analytics tests và benchmark với seeded large account. | 0.25 |
| 11 | Medium | High | Sync/offline behavior | Snapshot và sync trả full vocab, wrong bank, tombstones, và recent history. | Full snapshots không scale và giữ tombstones không giới hạn. | Thiết kế delta sync theo revision với page limits và client acknowledgement cho tombstones. | Contract tests cho delta pages, stale clients, và tombstone retention. | 0.35 |
| 12 | Medium | High | CI/CD/release gate | Production gate chưa gắn với deployment. | Deploy có thể xảy ra mà không có GO artifact. | Làm deployment workflow phụ thuộc vào GO report cho cùng SHA hoặc document manual approval gate với artifact link. | Release workflow từ chối deploy nếu thiếu GO tương ứng. | 0.20 |
| 13 | Medium | High | Testing/QA | Playwright smoke không phải visual regression. | CSS refactors có thể pass smoke nhưng phá layout/readability. | Thêm screenshot baselines cho dashboard, quiz, vocabulary, analytics, studio, mobile widths. | `toHaveScreenshot` hoặc artifact comparison tương đương trong CI. | 0.25 |
| 14 | Medium | High | Security | CSP vẫn cần `unsafe-inline`. | Inline handlers làm XSS blast radius lớn hơn mức cần thiết. | Di chuyển inline handlers trong `index.html` sang JS event listeners từng bước; tighten CSP sau khi có coverage. | Security header tests update; Playwright flows vẫn pass. | 0.20 |
| 15 | Medium | Medium | Security | Public `/actuator/metrics/**` được `SecurityConfig` cho phép và gate defaults yêu cầu. | Public metrics có thể lộ operational shape; khóa lại có thể phá ops visibility hiện tại. | Quyết định policy: giữ public có chủ ý với reviewed endpoint list, hoặc bảo vệ metrics sau monitoring/auth và update gate. | Security tests và release gate thống nhất với policy đã chọn. | 0.15 |
| 16 | Medium | Medium | Backend architecture | `VocabularyService` vẫn sở hữu CRUD, starter import, quiz result, và snapshot delegation. | Service quá rộng làm thay đổi khó reason và test hơn. | Tách quiz result processor và starter import use case trước; giữ controller/API không đổi. | Existing backend tests cộng focused service tests pass. | 0.15 |
| 17 | Medium | Medium | Backend architecture | `CurrentUserService.requireUser()` update activity trong lúc auth lookup bình thường. | Read endpoints tạo writes và có thể tăng DB pressure. | Tách read-only current user lookup khỏi rate-limited activity touch. | Backend auth/profile tests và test đơn giản cho request-count/write behavior. | 0.15 |
| 18 | Medium | Medium | Testing/QA | Không có generated OpenAPI hoặc machine-checked API contract. | Docs có thể drift khỏi endpoints và frontend expectations. | Thêm OpenAPI generation hoặc checked contract snapshots cho core API, CSRF, sync V2, errors. | Contract generation/check trong CI. | 0.20 |
| 19 | Medium | Medium | Database/performance | Normalized duplicate English được enforce bằng service scans, không phải DB constraint. | External/manual data changes có thể tái tạo duplicates; service scans chậm. | Audit production duplicates, sau đó thêm generated normalized key hoặc unique index nếu sạch. | Read-only Supabase duplicate audit và migration rehearsal. | 0.15 |
| 20 | Medium | Medium | Sync/offline behavior | Local-first stats có thể diverge offline cho đến khi cloud xác nhận official stats. | Users có thể thấy khác biệt tạm thời giữa local và cloud progress. | Document rõ UI distinction và cân nhắc hiển thị official-cloud vs local fallback status. | Playwright local/offline/auth smoke. | 0.10 |
| 21 | Hard | High | Frontend architecture | `frontend/js/app.js` vẫn là global-script module lớn. | Coupling auth, sync, profile, dashboard, import/export làm safe changes chậm. | Tách theo global-compatible namespaces trước; tránh framework rewrite. | Node syntax checks, Playwright full smoke, load-order tests. | 0.25 |
| 22 | Hard | High | Frontend architecture | `frontend/js/learning-studio.js` trộn profile/history/decks/CSV/focus/AI deck. | Thay đổi Studio có regression risk cao. | Tách thành các file global-compatible tập trung hoặc một internal module registry nhỏ. | Playwright studio, AI deck, CSV/import tests. | 0.20 |
| 23 | Hard | Medium | Frontend architecture | `frontend/css/modern.css` core vẫn 4,428 dòng theo newline count; `design-system.css` lớn và không được load. | CSS ownership không rõ và visual regressions dễ xảy ra. | Tiếp tục domain splits chỉ khi có screenshot regression; audit unused selectors trước khi xóa. | Static build, smoke, screenshot tests. | 0.15 |
| 24 | Hard | Medium | Testing/QA | `tests/smoke.spec.js` là all-in-one suite dài 1,050 dòng. | Test helpers và sync fixtures khó reuse và review. | Tách helpers/fixtures và specs theo feature. | Cùng 29 Playwright tests pass mà không đổi behavior. | 0.10 |
| 25 | Hard | Medium | Deployment/production operations | JVM/RSS memory budget chưa được codify. | Render free/low-memory instances có thể restart mà không có app-level OOM. | Test `JAVA_TOOL_OPTIONS` trong staging, đặt heap/metaspace/thread budget, document rollback. | Staging boot/load smoke và metrics trước/sau. | 0.20 |
| 26 | Hard | Medium | Observability/monitoring | Chưa configure external APM/error tracker. | Request IDs và metrics chỉ hữu ích sau khi có người inspect. | Thêm Sentry/OpenTelemetry/host alerts khi traffic justify; giữ secrets server-side. | Error test event và dashboard link trong release evidence. | 0.15 |
| 27 | Very Hard | High | Sync/offline behavior | Chưa có large-account sync/load benchmark. | Các lựa chọn architecture đang là phỏng đoán nếu thiếu payload và memory measurements. | Tạo seeded large account benchmark cho sync, snapshot, review, analytics. | CI/manual benchmark report với max payload/RSS/p95 latency. | 0.25 |
| 28 | Very Hard | Medium | Backend architecture | AI rate limiting là process-local. | Đây không phải global quota nếu backend scale ngang. | Chỉ thêm Redis/distributed limiter khi có multi-instance, abuse, hoặc cost evidence. | Multi-instance integration test. | 0.10 |
| 29 | Very Hard | Low | Frontend architecture | Full framework/bundler migration rất dễ hấp dẫn. | Nó có thể nuốt scope trong khi trì hoãn production blockers. | Hoãn cho đến khi runtime risk thấp hơn và visual/API contracts đã khóa. | RFC riêng và migration branch riêng. | 0.05 |

## Điểm Yếu Theo Khu Vực

### Security

- OPEN: `/api/sync` cần hard request body-size cap trước JSON
  deserialization.
- OPEN: Public `/actuator/metrics/**` hiện được permit trong
  `SecurityConfig`; release gate hiện kỳ vọng metrics được expose. Cần quyết
  định và align docs, tests, và gate.
- PARTIAL: CSP vẫn cho phép `unsafe-inline` vì `index.html` dùng inline event
  handlers và static global scripts.
- PASS LOCALLY / NEEDS GITHUB GATE VERIFICATION: Task 2 secret scan đã PASS
  local với `findingCount: 0`; fallback đã được sửa để không scan ignored
  local `.env` files khi Node không spawn được Git. Đường scan ưu tiên vẫn là
  `git ls-files --cached --others --exclude-standard`, và không có tracked
  secret được xác nhận.
- ACCEPTED LIMITATION: AI limiter là in-memory và chỉ phù hợp với giả định
  single-instance hiện tại.

### Backend Architecture

- `VocabularyService` vẫn rộng ngay cả sau khi đã tách `SyncService`.
- `CurrentUserService.requireUser()` kết hợp identity lookup với activity
  update/write behavior.
- `LearningAnalyticsService` và `SpacedRepetitionService` dùng service-layer
  streaming cho phần việc nên chuyển thành repository/SQL bounded khi dữ liệu
  tăng.
- Chưa có generated OpenAPI contract.

### Frontend Architecture

- `app.js` và `learning-studio.js` vẫn là global-script modules lớn.
- `index.html` vẫn có inline event handlers và phụ thuộc vào script order chính
  xác.
- `modern.css` đã được split một phần, nhưng core stylesheet vẫn lớn và rủi ro
  về visual.
- `design-system.css` lớn và có vẻ không được `index.html` load; cần audit
  selector usage trước khi remove hoặc split.

### Database/Performance

- Full user vocabulary/history/tombstone loads vẫn phổ biến.
- Duplicate English enforcement dùng service scans thay vì normalized DB key.
- Production schema drift và Flyway baseline state cần external Supabase
  verification.
- Chưa có large-account benchmark document payload size, query count, latency,
  hoặc memory.

### Sync/Offline Behavior

- Sync V2 an toàn hơn nhiều so với contract cũ, nhưng payload size và full
  snapshots vẫn giới hạn khả năng scale.
- Tombstones được retain thận trọng; retention/ack policy là future work.
- Local-first progress có thể tạm thời diverge khỏi official cloud state.
- Frontend sync state vẫn phức tạp và coupled với localStorage, global data, và
  UI status.

### Testing/QA

- Backend và Playwright coverage mạnh cho security/sync smoke.
- Không có load/performance tests cho sync, review, analytics, hoặc snapshot.
- Không có screenshot/visual regression gate.
- Deployed OAuth browser flow chưa được local tests chứng minh.
- `tests/smoke.spec.js` nên được tách sau khi vẫn giữ suite green.

### CI/CD/Release Gate

- CI workflow tồn tại và có ý nghĩa, nhưng remote status hiện tại phải được
  verify theo từng commit.
- Production Release Gate tồn tại nhưng chưa phải deployment workflow.
- Staging smoke và restore rehearsal có thể `BLOCKED` nếu thiếu external setup.
- Gate hiện coi `metrics` là required, mâu thuẫn với câu hỏi audit rằng liệu
  public metrics có nên tiếp tục mở hay không.

### Deployment/Production Operations

- Không có `render.yaml` hoặc `vercel.json`, nên host config là manual.
- Render memory incident cần classification dựa trên metrics.
- JVM/RSS budget chưa được codify trong deployment config.
- Restore evidence chưa có trong repo.
- Runbooks tốt, nhưng operational proof chưa đầy đủ.

### Observability/Monitoring

- Request IDs, MDC, Micrometer, Actuator, và counters đã tồn tại.
- External alerting/APM mới chỉ được document, chưa integrated.
- Metrics đang public theo source hiện tại; protection/intent cần một quyết
  định.
- Render Metrics quanh incident vẫn là external và chưa verified.

### Documentation/Product Readiness

- Docs hiện tại phần lớn supersede các audit findings cũ một cách đúng đắn.
- Các mâu thuẫn hiện tại cần sửa:
  - `docs/deploy.md` nói chỉ expose `health` và `info`, trong khi source và
    config expose `metrics`.
  - Một số verification docs vẫn trộn test counts cũ 91/28 và 98/29. Task 6
    không rerun full regression, nên exact counts phải được refresh bằng một
    lần chạy mới trước release.
  - Historical schema/audit docs nằm ngoài archive vẫn chứa stale statements
    như ngôn ngữ Flyway readiness cũ; đánh dấu chúng bằng historical status
    banner hoặc update.
- Product docs hữu ích nhưng nhẹ hơn app đã implement; giữ chúng là product
  notes, không phải release evidence.

## Tasks Từ Dễ Đến Khó

1. Verify GitHub Actions status cho current pushed commit.
2. Chạy clean `gate:secret-scan`; thêm scanner fixtures nếu cần.
3. Configure và chạy staging smoke.
4. Thêm restore rehearsal evidence.
5. Capture Render memory metrics và classify incident.
6. Align docs và release gate về Actuator metrics exposure policy.
7. Refresh stale test counts và historical status banners trong current docs.
8. Thêm pre-deserialization body cap cho `/api/sync`.
9. Thêm repository-bounded review queue query.
10. Giảm repeated analytics loads và thêm bounded history windows.
11. Thêm screenshot regression baselines.
12. Thêm generated OpenAPI hoặc checked contract spec.
13. Benchmark seeded large-account sync/review/analytics.
14. Tách responsibilities khỏi `VocabularyService`.
15. Tách frontend `app.js` và `learning-studio.js` từng bước.
16. Thiết kế delta sync và tombstone acknowledgement.
17. Thêm external alerting/APM.
18. Chỉ cân nhắc distributed AI rate limiting sau khi có scale evidence.

## Fast Wins Tác Động Cao Nhất

- Verify GitHub Actions và release-gate status cho đúng commit.
- Đóng các blockers secret-scan, staging-smoke, và restore-rehearsal gate.
- Capture Render Metrics và thêm alert thresholds.
- Thêm `/api/sync` request body cap.
- Quyết định và align public metrics exposure.
- Thêm screenshot regression cho UI hiện tại trước các refactors CSS/HTML tiếp
  theo.

## Không Nên Làm Quá Sớm

- Không rewrite frontend sang React/Vue hoặc bundler trước khi release blockers
  và screenshot baselines được đóng.
- Không thêm Redis/distributed rate limiting cho đến khi có multi-instance hoặc
  abuse/cost evidence.
- Không xóa tombstones nếu chưa có acknowledgement/retention design.
- Không thêm normalized unique vocabulary index trước production duplicate audit
  và cleanup.
- Không xóa archive/history docs chỉ để giảm line count.
- Không kết hợp CSS cleanup với learning-flow hoặc sync behavior changes.
- Không coi việc nâng cấp Render plan là root-cause fix cho đến khi metrics
  chứng minh vấn đề chỉ là headroom.

## Roadmap Đến 8.0

### Phase 1: Easy, Low-Risk, Fast Score Gain

Mục tiêu: tăng confidence bằng cách chứng minh release candidate hiện tại, không
phải bằng cách đổi behavior.

- Verify CI và Production Release Gate cho current commit SHA.
- Đã chạy clean `gate:secret-scan` local và sửa fallback để không scan ignored
  local `.env` khi Git listing không khả dụng; vẫn cần GitHub Production
  Release Gate evidence cho đúng candidate.
- Configure staging smoke variables và chạy staging smoke.
- Thực hiện non-production restore rehearsal và ghi evidence.
- Capture Render memory metrics và classify restart.
- Update current docs để loại bỏ stale test counts và mâu thuẫn về metrics
  exposure.

Điểm dự kiến sau Phase 1: khoảng `7.3/10`.

Evidence cập nhật cho Task 2:

- `npm run gate:secret-scan` PASS local sau khi sửa fallback scan trong
  `scripts/production-release-gate/secret-scan.mjs`.
- Script vẫn ưu tiên scan commit-candidate files bằng
  `git ls-files --cached --others --exclude-standard`.
- Fallback filesystem walk không còn scan ignored local `.env`/`.env.*` files
  khi Git listing không khả dụng.
- `git check-ignore -v .env backend/.env` xác nhận `.env` và `backend/.env`
  được ignore; `git ls-files --cached --others --exclude-standard .env
  backend/.env` không trả path nào.
- Không có tracked secret được xác nhận. Kết quả này không thay thế GitHub
  Production Release Gate evidence và không làm dự án thành production-ready.

Evidence cập nhật cho Task 3:

- Package scripts hiện có cho release gate/source checks gồm `build:frontend`,
  `gate:source-integrity`, `gate:secret-scan`, `gate:validate-env`,
  `gate:backup-rollback`, `gate:staging-smoke`, và `gate:report`.
- PASS local thật: `npm run gate:secret-scan`, `npm run build:frontend`,
  `npm run gate:validate-env -- --control=production-env-validation` với safe
  fixture, và `npm run gate:validate-env -- --control=production-env-invalid-fixture
  --expect-invalid`.
- BLOCKED thật: `npm run gate:backup-rollback` thiếu restore rehearsal evidence;
  `npm run gate:staging-smoke` thiếu `STAGING_BACKEND_URL`,
  `STAGING_FRONTEND_URL`, và `STAGING_TEST_USER_HINT`.
- NEEDS VERIFICATION: `gate:source-integrity` cần chạy trên clean release
  candidate vì script cố ý fail khi working tree dirty. `gate:report` chưa chạy
  vì các mandatory controls còn BLOCKED/NOT_RUN sẽ tạo NO-GO report.

Evidence cập nhật cho Task 4:

- `staging-smoke.mjs` yêu cầu đúng ba env:
  `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, và `STAGING_TEST_USER_HINT`.
- Môi trường local hiện thiếu cả ba env, nên `npm run gate:staging-smoke`
  tiếp tục BLOCKED. Không hardcode URL/user/secret và không dùng production
  credential.
- Để chuyển sang PASS, cần cấu hình staging URLs HTTPS thật và non-secret test
  user hint; script phải verify `/api/health`, `/api/csrf` có JSON/cookie, và
  frontend root. OAuth browser callback vẫn cần evidence riêng.

Evidence cập nhật cho Task 5:

- `gate:backup-rollback` yêu cầu các runbook docs hiện có cộng với concrete
  restore rehearsal evidence qua `docs/restore-rehearsal-evidence.md` hoặc
  `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`.
- Required docs và required terms đã có, nhưng `docs/restore-rehearsal-evidence.md`
  và env `RELEASE_RESTORE_REHEARSAL_EVIDENCE` đều đang thiếu, nên gate vẫn
  BLOCKED / NEEDS VERIFICATION.
- Đã thêm `docs/restore-rehearsal-checklist.md` như checklist/template chuẩn bị
  an toàn. Đây không phải evidence hoàn tất và không làm `gate:backup-rollback`
  PASS.
- Chỉ chuyển sang PASS sau một restore rehearsal thật trên non-production DB,
  không dùng production credential, không chứa raw data/secret, và
  `npm run gate:backup-rollback` báo `[PASS] backup-rollback-readiness`.

### Phase 2: Security, Performance, And Release Hardening

Mục tiêu: đóng các vấn đề có khả năng cao nhất làm hỏng production dưới tải
small public beta.

- Thêm pre-deserialization body-size cap cho `/api/sync`.
- Thêm request/payload tests và documented sync payload budget.
- Quyết định public metrics policy và align `SecurityConfig`, env gate, và docs.
- Thêm JVM/RSS budget và memory alerts trong staging.
- Thêm repository-bounded review query và giảm analytics repeated list loads.
- Thêm OpenAPI/contract checks cho core API và Sync V2.

Điểm dự kiến sau Phase 2: khoảng `7.7/10`.

### Phase 3: Frontend And Backend Refactor Discipline

Mục tiêu: giảm regression cost mà không đổi product behavior.

- Tách `app.js` theo auth/session, sync/delete queue, profile/dashboard, và
  import/export trong khi vẫn giữ global compatibility.
- Tách `learning-studio.js` theo decks, AI deck, CSV, focus, và profile/history.
- Chỉ tiếp tục split `modern.css` khi có screenshot regression.
- Tách `tests/smoke.spec.js` helpers và specs theo feature.
- Tách backend quiz result processing và starter import use cases khỏi
  `VocabularyService`.

Điểm dự kiến sau Phase 3: khoảng `7.9/10`.

### Phase 4: Production Operations, Monitoring, Backup, Staging Discipline

Mục tiêu: làm production readiness có thể lặp lại.

- Làm deployment phụ thuộc vào GO release-gate artifact cho cùng SHA.
- Thêm external alert routing và incident runbook links.
- Thêm large-account benchmark reports vào release evidence.
- Rehearse Supabase schema/Flyway baseline trên một copy trước production.
- Thêm post-deploy authenticated OAuth smoke discipline.

Điểm dự kiến sau Phase 4: `8.0/10` nếu Phases 1-3 cũng hoàn tất và được
verified.

## Ngưỡng Tối Thiểu Để Gọi Là Production-Ready

Không gọi dự án là production-ready cho đến khi tất cả điều sau đúng:

- Render memory incident đã được classify và monitor.
- `/api/sync` reject oversized bodies trước deserialization.
- CI và Production Release Gate pass cho đúng release commit.
- Secret scan, source integrity, staging smoke, và backup/restore controls là
  PASS hoặc có external evidence thật, documented.
- Production env validation pass với giá trị thật và không in secrets.
- Staging OAuth login/logout, vocabulary add/delete, sync, review, analytics,
  và AI fallback/rate-limit smoke pass.
- Production database backup và non-production restore rehearsal đã được ghi
  nhận.
- Actuator metrics exposure policy rõ ràng và được test.
- Visual regression baseline tồn tại trước các UI/CSS churn tiếp theo.

## Cần Verification

- Render Metrics quanh memory-limit restart ngày 2026-08-07.
- GitHub Production Release Gate status và artifact cho audited HEAD
  `adc2b0bb825dbd6397bdba3ea67656d2b676f7d4` và bất kỳ release candidate nào
  sau đó.
- Production Release Gate result trên clean candidate.
- Staging smoke với staging URLs và test identity thật.
- Google OAuth browser flow trong staging/production.
- Restore rehearsal trên non-production database.
- Production Supabase schema drift, duplicate vocabulary, orphan rows, và Flyway
  history state.
- Large-account memory/latency behavior cho sync, snapshot, review, và
  analytics.
