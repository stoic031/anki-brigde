# 📘 Bản thiết kế chi tiết Plugin Obsidian-Anki AI (Updated)

> Đây là tài liệu **nguồn chân lý (source of truth)** cho hành vi tính năng của plugin. `AGENTS.md` ở thư mục gốc mô tả _cách_ tổ chức code/repo; file này mô tả _cái gì_ cần được xây dựng. Nếu hai tài liệu mâu thuẫn, ưu tiên file này cho hành vi, và cập nhật `AGENTS.md` cho phù hợp.

## 🎯 Tổng quan kiến trúc

**Vai trò của Plugin:** Orchestrator (Điều phối) - Gọi API, không tự chạy model
**Mục tiêu:** Sync từ vựng từ Obsidian → Anki + Tự động tạo media (audio/image) qua AI
**Nguyên tắc:**

- Vault Obsidian sạch (không lưu media)
- Media lưu thẳng vào Anki qua `storeMediaFile`
- Button điều khiển trực tiếp trong note (Custom Markdown Block)
- Hỗ trợ cả Cloud API và Local Model
- Frontmatter chỉ chứa metadata sync, dữ liệu từ vựng nằm trong content
- Dynamic field generation dựa trên Anki Model được chọn

---

## 📦 Module 1: Core Sync Engine

### 1.1. Chức năng chính

- **Sync 1 chiều (Obsidian → Anki):** Tạo/cập nhật thẻ Anki từ note Obsidian
- **ID Mapping:** Quản lý `anki_note_id` trong frontmatter
- **Conflict Resolution:** Xử lý khi note bị sửa ở cả 2 bên
- **Dynamic Field Mapping:** Tự động map content sang Anki fields dựa trên Model được chọn

### 1.2. Cấu trúc Note

**Frontmatter (chỉ chứa metadata sync):**

```yaml
---
anki_note_id: 1698765432109
anki_deck: 'Japanese::N2'
anki_model: 'Basic (and reversed card)'
last_synced: 2023-10-27T10:30:00Z
tags: [vocabulary, medical]
---
```

**Content (chứa dữ liệu từ vựng):**

```markdown
%%anki-controls%%

## Word

診察

## Meaning

Khám bệnh

## Furigana

しんさつ

## Part of Speech

Noun

## Collocations

- 診察を受ける
- 診察室

## Example

診察を受けました。

## Audio

[sound:_obsidian_診察_audio_1698765432.mp3]

## Image

<img src="_obsidian_診察_image_1698765433.png">
```

### 1.3. Data Flow

```
Obsidian Note (.md)
    ↓
[1] Đọc frontmatter (metadata) + content (data)
    ↓
[2] Parse content để extract các field:
    - Word: tìm heading "## Word" → lấy text bên dưới
    - Meaning: tìm heading "## Meaning" → lấy text bên dưới
    - Audio: tìm [sound:...] → lấy filename
    - Image: tìm <img src="..."> → lấy filename
    ↓
[3] Check anki_note_id trong frontmatter
    ├─ Không có → Gọi AnkiConnect "addNote" → Lưu ID vào frontmatter
    └─ Có → Gọi AnkiConnect "updateNoteFields" → Cập nhật fields
    ↓
[4] Hiển thị toast: "✅ Synced successfully"
```

### 1.4. AnkiConnect API Calls

**Tạo note mới:**

- Action: `addNote`
- Params: deckName, modelName, fields (dynamic), tags
- Response: noteId → lưu vào frontmatter

**Cập nhật note:**

- Action: `updateNoteFields`
- Params: noteId, fields
- Response: success/fail

**Xóa note:**

- Action: `deleteNotes`
- Params: notes array [noteId]
- Response: success/fail

**Lấy danh sách decks:**

- Action: `deckNames`
- Response: array of deck names

**Lấy danh sách models:**

- Action: `modelNames`
- Response: array of model names

**Lấy fields của model:**

- Action: `modelFieldNames`
- Params: modelName
- Response: array of field names (VD: ["Front", "Back", "Audio", "Image"])

### 1.5. Dynamic Field Mapping (Content → Anki)

