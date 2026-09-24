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
Profile [Japanese ▼]          ← luôn hiện, trên tab (dùng cho note MỚI)
Deck:  [Japanese::N2 ▼]       ← luôn hiện, trên tab (note đang mở)
Model: [Basic (and reversed card) ▼]
Main field: [Word ▼]
[⟳ Sync] [🔨 Rebuild] [🗑 Delete]
[ Text | Image ]
```

Profile, Deck/Model của note đang mở, và hàng nút Sync | Rebuild | Delete đều luôn
hiện phía trên tab, không phụ thuộc tab nào đang chọn. Chỉ còn 2 tab bên dưới:

| Tab       | Nội dung                                                | Trạng thái                                             |
| --------- | ------------------------------------------------------- | ------------------------------------------------------ |
| **Text**  | Chọn field cho Generate with AI + nút **Generate**      | Đã có (phần gọi AI chưa triển khai)                    |
| **Image** | Overwrite/Append, chọn field Output + nút **Add image** | Đã có (chưa có adapter ảnh nào — Feature #17) — §7.2.2 |

- Chỉ hiển thị tab đã triển khai (hiện: Text, Image). Tab đang chọn giữ trong bộ nhớ view,
  mặc định là Text.
- Trước đây Sidebar chia "Tab 1/2/3" (Note / Audio / Image; Audio đã bỏ) và các nút nằm trong note; nay
  nút hành động nằm ở Sidebar (xem `03-note.md` §3.1). Deck/Model và hàng nút từng có
  riêng 1 tab Note — nay chuyển lên trên, luôn hiện, cùng chỗ với Profile (không còn là
  tab). Phần chọn field cho AI vẫn tách thành tab **Text** riêng, cùng dạng với Image.

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

### 7.2.1. Profile, Deck/Model & hàng nút (luôn hiện, trên tab), và tab Text

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

**Deck / Model của note đang mở (luôn hiện, trên tab):**

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

**Main Field (ngay dưới Model):**

```
Main field: [Word ▼]
```

- Khác với Deck/Model ở trên: đây **không** phải property của note đang mở, mà là
  **setting lưu theo từng cặp Deck+Model** — cùng cơ chế lưu trữ với checkbox tab Text
  và field Output tab Image (§7.4). Dropdown lấy field khả dụng từ
  `modelFieldNames(model)` của note đang mở; giá trị đang chọn đọc từ
  `settings.mainFieldConfig` cho cặp Deck+Model đó.
- Field này là field mà nội dung của nó **luôn được coi là tiêu đề/tên của note**:
    - **Rebuild** (dưới đây) điền `basename` hiện tại của note vào section của field này.
    - **Create new card** điền tên user vừa nhập; **Create note from selection**
      (`03-note.md` §3.7) điền text đã bôi đen — cả hai chỉ điền khi Main Field đã được
      cấu hình sẵn cho cặp Deck+Model đó, nếu chưa thì tạo note như bình thường, không
      điền gì (không có note nào đang mở để cấu hình Main Field cho một cặp Deck+Model
      hoàn toàn mới, nên 2 nút này không bắt buộc — xem §7.4).
    - **Generate** (`03-note.md` §3.2) đọc "word" để gửi AI từ section của field này,
      thay cho quy ước field đầu tiên (`fields[0]`) trước đây.
    - Nút **Add field** ở tab Text (bên dưới) loại Main Field ra khỏi Menu có
      thể thêm — không có gì để AI sinh cho field đã chứa tiêu đề.
- Không có Deck/Model (note chưa mở hoặc chưa set) → dropdown vô hiệu, hiện "Not set",
  giống Deck/Model ở trên.
- Đổi Main Field không ghi gì vào note ngay lập tức — chỉ ảnh hưởng lần Rebuild /
  Create / Generate tiếp theo.

**Hàng nút Sync | Rebuild | Delete** (luôn hiện, trên tab, ngay dưới Deck/Model — cùng một
hàng, tự xuống dòng khi Sidebar hẹp; mỗi nút gồm icon Obsidian + chữ; hành vi và thông báo
chi tiết: `03-note.md` §3.2):

- **Sync:** luôn hiện, vô hiệu khi không có note markdown đang mở.
- **Rebuild:** đồng bộ nội dung note theo Model hiện tại. Đổi Model ở dropdown chỉ đổi
  property `anki_model` (kèm cảnh báo nếu note đã sync); nội dung note không tự đổi theo —
  nút này để user chủ động làm nội dung khớp Model mới.
    - Yêu cầu Main Field đã được chọn cho cặp Deck+Model của note (xem trên). Chưa chọn →
      Notice "Please choose a main field for this deck/model in the sidebar first." và dừng,
      không mở modal xác nhận.
    - Bấm nút → hiện modal xác nhận "Rebuild note fields?" (Cancel / Rebuild): thao tác
      **xoá toàn bộ nội dung bên dưới frontmatter** rồi tạo lại skeleton đúng như §3.6
      (`03-note.md`): một `## Field` trống cho mỗi field của Model, theo thứ tự
      `modelFieldNames` — **ngoại lệ**: section của Main Field được điền sẵn `basename`
      hiện tại của note. Không thể hoàn tác, nội dung cũ mất hết kể cả text đã viết (và cả
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
[✨ Generate] [💾 Write] [＋ Add field] [⌫ Clear]
Fields to generate with AI
Meaning                                                              [×]
┌─ (sau khi Generate) ────────────────────────────────────────────────┐
│ medicine (có thể sửa trước khi Write)                                │
└───────────────────────────────────────────────────────────────────────┘
Furigana                                                             [×]
```

- Bốn nút **Generate | Write | Add field | Clear** nằm cùng một hàng (giống hàng
  Sync|Rebuild|Delete ở §7.2.1 — cùng dùng icon + chữ, cùng CSS
  `anki-bridge-sidebar__actions`/`__action`). Chữ "Fields to generate with AI" nằm
  riêng một dòng ngay dưới hàng nút.
- Chỉ hoạt động khi note đang mở có cả `anki_deck` và `anki_model` (không thì hiện gợi ý
  "Set a Deck and Model above first." và cả 4 nút Generate/Write/Add field/Clear bị vô hiệu).
  Danh sách field cho **Add field** lấy từ `modelFieldNames(model)` của note đang mở, **trừ
  Main Field** (input — không có gì để sinh, xem phần Main Field ở trên) và trừ field đã
  thêm rồi. Tự cập nhật khi user chuyển sang note khác, khi cặp Deck+Model của note đổi
  (danh sách field đã thêm reset theo cấu hình đã lưu cho cặp mới), hoặc ngay khi user đổi
  Main Field cho cặp hiện tại; gõ nội dung trong note không kéo theo tải lại.
- **Nút Add field** (icon `plus` + chữ, giống Generate/Write): bấm mở một Menu (Obsidian
  `Menu`, không phải dropdown `<select>`) liệt kê các field còn lại — chọn 1 field trong
  Menu để thêm vào. Field đó biến mất khỏi Menu lần mở kế tiếp và xuất hiện thành 1 dòng
  dưới, kèm nút `[×]` để bỏ field đó (bỏ luôn nội dung preview nếu có). Nút bị vô hiệu khi
  không còn field nào để thêm. Danh sách field đã thêm lưu theo cặp Deck+Model, giống hệt
  cách lưu cũ (§7.4).
- Nút **Generate** (icon + chữ): gọi AI Provider cho toàn bộ field đã thêm trong 1 lần gọi —
  xem [`03-note.md`](03-note.md) §3.2. **Không ghi vào note** — chỉ điền/ghi đè nội dung
  preview (có thể sửa tay) dưới mỗi field đã thêm. Chưa thêm field nào → coi như chưa cấu
  hình (xem §7.4 và 03-note.md §3.2).
- Nút **Write** (icon + chữ): ghi nội dung preview (đã sửa hoặc chưa) của tất cả field đã
  thêm vào note — 1 lần, áp dụng đúng quy tắc Content Update Logic ở §3.4 (section đang rỗng
  mới điền, section đã có nội dung thì bỏ qua). Chưa Generate lần nào (không có preview nào
  có nội dung) → hiện Notice "Generate content first." và không làm gì khác.
  Write thành công → lưu thẻ vừa ghi (giá trị Main Field + các field có nội dung, gồm cả
  phần user đã sửa) vào `settings.generateExamples` theo Deck+Model + Learning language
  lúc Generate, chỉ giữ 3 thẻ mới nhất — dùng làm ví dụ few-shot cho lần Generate sau
  (`02-providers.md` §2.4).
- Nút **Clear** (icon `eraser` + chữ): xoá hết nội dung preview của mọi field (không đụng
  note, không hỏi xác nhận — preview chỉ nằm trong bộ nhớ, Generate lại được). Bị vô hiệu
  khi chưa có preview nào.

### 7.2.2. Tab Image

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

- Field khả dụng (`modelFieldNames`) phụ thuộc Model, nên checkbox tab Text, field
  Output tab Image, và Main Field được lưu **riêng theo từng cặp Deck+Model**
  (`settings.generateWithAiFields` / `imageConfigs` / `mainFieldConfig`, cùng khoá
  `fieldConfigKey(deck, model)`), không dùng chung 1 cấu hình toàn cục. Khoá lưu theo
  cặp Deck+Model, không theo profile.
- Chuyển sang note khác đang mở có `anki_deck`/`anki_model` khác (hoặc đổi Deck/Model của
  note) → Main Field và các tab Text/Image tự hiện lại cấu hình đã lưu cho cặp đó (nếu
  có), hoặc trống nếu cặp đó chưa từng được cấu hình.
- "Chưa cấu hình" (cho mục đích pre-check ở `03-note.md` §3.2) nghĩa là: tab Text chưa
  tick field nào (với Generate), tab Image chưa chọn field Output (với Add Image), hoặc
  chưa chọn Main Field (với Rebuild, Generate) — **cho cặp Deck+Model của note đang mở**.
  Riêng Create new card / Create note from selection **không** yêu cầu Main Field đã
  cấu hình: một cặp Deck+Model hoàn toàn mới chưa từng có note nào mở ra, nên chưa có cơ
  hội để cấu hình Main Field cho nó — 2 nút này tạo note bình thường, không điền gì nếu
  chưa cấu hình (xem `03-note.md` §3.6/§3.7).
