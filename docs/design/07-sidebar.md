# 🎛️ Module 7: Sidebar Modal (Deck, Model & Image Config)

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

## 7.2. Cấu trúc Sidebar: Profile + Tab

```
Anki Bridge
Profile [Japanese ▼]          ← luôn hiện, nằm trên các tab (dùng cho note MỚI)
[ Note | Text | Image ]
```

| Tab | Nội dung | Trạng thái |
| --- | --- | --- |
| **Note** | Deck/Model của note đang mở; hàng nút **Sync \| Rebuild \| Delete** | Đã có |
| **Text** | Chọn field cho Generate with AI + nút **Generate** | Đã có (phần gọi AI chưa triển khai) |
| **Image** | Overwrite/Append, chọn field Output + nút **Add Image** | Đã có phần cấu hình (nút **Add Image** chưa triển khai) — §7.2.2 |

- Chỉ hiển thị tab đã triển khai (hiện: Note, Text, Image). Tab đang chọn giữ trong bộ nhớ view,
  mặc định là Note.
- Trước đây Sidebar chia "Tab 1/2/3" (Note / Audio / Image; Audio đã bỏ) và các nút nằm trong note; nay
  nút hành động nằm ở Sidebar (xem `03-note.md` §3.1) và phần chọn field cho AI tách
  thành tab **Text** riêng, cùng dạng với Image.

> **Không nhầm với Settings Tab (`06-settings.md` §6.2).** Settings Tab cấu hình
> **provider** (chọn dịch vụ AI nào, API key, model) — áp dụng toàn cục. Các tab
> Text/Image ở đây cấu hình **field nào** được dùng/ghi cho từng cặp Deck+Model
> cụ thể, cộng thêm Overwrite-Append áp dụng cho lần generate đó. Hai lớp
> độc lập, không field nào trùng nhau; đổi provider ở Settings Tab không ảnh hưởng mapping
> ở đây và ngược lại.

> **Không có dòng Connection Status / nút 🔄 ở Sidebar.** Trạng thái và địa chỉ
> AnkiConnect chỉ quản lý ở Settings Tab (`06-settings.md` §6.1, nút Connect). Danh sách
> Deck/Model/Field được nạp khi Sidebar mở; lỗi kết nối báo bằng toast tại chỗ. Không có
> Folder select ở Sidebar — folder lưu note mới thuộc về Profile (`06-settings.md` §6.1).

### 7.2.1. Profile, tab Note và tab Text

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

**Tab Note — Deck / Model của note đang mở:**

```
Deck:  [Japanese::N2 ▼]
Model: [Basic (and reversed card) ▼]
[⟳ Sync] [🔨 Rebuild] [🗑 Delete]
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

**Hàng nút Sync | Rebuild | Delete** (cùng một hàng, tự xuống dòng khi Sidebar hẹp; mỗi
nút gồm icon Obsidian + chữ; hành vi và thông báo chi tiết: `03-note.md` §3.2):

- **Sync:** luôn hiện, vô hiệu khi không có note markdown đang mở.
- **Rebuild:** đồng bộ nội dung note theo Model hiện tại. Đổi Model ở dropdown chỉ đổi
  property `anki_model` (kèm cảnh báo nếu note đã sync); nội dung note không tự đổi theo —
  nút này để user chủ động làm nội dung khớp Model mới.
  - Bấm nút → hiện modal xác nhận "Rebuild note fields?" (Cancel / Rebuild): thao tác
    **xoá toàn bộ nội dung bên dưới frontmatter** rồi tạo lại skeleton đúng như §3.6
    (`03-note.md`): một `## Field` trống cho mỗi field của Model, theo thứ tự
    `modelFieldNames`. Không thể hoàn tác, nội dung cũ mất hết kể cả text đã viết (và cả
    khối `anki-controls` cũ nếu note còn).
  - Frontmatter (`anki_deck`, `anki_model`, `anki_note_id`, ...) giữ nguyên; nút không tự
    xoá `anki_note_id`.
  - Vô hiệu khi không có note đang mở hoặc note chưa có `anki_model`. Xong hiện toast
    "✅ Note fields rebuilt."; lỗi kết nối hiện toast "❌ Failed to rebuild fields. Please
    check Anki connection." và giữ nguyên note.
