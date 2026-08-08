# Kế Hoạch Nâng Cấp Chất Lượng Lên 8.0

Ngày: 2026-08-08

Phạm vi: branch hiện tại `chore/audit-reconciliation-and-upgrade`, source code,
docs, backend/frontend tests, GitHub workflows, Docker/config, package scripts,
cấu hình Maven, và các release-gate scripts. Đây chỉ là audit và kế hoạch hành
động; không có runtime code nào được thay đổi cho tài liệu này.

## Ước Lượng Điểm Hiện Tại

Điểm chất lượng/readiness hiện tại ước lượng: `6.9/10` với khoảng thực tế
`6.7-7.1`.

Đây không phải là việc dùng lại mù quáng điểm audit cũ `6.8/10`. Source hiện
tại đã mạnh hơn đáng kể so với các finding cũ ở mức 5.6/10 và giai đoạn đầu
6.8/10:

- CSRF đã được bật cho các unsafe requests dùng cookie/session.
- Quiz XP, statistics, mastery, và achievements chính thức được tính ở
  server-side.
- Sync V2 dùng `wordUid`, `expectedRevision`, tombstones, và legacy ID bridge.
- Production profile cố định Hibernate ở `validate`, bật Flyway, tắt Flyway
  clean, và từ chối cấu hình production DB không an toàn khi startup.
- CI và production release gate đã tồn tại, có backend, frontend, Flyway,
  security, observability, staging, và backup controls.
- Kiểm chứng local ngay trước kế hoạch này gồm backend tests, frontend static
  build, và Playwright đều pass trên refactor commit trước đó.

Điểm vẫn dưới 8.0 vì bằng chứng production, giới hạn sử dụng tài nguyên,
hành vi với tài khoản dữ liệu lớn, frontend architecture, visual regression,
và kỷ luật vận hành vẫn chưa đủ mạnh. Mức hardening của code đã gần 8+, nhưng
production readiness vẫn gần 6.2 hơn cho tới khi có bằng chứng release gate bên
ngoài thật sự.

## Vì Sao Dự Án Chưa Đạt 8.0

Source hiện tại là một nền tảng beta tốt, chưa phải một hệ thống vận hành cấp
production. Các khoảng trống lớn nhất là:

- Một lần Render memory-limit restart đã được xác nhận nhưng chưa có phân loại
  root cause.
- `/api/sync` validate kích thước list sau khi Jackson đã deserialize toàn bộ
  JSON body.
- Release gate status cho commit hiện tại chưa được xác minh trong GitHub
  Actions từ workspace này.
- Staging smoke và restore rehearsal vẫn là bằng chứng bên ngoài, không phải
  source facts.
- Public Actuator metrics đang được config/gate hiện tại cho phép có chủ ý,
  nhưng docs cũng đặt câu hỏi liệu public metrics có nên tiếp tục mở hay không.
- Review, analytics, sync, và snapshot flows vẫn load các list lớn theo từng
  user.
- Frontend vẫn phụ thuộc vào global script order và các file lớn.
- Playwright smoke đã có, nhưng screenshot/visual regression chưa là gate.
- Docs hiện tại phần lớn đã được reconcile, nhưng một vài file vẫn còn câu chữ
  historical hoặc lạc quan có thể làm nhiễu quyết định release.

## Blocker Cần Xử Lý Trước

