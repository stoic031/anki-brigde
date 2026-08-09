# 🎛️ Module 7: Sidebar Modal (Deck, Model, Audio & Image Config)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 7.1. Vị trí & Kích hoạt

**Vị trí:** Sidebar phía bên phải (Right Sidebar) của Obsidian, dưới dạng **View Panel**,
luôn tồn tại ngay sau khi cài plugin (không cần user tự mở lần đầu để nó "có mặt" —
chỉ cần mở ra để xem/sửa).

**Kích hoạt:**

- Icon trong Ribbon (thanh công cụ bên trái) của Obsidian — bấm để mở Sidebar Modal.
  Từ nay icon này **đồng thời tạo note mới** theo flow ở §7.3 (không còn chỉ mở modal
  như trước).
- Command palette: **"Anki: Create new note"** (id `create-note`) — hành vi giống bấm
  icon Ribbon, dùng cho user thích gán hotkey riêng.
- Command palette: **"Anki: Open Deck & Model Selector"** — chỉ mở Sidebar Modal, **không**
  tạo note (dùng khi user chỉ muốn xem/sửa cấu hình).
- Hotkey tạo note từ text bôi đen (`create-note-from-selection`) — xem
  [`03-note.md`](03-note.md) §3.7, dùng chung Sidebar Modal theo cùng cơ chế ở §7.3.

## 7.2. Cấu trúc 3 Tab

| Tab | Nội dung | Điều kiện hiện |
| --- | --- | --- |
| **Tab 1 — Note** | Deck, Model, Folder lưu note, checkbox chọn field cho Generate with AI | Luôn hiện; phần checkbox field chỉ hiện sau khi đã chọn Deck + Model |
| **Tab 2 — Audio** | Voice, Language, Overwrite/Append, danh sách dòng mapping field (input → output) | Chỉ hiện khi Tab 1 đã có Deck + Model |
| **Tab 3 — Image** | Overwrite/Append, 1 dòng mapping field (input → output) cố định | Chỉ hiện khi Tab 1 đã có Deck + Model |

> **Không nhầm với Settings Tab (`06-settings.md` §6.2).** Settings Tab cấu hình
> **provider** (chọn dịch vụ AI nào, API key, model) — áp dụng toàn cục. Tab 2/3 ở đây
> cấu hình **field nào map vào field nào** cho từng cặp Deck+Model cụ thể, cộng thêm
> Voice/Language/Overwrite-Append áp dụng cho lần generate đó. Hai lớp độc lập, không
> field nào trùng nhau; đổi provider ở Settings Tab không ảnh hưởng mapping ở đây và
> ngược lại.

### 7.2.1. Tab 1 — Note

**Deck Dropdown:**

```
Select Deck: [Japanese::N2 ▼]
```

- Populate từ API `deckNames`. Nút "🔄 Refresh" bên cạnh để reload danh sách.

**Model Dropdown:**

```
Select Model: [Basic (and reversed card) ▼]
```

- Populate từ API `modelNames`. Nút "🔄 Refresh" bên cạnh.

**Folder select (lưu note mới):**

```
Save notes to: [/ (vault root) ▼]
```

- Mặc định = folder của note đang active tại thời điểm mở modal; nếu không có note
  nào đang active (VD mở Obsidian lần đầu) → mặc định vault root (`/`).
- User đổi giá trị này sẽ áp dụng cho lần tạo note tiếp theo qua §7.3.

**Field checkboxes (Generate with AI):**

```
Fields to generate with AI:
☐ Meaning
☐ Furigana
```

- Chỉ hiện sau khi đã chọn Deck + Model. Danh sách field lấy từ
  `modelFieldNames(model)`.
- Đây là field mà nút "🤖 Generate with AI" trong note-controls sẽ nhắm tới — xem
  [`03-note.md`](03-note.md) §3.2. Không tick field nào → nút Generate with AI coi như
  chưa cấu hình (xem §7.4 và 03-note.md §3.2).

**Connection Status:**

```
Status: ✅ Connected
AnkiConnect: http://localhost:8765
```

- Hiển thị trạng thái kết nối. Nút "Test Connection" để kiểm tra lại.

### 7.2.2. Tab 2 — Audio

```
Voice: [Female ▼]      Language: [Japanese ▼]
On existing tag: [Append ▼]   (hoặc "Overwrite")

Row 1:  Input: [Word ▼]   →   Output: [Audio ▼]      [🗑]
Row 2:  Input: [Example ▼] →  Output: [Example Audio ▼]  [🗑]

[+ Add row]
```

- **Voice:** Male / Female — chỉ ảnh hưởng lần generate qua Tab này, độc lập với field
  Voice ở Settings Tab §6.2 (xem lưu ý ở §7.2).
- **Language:** dropdown, danh sách phụ thuộc provider Audio đang cấu hình ở Settings
  Tab §6.2.
- **On existing tag (Overwrite/Append):** áp dụng khi field Output đã có `[sound:...]`
  từ trước —
  - **Append:** giữ tag cũ, thêm tag mới vào cuối section (hành vi mặc định trước đây,
    xem [`03-note.md`](03-note.md) §3.4).
  - **Overwrite:** xoá tag `[sound:...]` cũ trong section Output trước khi ghi tag mới
    (chỉ xoá tag, giữ nguyên text khác user đã viết thêm trong section đó).
