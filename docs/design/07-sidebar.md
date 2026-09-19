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
| **Tab 1 — Note** | Profile (cho note mới), Deck/Model của note đang mở, checkbox chọn field cho Generate with AI | Luôn hiện; Deck/Model bị vô hiệu khi không có note đang mở; phần checkbox field chỉ hiện khi note đang mở có cả Deck + Model |
| **Tab 2 — Audio** | Voice, Language, Overwrite/Append, danh sách dòng mapping field (input → output) | Chỉ hiện khi Tab 1 đã có Deck + Model |
| **Tab 3 — Image** | Overwrite/Append, 1 dòng mapping field (input → output) cố định | Chỉ hiện khi Tab 1 đã có Deck + Model |

> **Không nhầm với Settings Tab (`06-settings.md` §6.2).** Settings Tab cấu hình
> **provider** (chọn dịch vụ AI nào, API key, model) — áp dụng toàn cục. Tab 2/3 ở đây
> cấu hình **field nào map vào field nào** cho từng cặp Deck+Model cụ thể, cộng thêm
> Voice/Language/Overwrite-Append áp dụng cho lần generate đó. Hai lớp độc lập, không
> field nào trùng nhau; đổi provider ở Settings Tab không ảnh hưởng mapping ở đây và
> ngược lại.

### 7.2.1. Tab 1 — Note

Thứ tự hiển thị: Profile → Deck → Model → Rebuild fields → Field checkboxes. Không có Folder select ở Sidebar — folder lưu note mới thuộc về Profile
(`06-settings.md` §6.1).

> **Không có dòng Connection Status / nút 🔄 ở Sidebar.** Trạng thái và địa chỉ
> AnkiConnect chỉ quản lý ở Settings Tab (`06-settings.md` §6.1, nút Connect). Danh sách
> Deck/Model/Field được nạp khi Sidebar mở; lỗi kết nối báo bằng toast tại chỗ.

**Profile Dropdown (cho note mới):**

```
Profile: [Japanese ▼]
```

- Liệt kê các profile đã tạo ở Settings Tab (`06-settings.md` §6.1) và chọn profile đang
  dùng (active). Profile này quyết định Deck/Model/Folder của **note mới** — cả "Create new
  note" (§7.3) lẫn "Create note from selection" (`03-note.md` §3.7).
- Đồng bộ hai chiều với dropdown Profile ở Settings Tab: đổi ở một nơi thì nơi còn lại
  cập nhật ngay (cùng `settings.activeProfileId`; plugin phát sự kiện nội bộ để cả hai
  vẽ lại). Không thêm/sửa/xoá profile ở Sidebar — việc đó chỉ làm ở Settings Tab.
- Đổi profile **không** ảnh hưởng note đang mở.

**Deck Dropdown / Model Dropdown (của note đang mở):**

```
Deck:  [Japanese::N2 ▼]
Model: [Basic (and reversed card) ▼]
```

- Giá trị đang chọn luôn là `anki_deck` / `anki_model` trong frontmatter của **note đang
  mở** — không lấy từ profile và không lưu vào settings. Tự cập nhật khi user chuyển note
  khác và khi metadata của note đang mở đổi (kể cả khi user sửa tay frontmatter).
- Danh sách lựa chọn populate từ `deckNames` / `modelNames`. Nếu giá trị trong note không
  có trong danh sách (VD deck đã bị xoá trong Anki, hoặc Anki chưa kết nối) vẫn hiển thị
  giá trị đó để user thấy đúng những gì note đang ghi.
- Không có note markdown nào đang mở (hoặc file đang mở không phải `.md`): dropdown bị vô
  hiệu, hiện "No active note". Note đang mở nhưng chưa có `anki_deck`/`anki_model`: hiện
  "Not set" (chưa chọn); chọn "Not set" không làm gì.
- Đổi giá trị = sửa nhanh property của note: ghi thẳng vào frontmatter của note. Nếu note
  đã sync (có `anki_note_id`) thì hiện modal cảnh báo trước — xem `scenarios.md`
  Scenario 4. Không có nút Refresh riêng.

**Rebuild fields (đồng bộ field của Model sang nội dung note):**

```
Note fields: [Rebuild fields]
```

- Đổi Model ở dropdown chỉ đổi property `anki_model` (kèm cảnh báo nếu note đã sync); nội
  dung note không tự đổi theo. Nút này để user chủ động làm nội dung khớp Model mới.
- Bấm nút → hiện modal xác nhận "Rebuild note fields?" (Cancel / Rebuild): thao tác
  **xoá toàn bộ nội dung bên dưới frontmatter** rồi tạo lại skeleton đúng như §3.6
  (`03-note.md`): code block `anki-controls` + một `## Field` trống cho mỗi field của
  Model, theo thứ tự `modelFieldNames`. Không thể hoàn tác, nội dung cũ mất hết kể cả text
  đã viết.
