# 🎛️ Module 7: Sidebar Modal (Deck & Model Selection)

> Xem [`README.md`](README.md) cho tổng quan kiến trúc.

## 7.1. Vị trí & Kích hoạt

**Vị trí:** Sidebar phía bên phải (Right Sidebar) của Obsidian, dưới dạng **View Panel**

**Kích hoạt:**

- Icon nhỏ trong Ribbon (thanh công cụ bên trái) của Obsidian
- User click icon → Mở Sidebar Modal
- Hoặc dùng command palette: "Anki: Open Deck & Model Selector"

## 7.2. UI Components

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
[📝 Create New Note]
```

**Connection Status:**

```
Status: ✅ Connected
AnkiConnect: http://localhost:8765
```

- Hiển thị trạng thái kết nối
- Nút "Test Connection" để kiểm tra lại

## 7.3. Action: Create New Note

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
    - Content: `anki-controls` code block + auto-generated sections dựa trên Model fields
    ↓
[6] Mở note mới trong editor
```

**Ví dụ Content tự sinh:**

````markdown
---
anki_deck: 'Japanese::N2'
anki_model: 'Basic (and reversed card)'
---

```anki-controls
```

## Front

## Back

## Audio

## Image
````

> Để tạo note nhanh từ text đang bôi đen ở note khác (không cần mở Sidebar Modal, không
> cần nhập tên) — xem [`03-note.md`](03-note.md) §3.7.

## 7.4. Persistence

**Lưu Deck & Model đã chọn:**

- Lưu vào plugin settings (persistent)
- Khi mở lại Obsidian → Sidebar Modal tự động chọn lại Deck và Model cũ

**Sync với Settings Tab:**

- Khi user thay đổi Deck/Model trong Settings Tab → Sidebar Modal tự động cập nhật
- Khi user thay đổi trong Sidebar Modal → Settings Tab tự động cập nhật