| Blocker | Trạng thái | Bằng chứng | Hành động bắt buộc |
| --- | --- | --- | --- |
| Render memory-limit restart | OPEN | Docs hiện tại ghi nhận một lần Render memory-limit restart đã xác nhận, nhưng source không thể xác định leak vs payload spike vs thiếu headroom instance. | Thu Render Metrics quanh thời điểm incident, correlate request/log evidence, đặt JVM/RSS budget đã test, và thêm alert thresholds. |
| `/api/sync` pre-deserialization payload cap | OPEN | `SyncRequest` có giới hạn list `@Size(max=5000)`, nhưng Spring/Jackson phải parse body trước. | Thêm request-body cap ở container/filter/proxy level, thêm oversized-body tests, rồi thiết kế chunk/delta sync. |
| Release gate secret scan | OPEN / NEEDS VERIFICATION | `secret-scan.mjs` hiện tại scan các git candidate files và tránh ignored files, nhưng vấn đề local gate trước đó phải được xác minh trên clean release candidate. | Chạy `npm run gate:secret-scan` và GitHub Production Release Gate trên đúng candidate; thêm scanner fixtures cho empty env placeholders. |
| GitHub Actions cho commit hiện tại | NEEDS VERIFICATION | Workflows đã tồn tại, nhưng audit này chưa query remote run status. | Kiểm tra CI và Production Release Gate status cho pushed commit SHA trước khi release. |
| Staging smoke | BLOCKED / NEEDS VERIFICATION | `staging-smoke.mjs` block nếu thiếu `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`, và `STAGING_TEST_USER_HINT`; OAuth browser callback vẫn cần bằng chứng credential trên browser thật. | Cấu hình staging secrets, chạy smoke, và lưu artifact. |
| Restore/backup rehearsal | BLOCKED / NEEDS VERIFICATION | Gate yêu cầu `docs/restore-rehearsal-evidence.md` hoặc `RELEASE_RESTORE_REHEARSAL_EVIDENCE=true`; hiện chưa có evidence file. | Thực hiện restore rehearsal trên non-production và ghi lại bằng chứng an toàn. |

## Bảng Ưu Tiên

