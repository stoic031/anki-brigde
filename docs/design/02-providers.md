# 🤖 Module 2: AI Provider Manager

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Interfaces (types): `../contracts.md` §4.

## 2.1. Kiến trúc lõi

Plugin sử dụng **Abstraction Layer** để dễ dàng chuyển đổi giữa Cloud API và Local Model. Mỗi provider implement một interface chung với 2 phương thức chính:

- `processText()`: Xử lý văn bản (extract từ vựng, tạo câu ví dụ, rewrite)
- `generateImage()`: Tạo ảnh từ prompt. Prompt do **chính text provider** user đã chọn tạo ra (task `build-image-prompt`) từ các field của thẻ — không dùng nguyên văn field làm prompt

## 2.2. Supported Providers

**Text Processing:**

Không hard-code danh sách model. Plugin chỉ hỗ trợ theo **loại endpoint**; tên model là
chuỗi user tự nhập:

- **OpenAI-compatible** (`POST {baseUrl}/chat/completions`): OpenAI, OpenRouter, Groq,
  DeepSeek, Gemini (endpoint compat), và local như Ollama (localhost:11434), LM Studio,
  vLLM
- **Anthropic** (`/v1/messages`): format khác OpenAI nên cần adapter riêng

**Image Generation:**

- Cloud: DALL-E 3, Stability AI, Replicate
- Local: Automatic1111 (localhost:7860), ComfyUI

Hiện Settings chỉ cấu hình được `openai-compatible` (`/images/generations`) và `automatic1111`;
Stability AI, Replicate, ComfyUI thêm khi có adapter tương ứng (`06-settings.md` §6.2).

## 2.3. AI Provider Manager

Quản lý lifecycle của các provider:

- Khởi tạo provider dựa trên settings
- Cung cấp method để lấy provider theo task (getTextProvider, getImageProvider)
- Chuẩn hóa lỗi: mọi lỗi từ provider (kể cả lỗi dựng provider) được bọc thành `ProviderError`
  (`contracts.md` §6). Manager **không** tự chuyển sang provider khác — mỗi loại chỉ có một
  provider user đã chọn, đổi sang provider khác sẽ gửi nội dung tới endpoint user chưa chọn
- Factory theo `type` và hàm đọc config được inject vào manager (`src/providers/providerManager.ts`);
  thêm provider = thêm một entry factory. Provider chỉ được dựng ở lần `getXProvider()` đầu
  tiên (không dựng lúc `onload`) và được cache theo config — đổi config thì dựng lại
- Chưa cấu hình provider (mặc định) → `getXProvider()` trả `null`; `type` không có factory → throw `ProviderError`

**Provider Text là toàn cục.** Người dùng lưu nhiều cấu hình provider (ví dụ OpenRouter,
Ollama) và chọn **một cái active**; `getTextProvider` luôn trả về cái active. Profile
(Deck + Model + Save notes to, xem `06-settings.md` §6.1) không chứa thông tin AI. Nếu sau
này cần provider riêng theo profile thì thêm `providerId?` tùy chọn vào profile (để trống =
dùng active) — thay đổi cộng thêm, không phá dữ liệu cũ.

## 2.4. Data Format

**Text Processing:**

- Input: text string + task type + `targetFields` (danh sách tên field thật của Model,
  lấy từ `modelFieldNames`, do user tick chọn trước trong Sidebar Modal Tab 1 — xem
  `07-sidebar.md` §7.2.1 và `03-note.md` §3.2)
- Output: JSON object key = đúng tên trong `targetFields`, value = nội dung sinh cho
  field đó. Không còn field cố định (word/meaning/furigana/...) — provider tự diễn giải
  ý nghĩa từng tên field để sinh nội dung phù hợp, field nào không suy luận được thì bỏ
  qua (không trả key đó hoặc trả rỗng)
- Mỗi model tuân thủ JSON khác nhau: prompt yêu cầu JSON, parse chặt, validate key theo
  `targetFields`, retry tối đa 1 lần khi parse lỗi rồi báo lỗi rõ ràng. Không phụ thuộc
  `response_format: json_object` vì không phải model nào cũng hỗ trợ
- Gọi HTTP bằng `requestUrl` của Obsidian (không dùng `fetch`) để tránh CORS
- Timeout 60 giây mỗi request (`requestUrl` không có timeout sẵn nên tự `Promise.race`). Chỉ
  retry khi **reply sai JSON** (1 lần); lỗi mạng/HTTP không retry. Thông báo lỗi nêu tên
  provider + URL, không kèm body/key
- Task `build-image-prompt`: `targetFields` rỗng, input là nội dung các field của thẻ; kết quả
  luôn là `{ prompt: string }` (1 prompt tiếng Anh cho image model)
- Adapter nằm ở `src/providers/text/` (`openaiCompatible.ts`, `anthropic.ts`), đăng ký qua
  `textFactories` (`index.ts`). Nhãn Cloud/Local suy từ Base URL (localhost/127.0.0.1 = Local)

**Image Generation:**

- Input: prompt string + `ImageOptions` (`size?`, `steps?`, `negativePrompt?`)
- Output: `MediaResult` (`base64`, `ext`, `mimeType`). Provider không đặt tên file và không gọi `storeMediaFile` — đặt tên thuộc `note/mediaNaming.ts`, lưu thuộc `sync/ankiConnect.ts`