Plugin tự động map content sang Anki fields dựa trên Model được chọn:

| Content Section | Anki Field                  | Cách extract                                        |
| --------------- | --------------------------- | --------------------------------------------------- |
| `## Word`       | Front (hoặc field đầu tiên) | Tìm heading "## Word" → lấy paragraph tiếp theo     |
| `## Meaning`    | Back (hoặc field thứ 2)     | Tìm heading "## Meaning" → lấy paragraph tiếp theo  |
| `## Furigana`   | Furigana (nếu có)           | Tìm heading "## Furigana" → lấy paragraph tiếp theo |
| `## Example`    | Example (nếu có)            | Tìm heading "## Example" → lấy paragraph tiếp theo  |
| `## Audio`      | Audio (nếu có)              | Tìm `[sound:filename.mp3]` → extract filename       |
| `## Image`      | Image (nếu có)              | Tìm `<img src="filename.png">` → extract filename   |

**Logic mapping thông minh:**

- Nếu Model có field "Front" → map "## Word" vào "Front"
- Nếu Model có field "Back" → map "## Meaning" vào "Back"
- Nếu Model có field "Audio" và note có `[sound:...]` → map vào "Audio"
- Nếu field không khớp → bỏ qua hoặc hiển thị warning

### 1.6. Error Handling

- **AnkiConnect offline:** Hiển thị modal "Anki is not running. Please start Anki and AnkiConnect."
- **Note not found in Anki:** Xóa `anki_note_id` trong frontmatter, tạo note mới
- **Duplicate note:** Hiển thị toast "Note already exists in Anki"
- **Parse error:** Hiển thị toast "Cannot parse note content. Please check format."
- **Model not found:** Hiển thị toast "Model không tồn tại trong Anki. Vui lòng chọn lại."

---

## 🤖 Module 2: AI Provider Manager

### 2.1. Kiến trúc lõi

Plugin sử dụng **Abstraction Layer** để dễ dàng chuyển đổi giữa Cloud API và Local Model. Mỗi provider implement một interface chung với 3 phương thức chính:

- `processText()`: Xử lý văn bản (extract từ vựng, tạo câu ví dụ, rewrite)
- `generateAudio()`: Tạo audio từ text (TTS)
- `generateImage()`: Tạo ảnh từ prompt

### 2.2. Supported Providers

**Text Processing:**

- Cloud: OpenAI GPT-4/3.5, Claude, Gemini
- Local: Ollama (localhost:11434), LM Studio

**Audio Generation:**

- Cloud: OpenAI TTS, Azure Speech, ElevenLabs, Edge TTS (miễn phí)
- Local: sherpa-onnx (user tự setup)

**Image Generation:**

- Cloud: DALL-E 3, Stability AI, Replicate
- Local: Automatic1111 (localhost:7860), ComfyUI

### 2.3. AI Provider Manager

Quản lý lifecycle của các provider:

- Khởi tạo provider dựa trên settings
- Cung cấp method để lấy provider theo task (getTextProvider, getAudioProvider, getImageProvider)
- Xử lý fallback khi provider fail

### 2.4. Data Format

**Text Processing:**

- Input: text string + task type
- Output: JSON object với các field (word, meaning, furigana, collocations, exampleSentences)

**Audio Generation:**

- Input: text string + options (voice, speed)
- Output: base64 string + filename

**Image Generation:**

- Input: prompt string + options (size, steps)
- Output: base64 string + filename

---

## 📝 Module 3: Note Creation & Controls

### 3.1. Custom Markdown Block

Plugin sử dụng `%%anki-controls%%` trong content để render button điều khiển. Khi Obsidian render note, plugin sẽ tìm marker này và thay thế bằng HTML buttons.

### 3.2. Button Actions

**🔄 Sync Button:**

- Điều kiện hiển thị: Luôn hiện
- Action: Đọc frontmatter + content → Gọi AnkiConnect addNote/updateNoteFields → Lưu anki_note_id vào frontmatter
- Visual feedback: Button đổi thành "✅ Synced" trong 2 giây

**🗑️ Delete Button:**