| Xếp hạng | Độ khó | Tác động | Mảng | Điểm yếu | Vì sao quan trọng | Cách xử lý đề xuất | Cách kiểm chứng | Mức tăng điểm dự kiến |
| ---: | ---------- | ------ | ---- | -------- | ----------------- | ------------------ | --------------- | --------------------: |
| 1 | Easy | High | CI/CD/release gate | GitHub Actions status cho commit hiện tại chưa được xác minh. | Local pass không phải tín hiệu release. | Kiểm tra CI và Production Release Gate cho đúng commit SHA; link artifacts trong release notes. | GitHub checks hiển thị PASS hoặc documented BLOCKED controls cho cùng SHA. | 0.15 |
| 2 | Easy | High | CI/CD/release gate | Secret scan release blocker cần một clean candidate run. | False-positive hoặc bỏ sót secret thật đều chặn release an toàn. | Chạy `npm run gate:secret-scan` trên clean tree và GitHub gate; thêm fixture tests nếu nó lại flag empty env placeholders. | Clean scan artifact; không có tracked `.env` hoặc secret-like files. | 0.20 |
| 3 | Easy | High | Deployment/production operations | Staging smoke được cấu hình là gate nhưng chưa có bằng chứng. | Production confidence cần hành vi trên deployed URL thật, không chỉ local mocks. | Cấu hình staging URLs/test hint và chạy `npm run gate:staging-smoke`; thêm bằng chứng manual OAuth login/logout. | Staging smoke PASS cộng với OAuth browser notes. | 0.25 |
| 4 | Easy | High | Deployment/production operations | Thiếu restore rehearsal evidence. | Backup chưa được chứng minh cho tới khi restore được diễn tập. | Restore một non-production backup, xác minh app startup/health, và tạo `docs/restore-rehearsal-evidence.md` không chứa raw data. | `gate:backup-rollback` PASS. | 0.30 |
| 5 | Easy | High | Observability/monitoring | Render memory incident thiếu dữ liệu root cause. | Restart lặp lại có thể làm mất niềm tin và che giấu leak hoặc spike thật. | Export Render Metrics quanh incident, ghi lại trend RAM/CPU/request, và phân loại leak/spike/headroom. | Incident note có metrics timestamps và kết luận. | 0.25 |
| 6 | Easy | High | Observability/monitoring | Alerting rules mới chỉ được document, chưa connected. | Metrics không có alerts thì không bảo vệ uptime. | Thêm Render hoặc external alert thresholds cho health, 5xx, RAM 75/90%, AI failures, sync conflicts. | Alert config screenshot/export cộng với test notification. | 0.20 |
| 7 | Easy | High | Documentation/product readiness | Docs còn stale counts và mâu thuẫn về metrics exposure. | Release decisions bị nhiễu khi docs không khớp source. | Update non-archive docs: test counts mới nhất 98/29 ở nơi phù hợp, làm rõ policy expose `metrics`, đánh dấu historical schema docs là historical nếu stale. | `rg` xác nhận không có current doc nào nói chỉ expose health/info trong khi config expose metrics. | 0.10 |
| 8 | Medium | Critical | Security | `/api/sync` thiếu body-size cap trước deserialization. | JSON body lớn có thể làm memory spike trước khi Bean Validation chạy. | Thêm Spring/Tomcat/proxy max request size cho sync, reject sớm với 413, document limits. | MockMvc/container test cho oversized body và local memory smoke. | 0.45 |
| 9 | Medium | High | Database/performance | Review queue load toàn bộ user words rồi filter/sort trong Java. | Tài khoản lớn sẽ tốn memory/CPU và làm chậm due review. | Thêm repository query theo `nextReview <= now`, optional tag/level, ordered priority, bounded limit. | Repository/service tests cộng với query plan trên PostgreSQL. | 0.25 |
| 10 | Medium | High | Database/performance | Analytics load words/history nhiều lần và aggregate trong memory. | Analytics có thể chậm và khuếch đại memory pressure. | Load một lần cho mỗi request, thêm bounded history windows hoặc SQL aggregates cho overview/trend/tag metrics. | Backend analytics tests và benchmark với seeded large account. | 0.25 |
| 11 | Medium | High | Sync/offline behavior | Snapshot và sync trả về full vocab, wrong bank, tombstones, và recent history. | Full snapshots không scale và giữ tombstones không giới hạn. | Thiết kế delta sync theo revision với page limits và client acknowledgement cho tombstones. | Contract tests cho delta pages, stale clients, và tombstone retention. | 0.35 |
| 12 | Medium | High | CI/CD/release gate | Production gate chưa gắn với deployment. | Deploy có thể xảy ra khi chưa có GO artifact. | Làm deployment workflow phụ thuộc vào GO report cho cùng SHA hoặc document manual approval gate kèm artifact link. | Release workflow từ chối deploy nếu thiếu GO khớp. | 0.20 |
| 13 | Medium | High | Testing/QA | Playwright smoke không phải visual regression. | CSS refactors có thể pass smoke nhưng làm hỏng layout/readability. | Thêm screenshot baselines cho dashboard, quiz, vocabulary, analytics, studio, mobile widths. | `toHaveScreenshot` hoặc artifact comparison tương đương trong CI. | 0.25 |
| 14 | Medium | High | Security | CSP vẫn cần `unsafe-inline`. | Inline handlers làm XSS blast radius lớn hơn cần thiết. | Chuyển dần inline handlers trong `index.html` sang JS event listeners; tighten CSP sau khi có coverage. | Security header tests update; Playwright flows vẫn pass. | 0.20 |
| 15 | Medium | Medium | Security | Public `/actuator/metrics/**` được `SecurityConfig` cho phép và gate defaults yêu cầu. | Public metrics có thể lộ operational shape; khóa lại có thể phá ops visibility hiện tại. | Quyết định policy: giữ public có chủ ý với endpoint list đã review, hoặc bảo vệ metrics sau monitoring/auth và update gate. | Security tests và release gate khớp policy đã chọn. | 0.15 |
| 16 | Medium | Medium | Backend architecture | `VocabularyService` vẫn sở hữu CRUD, starter import, quiz result, và snapshot delegation. | Service quá rộng làm thay đổi khó reason và test hơn. | Extract quiz result processor và starter import use case trước; giữ nguyên controller/API. | Existing backend tests cộng với focused service tests pass. | 0.15 |
| 17 | Medium | Medium | Backend architecture | `CurrentUserService.requireUser()` update activity trong luồng auth lookup bình thường. | Read endpoints tạo write và có thể tăng DB pressure. | Tách read-only current user lookup khỏi rate-limited activity touch. | Backend auth/profile tests và test đơn giản về request-count/write behavior. | 0.15 |
| 18 | Medium | Medium | Testing/QA | Chưa có generated OpenAPI hoặc machine-checked API contract. | Docs có thể drift khỏi endpoints và frontend expectations. | Thêm OpenAPI generation hoặc checked contract snapshots cho core API, CSRF, sync V2, errors. | Contract generation/check trong CI. | 0.20 |
| 19 | Medium | Medium | Database/performance | Enforce duplicate English normalized bằng service scans, không phải DB constraint. | External/manual data changes có thể đưa duplicates trở lại; service scans chậm. | Audit production duplicates, rồi thêm generated normalized key hoặc unique index nếu clean. | Read-only Supabase duplicate audit và migration rehearsal. | 0.15 |
| 20 | Medium | Medium | Sync/offline behavior | Local-first stats có thể diverge offline cho tới khi cloud xác nhận official stats. | User có thể thấy khác biệt tạm thời giữa local và cloud progress. | Document rõ UI distinction và cân nhắc hiển thị official-cloud vs local fallback status. | Playwright local/offline/auth smoke. | 0.10 |
| 21 | Hard | High | Frontend architecture | `frontend/js/app.js` vẫn là global-script module lớn. | Auth, sync, profile, dashboard, import/export coupling khiến thay đổi an toàn bị chậm. | Extract theo global-compatible namespaces trước; tránh framework rewrite. | Node syntax checks, Playwright full smoke, load-order tests. | 0.25 |
| 22 | Hard | High | Frontend architecture | `frontend/js/learning-studio.js` trộn profile/history/decks/CSV/focus/AI deck. | Thay đổi studio có rủi ro regression cao. | Split thành các file global-compatible tập trung hoặc tiny internal module registry. | Playwright studio, AI deck, CSV/import tests. | 0.20 |
| 23 | Hard | Medium | Frontend architecture | `frontend/css/modern.css` core vẫn 4,428 dòng theo newline count; `design-system.css` lớn và không được load. | CSS ownership không rõ và dễ tạo visual regressions. | Tiếp tục domain splits chỉ khi có screenshot regression; audit unused selectors trước khi xóa. | Static build, smoke, screenshot tests. | 0.15 |
| 24 | Hard | Medium | Testing/QA | `tests/smoke.spec.js` là suite all-in-one 1,050 dòng. | Test helpers và sync fixtures khó reuse và review. | Split helpers/fixtures và specs theo feature. | Cùng 29 Playwright tests pass, không đổi behavior. | 0.10 |
| 25 | Hard | Medium | Deployment/production operations | JVM/RSS memory budget chưa được codify. | Render free/low-memory instances có thể restart mà không có app-level OOM. | Test `JAVA_TOOL_OPTIONS` trong staging, đặt heap/metaspace/thread budget, document rollback. | Staging boot/load smoke và metrics trước/sau. | 0.20 |
| 26 | Hard | Medium | Observability/monitoring | Chưa cấu hình external APM/error tracker. | Request IDs và metrics chỉ hữu ích sau khi có người inspect. | Thêm Sentry/OpenTelemetry/host alerts khi traffic đủ justify; giữ secrets ở server-side. | Error test event và dashboard link trong release evidence. | 0.15 |
| 27 | Very Hard | High | Sync/offline behavior | Chưa có benchmark sync/load cho large account. | Lựa chọn kiến trúc chỉ là phỏng đoán nếu thiếu đo payload và memory. | Tạo seeded large account benchmark cho sync, snapshot, review, analytics. | CI/manual benchmark report có max payload/RSS/p95 latency. | 0.25 |
| 28 | Very Hard | Medium | Backend architecture | AI rate limiting là process-local. | Nó không phải global quota nếu backend scale horizontally. | Chỉ thêm Redis/distributed limiter khi có bằng chứng multi-instance, abuse, hoặc cost. | Multi-instance integration test. | 0.10 |
| 29 | Very Hard | Low | Frontend architecture | Full framework/bundler migration rất dễ bị hấp dẫn. | Việc này có thể ăn scope trong khi làm chậm production blockers. | Defer tới khi runtime risk thấp hơn và visual/API contracts đã khóa. | RFC riêng và migration branch riêng. | 0.05 |