- Frontmatter (`anki_deck`, `anki_model`, `anki_note_id`, ...) giữ nguyên; nút không tự
  xoá `anki_note_id`.
- Bị vô hiệu khi không có note markdown đang mở hoặc note chưa có `anki_model`. Trong lúc
  chạy hiện "⏳ Rebuilding...", xong hiện toast "✅ Note fields rebuilt."; lỗi kết nối
  hiện toast "❌ Failed to rebuild fields. Please check Anki connection." và giữ nguyên
  note.

**Field checkboxes (Generate with AI):**

```
Fields to generate with AI:
☐ Meaning
☐ Furigana
```

- Chỉ hiện khi note đang mở có cả `anki_deck` và `anki_model`; Deck/Model dùng cho danh
  sách này chính là cặp đang hiển thị ở 2 dropdown phía trên (cùng lấy từ frontmatter
  của note đang mở). Danh sách field lấy từ `modelFieldNames(model)`. Danh sách checkbox
  tự cập nhật khi user chuyển sang note khác hoặc khi cặp Deck+Model của note đổi; gõ nội
  dung trong note không kéo theo tải lại.
- Đây là field mà nút "🤖 Generate with AI" trong note-controls sẽ nhắm tới — xem
  [`03-note.md`](03-note.md) §3.2. Không tick field nào → nút Generate with AI coi như
  chưa cấu hình (xem §7.4 và 03-note.md §3.2).

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

Deck/Model/Folder của note mới lấy từ **profile đang chọn** (§7.2.1; `06-settings.md`
§6.1), không lấy từ 2 dropdown Deck/Model của Sidebar.

```
[1] User bấm icon "+" trong Ribbon, hoặc chạy command "Anki: Create new note"
    ↓
[2] Lấy profile đang chọn:
    ├─ Có cả Deck và Model → sang [3]
    └─ Thiếu Deck hoặc Model → hiện Notice "Please set up a profile in Settings first",
       tự mở Obsidian Settings tới tab của plugin, KHÔNG tạo note, dừng lại
    ↓
[3] Plugin hỏi tên note: "Enter note name:"
    ↓
[4] User nhập tên (VD: "診察")
    ↓
[5] Plugin tạo note ngay bằng Deck/Model/Folder của profile:
    - Frontmatter: anki_deck, anki_model
    - Content: `anki-controls` code block + section theo modelFieldNames (03-note.md §3.6)
    - Vị trí: Folder của profile
    ↓
[6] Mở note mới trong editor
    ↓
[7] Nếu Sidebar Modal chưa mở → tự mở ra (Tab 1); Deck/Model ở Tab 1 lúc này hiện đúng
    giá trị vừa ghi vào note. Note vừa tạo chưa sync (không có anki_note_id) nên đổi
    Deck/Model ở bước này chỉ ghi đè frontmatter, không cần cảnh báo như Scenario 4.
```

## 7.4. Persistence

**Profile:**

- Danh sách profile (`settings.profiles`: id, name, deck, model, folder) và profile đang
  chọn (`settings.activeProfileId`) lưu vào plugin settings. Khi mở lại Obsidian, Sidebar
  và Settings Tab đều chọn lại profile đã lưu.
- Sidebar và Settings Tab dùng chung một object settings; đổi profile ở đâu cũng phát sự
  kiện nội bộ để nơi còn lại vẽ lại dropdown Profile.
- Nâng cấp từ bản cũ: nếu chưa có `profiles`, tạo profile "Default" từ Deck/Model/Folder
  "hiện tại" hoặc mặc định cũ (`06-settings.md` §6.1) rồi bỏ các khoá cũ.

**Deck/Model của note:** không lưu ở settings. Nguồn duy nhất là frontmatter
`anki_deck` / `anki_model` của từng note (§7.2.1).

**Cấu hình field-mapping theo từng cặp Deck+Model:**

- Field khả dụng (`modelFieldNames`) phụ thuộc Model, nên checkbox Tab 1, các dòng
  Tab 2, và dòng Tab 3 được lưu **riêng theo từng cặp Deck+Model**, không dùng chung 1
  cấu hình toàn cục. Khoá lưu theo cặp Deck+Model, không theo profile.
- Chuyển sang note khác đang mở có `anki_deck`/`anki_model` khác (hoặc đổi Deck/Model của
  note) → Tab 1/2/3 tự hiện lại cấu hình đã lưu cho cặp đó (nếu có), hoặc trống nếu cặp
  đó chưa từng được cấu hình.
- "Chưa cấu hình" (cho mục đích pre-check ở `03-note.md` §3.2) nghĩa là: Tab 1 chưa
  tick field nào (với Generate with AI), Tab 2 chưa có dòng nào (với Add Audio), hoặc
  Tab 3 dòng Input/Output chưa được chọn (với Add Image) — **cho cặp Deck+Model của
  note đang mở**.