- Điều kiện hiển thị: Chỉ hiện khi có `anki_note_id` trong frontmatter
- Action: Hiển thị confirm modal → Gọi AnkiConnect deleteNotes → Xóa `anki_note_id` khỏi frontmatter
- Visual feedback: Button ẩn đi sau khi xóa

**🔊 Add Audio Button:**

- Điều kiện hiển thị: Chỉ hiện khi chưa có `[sound:...]` trong content
- Action: Đọc word + example từ content → Gọi AI Provider generateAudio → Gọi AnkiConnect storeMediaFile → Chèn `[sound:filename.mp3]` vào section "## Audio"
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → Ẩn đi

**🖼️ Add Image Button:**

- Điều kiện hiển thị: Chỉ hiện khi chưa có `<img src="...">` trong content
- Action: Đọc word + meaning từ content → Gọi AI Provider generateImage → Gọi AnkiConnect storeMediaFile → Chèn `<img src="filename.png">` vào section "## Image"
- Visual feedback: Button đổi thành "⏳ Generating..." → "✅ Done!" → Ẩn đi

### 3.3. Content Parsing Logic

Plugin parse content theo cấu trúc heading:

- Tìm tất cả heading `## SectionName`
- Với mỗi heading, lấy nội dung cho đến heading tiếp theo hoặc end of file
- Extract data dựa trên section name:
  - "## Word" → text paragraph
  - "## Collocations" → list items (dòng bắt đầu bằng `-`)
  - "## Audio" → `[sound:filename]` pattern
  - "## Image" → `<img src="filename">` pattern

### 3.4. Content Update Logic

Khi thêm audio/image, plugin cần update content:

- Tìm section "## Audio" hoặc "## Image"
- Nếu chưa có section → tạo mới ở cuối file
- Nếu đã có section → append vào cuối section
- Save file → Trigger re-render → Button tự động ẩn đi

### 3.5. Media File Naming Convention

- **Prefix:** `_obsidian_` (để Anki không xóa nhầm khi Check Media)
- **Format:** `_obsidian_{word}_{type}_{timestamp}.{ext}`
- **Ví dụ:**
  - `_obsidian_診察_audio_1698765432.mp3`
  - `_obsidian_apple_image_1698765433.png`

### 3.6. Auto-generate Content Structure

Khi user tạo note mới (qua command hoặc hotkey), plugin tự động sinh ra content structure dựa trên Model được chọn trong Sidebar Modal:

**Ví dụ với Model "Basic (and reversed card)" (fields: Front, Back):**

```markdown
%%anki-controls%%

## Front

## Back
```

**Ví dụ với Model "Japanese Vocabulary" (fields: Word, Meaning, Furigana, Audio, Image):**

```markdown
%%anki-controls%%

## Word

## Meaning

## Furigana

## Audio

## Image
```

---

## 🎨 Module 5: UI/UX

### 5.1. Visual Feedback cho Buttons

**Trạng thái bình thường:**

- Button có màu sắc khác nhau theo action (Sync: accent, Delete: error, Audio: green, Image: purple)
- Hover effect: nâng lên 2px + shadow

**Trạng thái processing:**

- Button disabled, opacity 0.6
- Text đổi thành "⏳ Processing..."
- Cursor: not-allowed

**Trạng thái success:**

- Text đổi thành "✅ Done!"
- Sau 2 giây → trở về trạng thái bình thường hoặc ẩn đi

**Trạng thái error:**

- Text đổi thành "❌ Error"
- Sau 3 giây → trở về trạng thái bình thường

### 5.2. Toast Notifications

Plugin hiển thị toast notification cho mọi action:

- Sync thành công: "✅ Note synced to Anki!" (3 giây)
- Delete thành công: "🗑️ Note deleted from Anki" (3 giây)
- Audio generated: "🔊 Audio added to note" (3 giây)
- Image generated: "🖼️ Image added to note" (3 giây)
- Error: "❌ Failed to sync. Please check Anki connection." (5 giây)

### 5.3. Progress Notifications

Khi gọi AI (có thể mất 5-30 giây):