## Điểm Yếu Theo Từng Mảng

### Security

- OPEN: `/api/sync` cần hard request body-size cap trước JSON
  deserialization.
- OPEN: Public `/actuator/metrics/**` hiện được permit trong
  `SecurityConfig`; release gate hiện cũng expects metrics exposed. Cần quyết
  định và align docs, tests, gate.
- PARTIAL: CSP vẫn cho phép `unsafe-inline` vì `index.html` dùng inline event
  handlers và static global scripts.
- NEEDS VERIFICATION: secret scan phải pass trên clean release candidate và
  không được scan ignored local `.env` files hoặc flag empty env placeholders.
- ACCEPTED LIMITATION: AI limiter là in-memory và chỉ phù hợp với giả định
  single-instance hiện tại.

### Backend Architecture

- `VocabularyService` vẫn rộng dù `SyncService` đã được extract.
- `CurrentUserService.requireUser()` kết hợp identity lookup với activity
  update/write behavior.
- `LearningAnalyticsService` và `SpacedRepetitionService` dùng service-layer
  streaming cho công việc nên chuyển thành repository/SQL bounded khi dữ liệu
  tăng.
- Chưa có generated OpenAPI contract.

### Frontend Architecture

- `app.js` và `learning-studio.js` vẫn là các global-script modules lớn.
- `index.html` vẫn có inline event handlers và phụ thuộc vào script order chính
  xác.
