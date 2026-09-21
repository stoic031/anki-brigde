# 🤖 Module 2: AI Provider Manager

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Interfaces (types): `../contracts.md` §4.

## 2.1. Kiến trúc lõi

Plugin sử dụng **Abstraction Layer** để dễ dàng chuyển đổi giữa Cloud API và Local Model. Mỗi provider implement một interface chung với 2 phương thức chính:

- `processText()`: Xử lý văn bản (extract từ vựng, tạo câu ví dụ, rewrite)
- `generateImage()`: Tạo ảnh từ prompt. Prompt do **chính text provider** user đã chọn tạo ra (task `build-image-prompt`) từ các field của thẻ — không dùng nguyên văn field làm prompt

## 2.2. Supported Providers

Danh sách provider là **cố định** (chọn từ dropdown, không nhập endpoint tùy ý); thêm provider mới
khi có người dùng yêu cầu. Lý do: mỗi nhà cung cấp báo model theo một kiểu khác nhau, cần biết chính
xác provider mới lọc đúng loại model (`06-settings.md` §6.2). Tên model do user chọn từ danh sách
lấy từ chính provider (hoặc tự nhập khi không tải được).

**Text Processing:**

- Cloud: OpenAI, Gemini, Anthropic, Groq, OpenRouter, Together. Local: Ollama.
- Adapter: `openai-compatible` (`POST {baseUrl}/chat/completions`) phục vụ OpenAI, Groq, OpenRouter,
  Together, Ollama (`{host}/v1`) và Gemini (endpoint OpenAI-compatible
  `https://generativelanguage.googleapis.com/v1beta/openai`); `anthropic` (`/v1/messages`) riêng
  vì format khác. Bảng provider → adapter → endpoint nằm ở `src/providers/presets.ts`.

**Image Generation:**

- Cloud: Pollinations (`gen.pollinations.ai`, có `/v1/images/generations`), Gemini, OpenAI, OpenRouter. Local: Automatic1111 (localhost:7860), ComfyUI
  (localhost:8188).
- Chưa có adapter ảnh (Feature #17): Settings chỉ lưu cấu hình. Lưu ý cho adapter: model ảnh của
  OpenRouter và Gemini sinh ảnh qua `chat/completions`, không phải `/images/generations` như OpenAI;
  ComfyUI chạy theo **workflow** đã lưu trong ComfyUI (Settings đã chọn được workflow): workflow lưu ở
  định dạng UI (`nodes`/`links`) nên adapter phải đổi sang API format bằng `/object_info` rồi
  `POST /prompt`, gán prompt vào node prompt dương của KSampler.

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