- **Delete:** chỉ hiện khi note có `anki_note_id`; tự hiện ngay sau lần sync đầu và tự ẩn
  sau khi xoá (vì trạng thái theo dõi frontmatter, không phải render một lần như khi nút
  còn nằm trong note). Có modal xác nhận.
- Chu kỳ trạng thái mỗi nút: bình thường → "⏳ Processing..." (vô hiệu) → "✅ Done!" (2
  giây) hoặc "❌ Error" (3 giây) → bình thường (`.claude/rules/ui-copy.md`).

**Tab Text — Fields to generate with AI:**

```
Fields to generate with AI                [✨ Generate]
☐ Meaning
☐ Furigana
```

- Chỉ liệt kê field khi note đang mở có cả `anki_deck` và `anki_model` (không thì hiện
  gợi ý "Set a Deck and Model on the Note tab first." và nút Generate bị vô hiệu). Danh
  sách field lấy từ `modelFieldNames(model)` của note đang mở. Tự cập nhật khi user chuyển
  sang note khác hoặc khi cặp Deck+Model của note đổi; gõ nội dung trong note không kéo
  theo tải lại.
- Nút **Generate** (icon + chữ) nằm ngay cạnh tiêu đề, nhắm tới các field đang tick — xem
  [`03-note.md`](03-note.md) §3.2. Không tick field nào → coi như chưa cấu hình (xem §7.4
  và 03-note.md §3.2). **Hiện chưa gọi AI:** đã tick field thì hiện Notice "Generate with AI
  is not available yet.".

### 7.2.2. Tab Image (cấu hình đã có; nút Add Image chưa triển khai)

```
On existing tag: [Append ▼]   (hoặc "Overwrite")

Output: [Image ▼]
```

- **Output:** dropdown lấy từ `modelFieldNames(model)` của Deck+Model của note đang mở —
  field ghi tag `<img src="...">` vào.
- **Không có field Input:** prompt tạo ảnh do **text model user đã chọn** viết từ các field
  không rỗng của note (task `build-image-prompt`, xem `03-note.md` §3.2), rồi mới gửi tới
  image provider. Cần cấu hình text provider ở Settings Tab §6.2.
- **On existing tag (Overwrite/Append):** Append = giữ tag cũ, thêm tag mới; Overwrite = xoá
  tag `<img src="...">` cũ trong section Output trước khi ghi tag mới (chỉ xoá tag, giữ
  nguyên text khác — xem `03-note.md` §3.4).

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
    - Content: một section `## Field` theo modelFieldNames (03-note.md §3.6)
    - Vị trí: Folder của profile
    ↓
[6] Mở note mới trong editor
    ↓
[7] Nếu Sidebar Modal chưa mở → tự mở ra (tab Note); Deck/Model ở tab Note lúc này hiện đúng
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

- Field khả dụng (`modelFieldNames`) phụ thuộc Model, nên checkbox tab Text và field
  Output tab Image được lưu **riêng theo từng cặp Deck+Model**, không dùng chung 1
  cấu hình toàn cục. Khoá lưu theo cặp Deck+Model, không theo profile.
- Chuyển sang note khác đang mở có `anki_deck`/`anki_model` khác (hoặc đổi Deck/Model của
  note) → các tab Text/Image tự hiện lại cấu hình đã lưu cho cặp đó (nếu có), hoặc trống nếu cặp
  đó chưa từng được cấu hình.
- "Chưa cấu hình" (cho mục đích pre-check ở `03-note.md` §3.2) nghĩa là: tab Text chưa
  tick field nào (với Generate), hoặc
  tab Image chưa chọn field Output (với Add Image) — **cho cặp Deck+Model của
  note đang mở**.
