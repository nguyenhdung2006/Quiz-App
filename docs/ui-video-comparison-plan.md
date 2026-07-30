# Ke hoach video so sanh UI WordArena Before/After

## Nguyen tac bat buoc

- Video cuoi chi duoc tao sau khi UI refactor da duoc phe duyet va trien khai.
- Khong dung trang thai sync loi lam bang chung UI.
- Tai khoan guest phai hien ro `Local mode` hoac `Sign in with Google to sync`.
- Cloud sync chi duoc danh gia khi dang nhap Google. Khong click Retry Sync, khong gia lap sync thanh cong, va khong coi guest local mode la bug.
- Before va After phai dung cung dataset, viewport, theme, thu tu thao tac, scroll position va thoi gian dung o moi canh.
- Video cuoi phai giup quyet dinh thay doi co dang lam hay khong, khong chi trinh bay giao dien dep hon.

## File video

Da tao:

- `docs/ui-audit-evidence/before-wordarena-desktop-flow.webm`

Bat buoc sau khi refactor:

- `docs/ui-audit-evidence/after-wordarena-desktop-flow.webm`
- `docs/ui-audit-evidence/before-after-wordarena-comparison.webm`

## Cau truc video cuoi

Video tong hop nen dai 60-90 giay, canvas 1920x1080, voi nhan `BEFORE` ben trai va `AFTER` ben phai. Hai clip phai chay dong bo. Neu scroll distance thay doi, giu cung diem bat dau va cung destination thay vi ep cung toc do scroll.

### 0:00-0:05 - Mo dau

- Ghi ro viewport nguon: 1366x768 desktop.
- Ghi ro dataset: 12 words, 5 review due, co focus words va quiz history.
- Ghi ro sync: guest local mode; Google sign-in required for cloud sync.
- Cau hoi danh gia: `UI moi co giup bat dau hoc nhanh va ro hon khong?`

### 0:05-0:20 - Dashboard va first viewport

Before can the hien:

- Hero chiem nhieu chieu cao.
- Review Due, Focus Words va Quick Quiz chua tao thanh mot learning plan ro rang.
- Quiz settings nam khoang y=1480 tai 1366x768.

After can the hien:

- Learning plan xuat hien trong first viewport.
- Mot hanh dong hoc chinh va ly do duoc uu tien.
- Review Due, Quick Quiz va Focus Words deu thay duoc ma khong scroll.

Callout bat buoc:

- Hero height Before/After.
- Quiz action vertical position Before/After.
- So primary CTA trong first viewport.
- Ket luan: thoi gian de hieu "hoc gi tiep theo" co giam khong.

### 0:20-0:37 - Quiz flow

Before va After cung thuc hien:

1. Bat dau quiz.
2. Xem mot cau hoi.
3. Chon mot dap an sai.
4. Xem dap an dung va nut tiep tuc.

Callout bat buoc:

- Sidebar/topbar/footer co con canh tranh su chu y khong.
- Cau hoi, bon dap an va feedback co nam trong mot viewport khong.
- Feedback co noi ro selected answer va correct answer ma khong chi dua vao mau sac khong.
- Nut tiep tuc co phai primary action duy nhat sau khi tra loi khong.
- Keyboard Enter va answer locking co bi regression khong.

### 0:37-0:52 - Vocabulary

Before va After cung thuc hien:

1. Mo Vocabulary.
2. Quan sat Add Word form.
3. Di toi table.
4. Mo edit cua cung mot word.

Callout bat buoc:

- English/Vietnamese co duoc uu tien hon metadata khong.
- Primary action co ghi ro `Add Word` khong.
- Chieu cao edit state Before/After.
- Save/Cancel co luon nhin thay khong.
- Tat ca field, ID, save behavior va sync hooks co con nguyen khong.

### 0:52-1:07 - Analytics

Before va After cung mo Analytics va scroll toi chart dau tien.

Callout bat buoc:

- KPI cap cao: Before hien 10; After muc tieu toi da 4 actionable metrics.
- Review Due va Focus Words co noi bat khong.
- Chart dau tien bat dau o vi tri nao.
- Co mot next-learning action ro rang va khong mau thuan voi metric khong.

### 1:07-1:20 - Ket luan ROI

Hien bang tong ket, khong dung nhan xet cam tinh:

| Tieu chi | Before | After | Dat? |
|---|---:|---:|---|
| Learning actions trong first viewport | Do tu video | Do tu video | Yes/No |
| Vi tri Quick Quiz | y baseline | y after | Yes/No |
| Primary KPI Analytics | 10 | Muc tieu <=4 | Yes/No |
| Quiz fit trong 1366x768 | Yes/No | Yes/No | Yes/No |
| Edit state height | Do tu DOM | Do tu DOM | Yes/No |
| Smoke tests | 24/24 baseline | Ket qua after | Yes/No |
| Regression business logic | N/A | Co/Khong | Yes/No |

Ket luan video phai dung mot trong ba muc:

- `Dang sua`: learning flow ro hon va acceptance criteria dat, khong co regression.
- `Chi dang mot phan`: co cai thien nhung ROI khong dong deu hoac con regression nho.
- `Khong dang`: chu yeu thay doi trang tri, learning flow khong cai thien, hoac regression lon hon loi ich.

## Tieu chuan quay After

- Su dung chinh dataset baseline 12 words.
- Viewport 1366x768 cho walkthrough.
- Dashboard 1920x1080 van phai co screenshot doi chieu rieng.
- Bat dau tai scrollY=0 tren moi page.
- Khong mo Google OAuth va khong kich hoat cloud sync.
- Topbar guest phai dung Local mode; khong dua `Session expired` vao video neu khong co session Google that.
- Moi canh dung it nhat 1.5 giay truoc khi thao tac tiep.
- Khong cat bo canh loading/error neu refactor lam phat sinh regression.
- Khong tang toc mot ben de che giau scroll hoac interaction cham.

## Cach tao video split-screen

Sau khi co clip After, dung mot canvas video 1920x1080:

- Dat Before o nua trai, After o nua phai.
- Dong bo theo cac moc Dashboard, Quiz question, Quiz feedback, Vocabulary edit va Analytics.
- Ve label va callout tren lop canvas, khong sua DOM ung dung de tao bang chung.
- Ghi canvas bang Chromium MediaRecorder thanh WebM, do do khong phu thuoc FFmpeg.
- Giu lai hai clip nguon de nguoi review co the xem khong qua cat dung.

## Approval gate

Khong bat dau UI refactor chi vi video Before da ton tai. Truoc moi batch can phe duyet:

1. Checklist item nao se duoc lam.
2. Change type: CSS only, HTML + CSS hay Requires JS.
3. Acceptance criteria va evidence After tuong ung.
4. Dung ngay neu can backend, database, auth, sync, API hoac routing changes.
5. Dung va xin phe duyet neu generated DOM, ID hoac data attribute buoc phai doi JavaScript rui ro cao.