- `modern.css` đã được split một phần, nhưng core stylesheet vẫn lớn và rủi ro
  về visual.
- `design-system.css` lớn và có vẻ không được load bởi `index.html`; cần audit
  selector usage trước khi remove hoặc split.

### Database/Performance

- Full user vocabulary/history/tombstone loads vẫn xuất hiện phổ biến.
- Duplicate English enforcement dùng service scans thay vì normalized DB key.
- Production schema drift và Flyway baseline state cần external Supabase
  verification.
- Chưa có large-account benchmark document payload size, query count, latency,
  hoặc memory.

### Sync/Offline Behavior

- Sync V2 an toàn hơn contract cũ rất nhiều, nhưng payload size và full
  snapshots vẫn giới hạn scale.
- Tombstones được giữ theo hướng bảo thủ; retention/ack policy là future work.
- Local-first progress có thể tạm thời diverge khỏi official cloud state.
- Frontend sync state vẫn phức tạp và coupled với localStorage, global data,
  và UI status.

### Testing/QA

- Backend và Playwright coverage khá mạnh cho security/sync smoke.
- Chưa có load/performance tests cho sync, review, analytics, hoặc snapshot.
- Chưa có screenshot/visual regression gate.
- Deployed OAuth browser flow chưa được chứng minh bằng local tests.
- `tests/smoke.spec.js` nên được split sau khi giữ suite green.

### CI/CD/Release Gate

- CI workflow đã tồn tại và có ý nghĩa, nhưng remote status hiện tại phải được
  verify theo từng commit.
- Production Release Gate đã tồn tại nhưng chưa phải deployment workflow.
- Staging smoke và restore rehearsal có thể `BLOCKED` nếu thiếu external setup.
- Gate hiện coi `metrics` là bắt buộc, mâu thuẫn với câu hỏi audit liệu public
  metrics có nên tiếp tục mở hay không.

### Deployment/Production Operations

