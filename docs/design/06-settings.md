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

## 6.2. AI Provider Settings

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

## 6.3. Sync Settings

- **Auto Sync on Save:** toggle (default: false)

## 6.4. Media Settings

- **Media Prefix:** text field (default: "_obsidian_")
- Validation: không chứa ký tự đặc biệt