- **Rows (Input → Output):** mỗi dòng là 1 cặp field độc lập — Input = field đọc text để
  chuyển thành audio, Output = field ghi tag `[sound:...]` vào. Input/Output đều là
  dropdown lấy từ `modelFieldNames(model)` của Deck+Model đang chọn ở Tab 1. "+ Add row"
  thêm dòng mới; 🗑 xoá dòng. Cho phép nhiều dòng vì 1 note có thể cần audio cho nhiều
  field khác nhau (VD Word và Example câu riêng).

### 7.2.3. Tab 3 — Image

```
On existing tag: [Append ▼]   (hoặc "Overwrite")

Input: [Word ▼]   →   Output: [Image ▼]
```

- Giống Tab 2 về khái niệm Overwrite/Append và mapping Input → Output, nhưng **cố định
  đúng 1 dòng** — không có "+ Add row"/🗑 vì một note thường chỉ cần 1 ảnh minh hoạ.
  Không có Voice/Language (không áp dụng cho ảnh).
- Overwrite ở đây nghĩa: xoá tag `<img src="...">` cũ trong section Output trước khi
  ghi tag mới.

## 7.3. Action: Create New Note

Trước khi tạo note, plugin resolve Deck/Model/Folder theo thứ tự sau (xem §7.4
Persistence):

```
[1] User bấm icon "+" trong Ribbon, hoặc chạy command "Anki: Create new note"
    ↓
[2] Resolve Deck/Model/Folder:
    ├─ Tab 1 đã có giá trị "hiện tại" (đã dùng/lưu từ lần trước) → dùng luôn, sang [3]
    ├─ Tab 1 chưa có, nhưng Settings Tab (06-settings.md §6.1) đã cấu hình Deck/Model/
    │  Folder mặc định → seed giá trị "hiện tại" của Tab 1 bằng default này, sang [3]
    └─ Cả Tab 1 lẫn Settings Tab đều chưa cấu hình gì → hiện Notice "Please configure
       Deck, Model, and Save location in Settings first", tự mở Obsidian Settings tới
       tab của plugin, KHÔNG tạo note, dừng lại (không có bước nào tiếp theo)
    ↓
[3] Plugin hỏi tên note: "Enter note name:"
    ↓
[4] User nhập tên (VD: "診察")
    ↓
[5] Plugin tạo note ngay bằng Deck/Model/Folder đã resolve ở bước [2]:
    - Frontmatter: anki_deck, anki_model
    - Content: `anki-controls` code block + section theo modelFieldNames (03-note.md §3.6)
    - Vị trí: Folder đã resolve ở bước [2]
    ↓
[6] Mở note mới trong editor
    ↓
[7] Nếu Sidebar Modal chưa mở → tự mở ra (Tab 1), để user xem lại/đổi Deck/Model/Folder
    cho note vừa tạo nếu cần. Note vừa tạo chưa sync (không có anki_note_id) nên đổi
    Deck/Model ở bước này chỉ ghi đè frontmatter, không cần cảnh báo như Scenario 4.
```

Không còn modal "Set up Anki Bridge" ở giữa màn hình — Settings Tab đã có đủ Deck/Model/
Folder mặc định (§6.1) nên không cần hỏi lại user ngay tại thời điểm tạo note; nếu chưa
cấu hình gì cả thì điều hướng thẳng tới Settings thay vì hỏi lại trong 1 modal riêng.

## 7.4. Persistence

**Deck/Model/Folder "hiện tại":**

- Lưu vào plugin settings. Đây là giá trị dùng cho §7.3 (khi đã có) và cho hotkey tạo
  note từ selection (`03-note.md` §3.7).
- Khi mở lại Obsidian → Tab 1 tự động chọn lại Deck/Model/Folder đã lưu.

**Cấu hình field-mapping theo từng cặp Deck+Model:**

- Field khả dụng (`modelFieldNames`) phụ thuộc Model, nên checkbox Tab 1, các dòng
  Tab 2, và dòng Tab 3 được lưu **riêng theo từng cặp Deck+Model**, không dùng chung 1
  cấu hình toàn cục.
- Đổi Deck/Model ở Tab 1 → Tab 2/3 tự hiện lại cấu hình đã lưu cho cặp Deck+Model đó
  (nếu có), hoặc trống nếu cặp đó chưa từng được cấu hình.
- "Chưa cấu hình" (cho mục đích pre-check ở `03-note.md` §3.2) nghĩa là: Tab 1 chưa
  tick field nào (với Generate with AI), Tab 2 chưa có dòng nào (với Add Audio), hoặc
  Tab 3 dòng Input/Output chưa được chọn (với Add Image) — **cho cặp Deck+Model của
  note đang mở**.

**Sync với Settings Tab:**

- Deck/Model/Folder ở Settings Tab (`06-settings.md` §6.1) là nguồn **fallback** cho
  giá trị "hiện tại" của Tab 1 khi Tab 1 chưa từng được set (xem §7.3 bước [2]) — không
  còn là giá trị độc lập chỉ dùng cho kết nối/preview.
- Sau khi Tab 1 đã được seed (hoặc user tự đổi trong Tab 1), Tab 1 giữ giá trị "hiện
  tại" của riêng nó; đổi Deck/Model/Folder default trong Settings Tab sau đó **không**
  tự động ghi đè lại giá trị đã có ở Tab 1.