- Không có `render.yaml` hoặc `vercel.json`, nên host config là manual.
- Render memory incident cần phân loại dựa trên metrics.
- JVM/RSS budget chưa được codify trong deployment config.
- Restore evidence chưa có trong repo.
- Runbooks tốt, nhưng operational proof chưa đầy đủ.

### Observability/Monitoring

- Request IDs, MDC, Micrometer, Actuator, và counters đã tồn tại.
- External alerting/APM mới được document, chưa integrated.
- Metrics đang public theo source hiện tại; cần quyết định protection/intent.
- Render Metrics quanh incident vẫn là external và chưa được verify.

### Documentation/Product Readiness

- Docs hiện tại phần lớn đã supersede đúng các audit findings cũ.
- Các mâu thuẫn hiện tại cần sửa:
  - `docs/deploy.md` nói chỉ expose `health` và `info`, trong khi source và
    config expose `metrics`.
  - Một số verification docs vẫn nhắc test counts cũ 91/28 trong khi các lần
    chạy local gần đây là 98 backend tests và 29 Playwright tests.
  - Historical schema/audit docs ngoài archive vẫn chứa stale statements như
    ngôn ngữ Flyway readiness cũ; cần đánh dấu historical hoặc update status
    banner.
- Product docs hữu ích nhưng nhẹ hơn app đã implement; giữ chúng như product
  notes, không phải release evidence.

## Việc Cần Làm Xếp Từ Dễ Đến Khó

1. Verify GitHub Actions status cho current pushed commit.
2. Chạy clean `gate:secret-scan`; thêm scanner fixtures nếu cần.
3. Cấu hình và chạy staging smoke.
4. Thêm restore rehearsal evidence.
5. Thu Render memory metrics và phân loại incident.
6. Align docs và release gate về Actuator metrics exposure policy.
7. Refresh stale test counts và historical status banners trong current docs.
8. Thêm pre-deserialization body cap cho `/api/sync`.
9. Thêm repository-bounded review queue query.
10. Giảm repeated analytics loads và thêm bounded history windows.
11. Thêm screenshot regression baselines.
12. Thêm generated OpenAPI hoặc checked contract spec.
13. Benchmark seeded large-account sync/review/analytics.
14. Extract trách nhiệm của `VocabularyService`.
15. Extract frontend `app.js` và `learning-studio.js` từng bước.
16. Thiết kế delta sync và tombstone acknowledgement.
17. Thêm external alerting/APM.
18. Chỉ cân nhắc distributed AI rate limiting sau khi có scale evidence.

## Việc Impact Cao Nhất Để Nâng Điểm Nhanh

- Verify GitHub Actions và release-gate status cho đúng commit.
- Đóng các blocker secret-scan, staging-smoke, và restore-rehearsal gate.
- Thu Render Metrics và thêm alert thresholds.
- Thêm `/api/sync` request body cap.
- Quyết định và align public metrics exposure.
- Thêm screenshot regression cho UI hiện tại trước khi refactor CSS/HTML thêm.

## Việc Không Nên Làm Vội

- Không rewrite frontend sang React/Vue hoặc bundler trước khi release blockers
  và screenshot baselines được đóng.
- Không thêm Redis/distributed rate limiting cho tới khi có bằng chứng
  multi-instance hoặc abuse/cost.
- Không xóa tombstones nếu chưa có acknowledgement/retention design.
- Không thêm normalized unique vocabulary index trước khi audit và cleanup
  production duplicates.
- Không xóa archive/history docs chỉ để giảm line count.
- Không gộp CSS cleanup với thay đổi learning-flow hoặc sync behavior.
- Không coi nâng Render plan là root-cause fix cho tới khi metrics chứng minh
  vấn đề chỉ là thiếu headroom.

## Roadmap Lên 8.0

### Phase 1: Dễ, Ít Rủi Ro, Tăng Điểm Nhanh

Mục tiêu: tăng confidence bằng cách chứng minh release candidate hiện tại,
không phải bằng cách đổi behavior.