- Hiển thị notice với text "🤖 Analyzing..." (không tự tắt)
- Cập nhật text theo tiến trình: "🎨 Generating image... (15s)"
- Khi xong → hide notice → hiển thị toast success

### 5.4. CSS Styling

**Container:**

- Flexbox layout, gap 8px
- Background: secondary color
- Border: 1px solid border color
- Border-radius: 8px
- Padding: 12px
- Margin: 16px 0

**Buttons:**

- Padding: 8px 16px
- Border-radius: 6px
- Font-size: 14px
- Font-weight: 500
- Transition: all 0.2s
- Hover: translateY(-2px) + shadow

---

## 📊 Module 6: Settings Tab (Connection Flow)

### 6.1. Connection Section

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
    - Hiện 2 dropdown bên dưới: Deck và Model
    ↓
[4] Nếu thất bại:
    - Hiển thị toast: "❌ Cannot connect to Anki. Please check URL and AnkiConnect."
    - Ẩn dropdown Deck và Model
```

**Deck Dropdown:**

- Hiển thị sau khi Connect thành công
- Populate từ API `deckNames`
- User chọn deck mặc định cho tất cả notes mới
- Lưu vào settings

**Model Dropdown:**

- Hiển thị sau khi Connect thành công
- Populate từ API `modelNames`
- User chọn model mặc định cho tất cả notes mới
- Lưu vào settings

### 6.2. AI Provider Settings

**Text Processing:**

- Provider: dropdown (openai, claude, gemini, ollama, lmstudio)
- API Key: text field (chỉ hiện khi chọn cloud provider)
- Model: text field (gpt-4, llama3, etc.)
- API URL: text field (chỉ hiện khi chọn local provider, default localhost:11434)

**Audio Generation:**

- Provider: dropdown (openai, azure, elevenlabs, edge, sherpa-onnx)
- API Key: text field (chỉ hiện khi chọn cloud provider)
- Model: text field (tts-1-hd, eleven_multilingual_v2)
- Voice: text field (alloy, nanami)
- API URL: text field (chỉ hiện khi chọn local provider)

**Image Generation:**

- Provider: dropdown (dalle, stability, replicate, automatic1111, comfyui)
- API Key: text field (chỉ hiện khi chọn cloud provider)
- Model: text field (dall-e-3, sd-xl)
- API URL: text field (chỉ hiện khi chọn local provider, default localhost:7860)
- Negative Prompt: textarea field

### 6.3. Sync Settings

- **Auto Sync on Save:** toggle (default: false)
- **Conflict Resolution:** dropdown (obsidian_wins, anki_wins, prompt)

### 6.4. Media Settings

- **Media Prefix:** text field (default: "_obsidian_")
- Validation: không chứa ký tự đặc biệt

---

## 🎛️ Module 7: Sidebar Modal (Deck & Model Selection)

### 7.1. Vị trí & Kích hoạt

**Vị trí:** Sidebar phía bên phải (Right Sidebar) của Obsidian, dưới dạng **View Panel**

**Kích hoạt:**

- Icon nhỏ trong Ribbon (thanh công cụ bên trái) của Obsidian
- User click icon → Mở Sidebar Modal
- Hoặc dùng command palette: "Anki: Open Deck & Model Selector"

### 7.2. UI Components

**Header:**

```
🎯 Anki Sync Settings
```

**Deck Dropdown:**

```
Select Deck: [Japanese::N2 ▼]
```

- Populate từ API `deckNames` (lấy khi plugin load hoặc khi refresh)
- Nút "🔄 Refresh" bên cạnh để reload danh sách

**Model Dropdown:**

```
Select Model: [Basic (and reversed card) ▼]
```

- Populate từ API `modelNames`
- Nút "🔄 Refresh" bên cạnh

**Fields Preview:**

```
Fields:
├─ Front
├─ Back
├─ Audio
└─ Image
```

- Tự động cập nhật khi user chọn Model
- Lấy từ API `modelFieldNames`
- Giúp user biết note sẽ có những field nào

**Action Buttons:**

```
[📝 Create New Note]    [🤖 Generate with AI]
```

**Connection Status:**

```
Status: ✅ Connected
AnkiConnect: http://localhost:8765
```

- Hiển thị trạng thái kết nối
- Nút "Test Connection" để kiểm tra lại

### 7.3. Action: Create New Note

```
[1] User chọn Deck và Model trong Sidebar Modal
    ↓
