# 🤖 Module 2: AI Provider Manager

> Xem [`README.md`](README.md) cho tổng quan kiến trúc. Interfaces (types): `../contracts.md` §4.

## 2.1. Kiến trúc lõi

Plugin sử dụng **Abstraction Layer** để dễ dàng chuyển đổi giữa Cloud API và Local Model. Mỗi provider implement một interface chung với 3 phương thức chính:

- `processText()`: Xử lý văn bản (extract từ vựng, tạo câu ví dụ, rewrite)
- `generateAudio()`: Tạo audio từ text (TTS)
- `generateImage()`: Tạo ảnh từ prompt

## 2.2. Supported Providers

**Text Processing:**

- Cloud: OpenAI GPT-4/3.5, Claude, Gemini
- Local: Ollama (localhost:11434), LM Studio

**Audio Generation:**

- Cloud: OpenAI TTS, Azure Speech, ElevenLabs, Edge TTS (miễn phí)
- Local: sherpa-onnx (user tự setup)

**Image Generation:**

- Cloud: DALL-E 3, Stability AI, Replicate
- Local: Automatic1111 (localhost:7860), ComfyUI

## 2.3. AI Provider Manager

Quản lý lifecycle của các provider:

- Khởi tạo provider dựa trên settings
- Cung cấp method để lấy provider theo task (getTextProvider, getAudioProvider, getImageProvider)
- Xử lý fallback khi provider fail

## 2.4. Data Format

**Text Processing:**

- Input: text string + task type
- Output: JSON object với các field (word, meaning, furigana, collocations, exampleSentences)

**Audio Generation:**

- Input: text string + options (voice, speed)
- Output: base64 string + filename

**Image Generation:**

- Input: prompt string + options (size, steps)
- Output: base64 string + filename