- Verify CI và Production Release Gate cho current commit SHA.
- Chạy clean `gate:secret-scan` và sửa scanner fixtures nếu cần.
- Cấu hình staging smoke variables và chạy staging smoke.
- Thực hiện non-production restore rehearsal và ghi evidence.
- Thu Render memory metrics và phân loại restart.
- Update current docs để loại bỏ stale test counts và mâu thuẫn metrics
  exposure.

Điểm dự kiến sau Phase 1: khoảng `7.3/10`.

### Phase 2: Security, Performance, Và Release Hardening

Mục tiêu: đóng các vấn đề dễ làm vỡ production dưới tải small public beta.

- Thêm pre-deserialization body-size cap cho `/api/sync`.
- Thêm request/payload tests và documented sync payload budget.
- Quyết định public metrics policy và align `SecurityConfig`, env gate, docs.
- Thêm JVM/RSS budget và memory alerts trong staging.
- Thêm repository-bounded review query và giảm repeated analytics list loads.
- Thêm OpenAPI/contract checks cho core API và Sync V2.

Điểm dự kiến sau Phase 2: khoảng `7.7/10`.

### Phase 3: Kỷ Luật Refactor Frontend Và Backend

Mục tiêu: giảm chi phí regression mà không đổi product behavior.

- Split `app.js` theo auth/session, sync/delete queue, profile/dashboard, và
  import/export trong khi vẫn giữ global compatibility.
- Split `learning-studio.js` theo decks, AI deck, CSV, focus, và
  profile/history.
- Chỉ tiếp tục split `modern.css` khi có screenshot regression.
- Split helpers và specs của `tests/smoke.spec.js` theo feature.
- Extract backend quiz result processing và starter import use cases khỏi
  `VocabularyService`.

Điểm dự kiến sau Phase 3: khoảng `7.9/10`.

### Phase 4: Production Operations, Monitoring, Backup, Staging Discipline

Mục tiêu: làm production readiness trở nên lặp lại được.

- Làm deployment phụ thuộc vào GO release-gate artifact cho cùng SHA.
- Thêm external alert routing và incident runbook links.
- Thêm large-account benchmark reports vào release evidence.
- Rehearse Supabase schema/Flyway baseline trên bản copy trước production.
- Thêm kỷ luật post-deploy authenticated OAuth smoke.

Điểm dự kiến sau Phase 4: `8.0/10` nếu Phase 1-3 cũng hoàn tất và được verify.

## Ngưỡng Tối Thiểu Để Gọi Là Production-Ready

Không gọi dự án là production-ready cho tới khi tất cả điều sau là đúng:

- Render memory incident đã được phân loại và monitored.
- `/api/sync` reject oversized bodies trước deserialization.
- CI và Production Release Gate pass cho đúng release commit.
- Secret scan, source integrity, staging smoke, và backup/restore controls đều
  PASS hoặc có bằng chứng external thật được document.
- Production env validation pass với real values và không print secrets.
- Staging OAuth login/logout, vocabulary add/delete, sync, review, analytics,
  và AI fallback/rate-limit smoke pass.
- Production database backup và non-production restore rehearsal đã được ghi
  nhận.
- Actuator metrics exposure policy rõ ràng và đã test.
- Visual regression baseline tồn tại trước khi tiếp tục UI/CSS churn.

## Cần Kiểm Chứng Thêm

- Render Metrics quanh memory-limit restart ngày 2026-08-07.
- GitHub Actions status cho commit `98120bd2ec78910fb1b4b5cee9d0e2ed499c7792`
  và bất kỳ release candidate nào sau đó.
- Production Release Gate result trên clean candidate.
- Staging smoke với staging URLs thật và test identity.
- Google OAuth browser flow trong staging/production.
- Restore rehearsal trên non-production database.
- Production Supabase schema drift, duplicate vocabulary, orphan rows, và
  Flyway history state.
- Large-account memory/latency behavior cho sync, snapshot, review, và
  analytics.