[2] User bấm "📝 Create New Note"
    ↓
[3] Plugin hiển thị input modal: "Enter note name:"
    ↓
[4] User nhập tên (VD: "診察")
    ↓
[5] Plugin tạo note mới với:
    - Frontmatter: anki_deck, anki_model (từ Sidebar Modal)
    - Content: %%anki-controls%% + auto-generated sections dựa trên Model fields
    ↓
[6] Mở note mới trong editor
```

**Ví dụ Content tự sinh:**

```markdown
---
anki_deck: 'Japanese::N2'
anki_model: 'Basic (and reversed card)'
---

%%anki-controls%%

## Front

## Back

## Audio

## Image
```

### 7.4. Action: Generate with AI

```
[1] User chọn Deck và Model trong Sidebar Modal
    ↓
[2] User bấm "🤖 Generate with AI"
    ↓
[3] Plugin hiển thị input modal: "Enter sentence or word:"
    ↓
[4] User nhập (VD: "診察を受けました")
    ↓
[5] Plugin tạo note mới với:
    - Frontmatter: anki_deck, anki_model (từ Sidebar Modal)
    - Content: %%anki-controls%% + placeholder sections
    ↓
[6] Gọi AI Provider → Auto-fill fields
    ↓
[7] Update note với data từ AI
    ↓
[8] Mở note trong editor
```

### 7.5. Persistence

**Lưu Deck & Model đã chọn:**

- Lưu vào plugin settings (persistent)
- Khi mở lại Obsidian → Sidebar Modal tự động chọn lại Deck và Model cũ

**Sync với Settings Tab:**

- Khi user thay đổi Deck/Model trong Settings Tab → Sidebar Modal tự động cập nhật
- Khi user thay đổi trong Sidebar Modal → Settings Tab tự động cập nhật

---

## 🔄 Luồng xử lý tổng thể (Updated)

### Scenario 1: User tạo note từ Sidebar Modal

```
[1] User mở Sidebar Modal (click icon trong Ribbon)
    ↓
[2] Chọn Deck: "Japanese::N2"
    ↓
[3] Chọn Model: "Basic (and reversed card)"
    ↓
[4] Plugin tự động lấy fields: ["Front", "Back"]
    ↓
[5] User bấm "📝 Create New Note"
    ↓
[6] Nhập tên note: "診察"
    ↓
[7] Plugin tạo note:
    ---
    anki_deck: "Japanese::N2"
    anki_model: "Basic (and reversed card)"
    ---

    %%anki-controls%%

    ## Front


    ## Back


    ↓
[8] User điền content:
    ## Front
    診察

    ## Back
    Khám bệnh

    ↓
[9] Bấm button "🔄 Sync" trong note
    ↓
[10] Plugin parse content → map "## Front" → Anki "Front", "## Back" → Anki "Back"
    ↓
[11] Gọi AnkiConnect "addNote"
    ↓
[12] Lưu anki_note_id vào frontmatter
    ↓
[13] Button đổi thành "✅ Synced" (2 giây)
    ↓
[14] Re-render controls (hiện thêm Delete button)
```

### Scenario 2: User tạo note với AI từ Sidebar Modal

```
[1] User mở Sidebar Modal
    ↓
[2] Chọn Deck và Model
    ↓
[3] Bấm "🤖 Generate with AI"
    ↓
[4] Nhập sentence: "診察を受けました"
    ↓
[5] Plugin tạo note với placeholder sections
    ↓
[6] Gọi AI Provider → extract vocabulary:
    - Word: 診察
    - Meaning: Khám bệnh
    - Furigana: しんさつ
    ↓
[7] Update note:
    ## Front
    診察

    ## Back
    Khám bệnh (しんさつ)

    ↓
[8] User review và chỉnh sửa (nếu cần)
    ↓
[9] Bấm "🔄 Sync" → Lưu vào Anki
```

### Scenario 3: User thêm audio vào note

```
[1] User bấm "🔊 Add Audio"
    ↓
