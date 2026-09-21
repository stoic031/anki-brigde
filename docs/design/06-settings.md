# 📊 Module 6: Settings Tab (Connection Flow)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 6.1. Connection Section

**AnkiConnect URL:**

- Input type: text field
- Placeholder: "<http://localhost:8765>" (hiển thị mờ, không phải giá trị mặc định)
- Logic mặc định: Nếu user để trống → dùng `http://localhost:8765`
- Bên cạnh input có nút **"🔗 Connect"**

**Connect Button Logic:**

```
[1] User nhập URL (hoặc để trống) → Bấm "Connect"
    ↓
[2] Plugin gọi AnkiConnect API:
    - "deckNames" → lấy danh sách decks
    - "modelNames" → lấy danh sách models
    ↓
[3] Nếu thành công:
    - Hiển thị toast: "✅ Connected to Anki!"
    - Nạp lại danh sách vào 2 dropdown Deck và Model trong mục Profile bên dưới
    ↓
[4] Nếu thất bại:
    - Hiển thị toast: "❌ Cannot connect to Anki. Please check URL and AnkiConnect."
    - Dropdown Deck và Model vẫn hiện, giữ nguyên danh sách hiện có
```

**Profile:**

Profile là một bộ **Deck + Model + Save notes to** đặt tên sẵn, dùng để quyết định note
mới được tạo với Deck/Model nào và lưu ở folder nào — cho cả "Create new note" (xem
`07-sidebar.md` §7.3) lẫn "Create note from selection" (`03-note.md` §3.7). Thay thế hoàn
toàn cặp giá trị "mặc định" (Settings) / "hiện tại" (Sidebar) trước đây. Profile **không**
chứa provider/model AI — provider Text là cấu hình toàn cục (§6.2).

```
Profile: [Japanese ▼]   [Add]  [Delete]
Profile name: [Japanese        ]
Deck:  [Japanese::N2 ▼]
Model: [Basic ▼]
Save notes to: [/ (vault root) ▼]
```

- Dropdown **Profile** chọn profile đang dùng (active). Đây là cùng một lựa chọn với
  dropdown Profile ở Sidebar Tab 1 (`07-sidebar.md` §7.2.1): đổi ở đâu thì nơi kia cập
  nhật theo ngay, không cần mở lại.
- Các ô bên dưới (Profile name, Deck, Model, Save notes to) luôn sửa **profile đang chọn**.
- Luôn có ít nhất 1 profile. Lần đầu (hoặc khi nâng cấp từ bản cũ chưa có profile) plugin
  tự tạo profile **"Default"** — với bản cũ thì lấy Deck/Model/Folder "hiện tại" của
  Sidebar (nếu có), không thì lấy Deck/Model/Folder mặc định cũ.
- **Add:** tạo profile mới (tên "New profile", thêm số nếu trùng; Deck/Model trống, folder
  là vault root) và chuyển sang nó để user điền tiếp.
- **Delete:** xoá profile đang chọn rồi chuyển sang profile đầu tiên còn lại. Nút bị vô
  hiệu khi chỉ còn 1 profile.
- **Profile name:** không được để trống và không được trùng tên profile khác (hiện
  Notice lỗi và giữ tên cũ). Lưu khi rời ô nhập / nhấn Enter.
- **Deck / Model:** **luôn hiện**, không cần bấm Connect. Mỗi lần mở Settings, plugin tự
  nạp `deckNames` / `modelNames` một lần, im lặng (không toast; lỗi thì bỏ qua — nút
  Connect mới là nơi báo lỗi kết nối). Trong lúc chưa nạp xong hoặc khi Anki đang tắt,
  dropdown chỉ liệt kê giá trị đã lưu của profile, nên vẫn thấy profile đang set gì. Giá
  trị đã lưu mà Anki không còn liệt kê (VD deck đã bị xoá) vẫn được hiển thị. Có lựa chọn
  trống ("Select deck…") — profile thiếu Deck hoặc Model thì không tạo được note (hiện
  Notice "Please set up a profile in Settings first" và mở Settings).
- **Save notes to:** populate từ folder trong vault, không phụ thuộc AnkiConnect nên
  **luôn hiện**. Mặc định `/` (vault root). Folder lồng nhau hiển thị dạng cây: mỗi dòng
  chỉ hiện tên riêng, thụt lề theo độ sâu, nhóm folder con ngay dưới folder cha (dùng hàm
  dựng cây `src/utils/folderTree.ts`).
- Profile chỉ dùng cho **note mới**. Deck/Model của một note đã tồn tại luôn theo
  frontmatter của note đó (xem `07-sidebar.md` §7.2.1).

## 6.2. AI Provider Settings

**Text Processing:**

Danh sách cấu hình provider (Add / Delete) + dropdown chọn cấu hình **active** (dùng chung
cho mọi profile; mặc định chưa có cấu hình nào = không gọi AI). Mỗi cấu hình gồm:

- Type: dropdown (openai-compatible, anthropic)
- Base URL: text field (ví dụ `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`)
- API Key: text field (tùy chọn với local)
- Model: text field tự do, kèm `datalist` gợi ý (không giới hạn danh sách)
- Nhãn Cloud / Local: tự suy ra từ Base URL (localhost, 127.0.0.1 = Local, còn lại = Cloud)

**Image Generation:**

- Provider: dropdown (dalle, stability, replicate, automatic1111, comfyui)
- API Key: text field (chỉ hiện khi chọn cloud provider)
- Model: text field (dall-e-3, sd-xl)
- API URL: text field (chỉ hiện khi chọn local provider, default localhost:7860)
- Negative Prompt: textarea field

## 6.3. Sync Settings

- **Auto Sync on Save:** toggle (default: false)

## 6.4. Media Settings

- **Media Prefix:** text field (default: "_obsidian_")
- Validation: không chứa ký tự đặc biệt
