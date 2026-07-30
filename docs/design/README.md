# 📘 Bản thiết kế chi tiết Plugin Obsidian-Anki AI (Updated)

> Đây là tài liệu **nguồn chân lý (source of truth)** cho hành vi tính năng của plugin. `AGENTS.md` ở thư mục gốc mô tả _cách_ tổ chức code/repo; các file trong `docs/design/` mô tả _cái gì_ cần được xây dựng. Nếu hai tài liệu mâu thuẫn, ưu tiên `docs/design/` cho hành vi, và cập nhật `AGENTS.md` cho phù hợp.

Tài liệu được chia theo module để agent chỉ cần đọc file liên quan đến task, không phải
đọc toàn bộ. Đọc file này (`README.md`) để có bức tranh tổng quan, sau đó vào file module
tương ứng.

## Mục lục

| File                                       | Nội dung                                          |
| ------------------------------------------ | -------------------------------------------------- |
| [`01-sync.md`](01-sync.md)                 | Module 1: Core Sync Engine                        |
| [`02-providers.md`](02-providers.md)       | Module 2: AI Provider Manager                     |
| [`03-note.md`](03-note.md)                 | Module 3: Note Creation & Controls                |
| [`05-ui.md`](05-ui.md)                     | Module 5: UI/UX (visual feedback, toast, CSS)     |
| [`06-settings.md`](06-settings.md)         | Module 6: Settings Tab (Connection Flow)          |
| [`07-sidebar.md`](07-sidebar.md)           | Module 7: Sidebar Modal (Deck & Model Selection)  |
| [`scenarios.md`](scenarios.md)             | Luồng xử lý tổng thể — 4 scenario end-to-end       |
| [`roadmap.md`](roadmap.md)                 | Lộ trình phát triển theo milestone                |

> Đánh số Module nhảy **3 → 5** có chủ đích: Module 4 đã bị bỏ khỏi kế hoạch, không phải
> lỗi đánh số. Giữ nguyên số thứ tự (không renumber) vì `AGENTS.md` và `.claude/rules/`
> tham chiếu tới các Module theo đúng số này.

Câu hỏi/mâu thuẫn thiết kế chưa chốt: xem `docs/design-open-questions.md`.

---

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