[2] Plugin parse content → extract word + example_sentence
    ↓
[3] Hiển thị progress: "🔊 Generating audio..."
    ↓
[4] Gọi AI Provider → generateAudio(word + example)
    ↓
[5] Nhận base64 → Gọi AnkiConnect "storeMediaFile"
    ↓
[6] Chèn [sound:_obsidian_{word}_audio_{timestamp}.mp3] vào section "## Audio"
    ↓
[7] Save file → Re-render
    ↓
[8] Button ẩn đi (vì đã có audio)
```

### Scenario 4: User thay đổi Deck/Model trong Sidebar Modal

```
[1] User mở note đã sync (có anki_note_id trong frontmatter)
    ↓
[2] Mở Sidebar Modal → Chọn Deck mới hoặc Model mới
    ↓
[3] Plugin hiển thị warning modal:
    "Note này đã sync với Deck/Model cũ.
     Bạn có muốn:
     - Giữ nguyên Deck/Model cũ
     - Cập nhật Deck/Model mới (sẽ tạo note mới trong Anki)"
    ↓
[4] User chọn:
    ├─ Giữ nguyên → Không thay đổi frontmatter
    └─ Cập nhật → Update anki_deck/anki_model trong frontmatter → Xóa anki_note_id (để tạo note mới khi sync)
```

---

## 🗺️ Lộ trình phát triển (Updated)

### 🚩 Milestone 1: Core Sync + Settings (2 tuần)

- Module 1: Sync 1 chiều (Obsidian → Anki)
- Module 6: Settings Tab với Connection Flow (URL input + Connect button + Deck/Model dropdowns)
- Module 5 (Basic): Toast notifications
- **Deliverable:** Plugin có thể kết nối Anki, tạo/cập nhật thẻ Anki từ Obsidian

### 🚩 Milestone 2: Sidebar Modal + Dynamic Fields (2 tuần)

- Module 7: Sidebar Modal (Deck & Model Selection)
- Module 1 (Nâng cao): Dynamic field mapping dựa trên Anki Model
- Module 3 (Basic): Auto-generate content structure từ Model fields
- **Deliverable:** Plugin có Sidebar Modal, tự động sinh content structure dựa trên Model

### 🚩 Milestone 3: AI Integration (2-3 tuần)

- Module 2: AI Provider Manager (OpenAI + Ollama + Edge TTS)
- Module 3: Custom Markdown Block với 4 buttons
- Module 6 (Advanced): Settings cho AI providers
- **Deliverable:** Plugin có thể tạo audio/image và lưu vào Anki

### 🚩 Milestone 4: Polish & UX (1-2 tuần)

- Module 5: Visual feedback cho buttons
- Error handling & edge cases
- Documentation
- **Deliverable:** Plugin hoàn chỉnh, sẵn sàng release

---

## 📝 Ghi chú quan trọng

1. **Frontmatter chỉ chứa metadata sync** - Dữ liệu từ vựng nằm trong content
2. **Dynamic field mapping** - Tự động map content sang Anki fields dựa trên Model
3. **Sidebar Modal** - Cho phép chọn Deck/Model khi tạo note hoặc dùng AI
4. **Connection Flow** - URL input để trống, nút Connect, dropdowns hiện sau khi connect thành công
5. **Không lưu media vào Vault Obsidian** - Luôn lưu vào Anki Media qua `storeMediaFile`
6. **Prefix `_obsidian_`** cho tất cả media files để Anki không xóa nhầm
7. **Async/await** cho mọi API calls - Không block UI
8. **Progress notifications** - User phải biết plugin đang làm gì
9. **Error handling** - Xử lý mọi trường hợp lỗi (API fail, offline, timeout)
10. **Conditional rendering** - Chỉ hiện button cần thiết dựa trên trạng thái note
11. **Content parsing** - Dựa trên heading structure (## SectionName)
12. **Content update** - Append vào đúng section, không ghi đè toàn bộ file
13. **Persistence** - Lưu Deck/Model đã chọn trong settings, sync giữa Settings Tab và Sidebar Modal
