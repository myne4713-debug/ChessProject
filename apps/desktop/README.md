# Online Chess Desktop (`@online-chess/desktop`)

Ứng dụng desktop chính thức cho **Online Chess Platform**, xây dựng bằng **Electron + TypeScript**, đóng gói giao diện React/Vite (`apps/web`) với các tính năng hệ điều hành gốc.

## Tính năng chính

- **Thanh tiêu đề tích hợp (Tournament Desktop Chrome)**: hiển thị trạng thái kết nối máy chủ kèm độ trễ (`ms`), nút chuyển giao diện Sáng / Tối nhanh (`Ctrl+Shift+D`), nút cài đặt máy chủ (`Ctrl+,`) và điều khiển cửa sổ gốc.
- **Cấu hình máy chủ động (Runtime Server URL)**: kết nối dễ dàng tới máy chủ cục bộ (`http://localhost:4000`) hoặc bất kỳ máy chủ production HTTPS nào mà không cần build lại ứng dụng, kèm công cụ kiểm tra sức khỏe (`/api/v1/health`).
- **Thông báo hệ thống gốc & Nhấp nháy thanh tác vụ (Taskbar Flash)**: thông báo khi tìm thấy trận, đến lượt đi (kèm cảnh báo chiếu tướng), nhận lời mời hòa hoặc kết thúc ván đấu khi cửa sổ đang ẩn.
- **Khay hệ thống (System Tray) & Phím tắt điều hướng**: điều hướng nhanh (`Ctrl+1` → `Ctrl+5`), chế độ toàn màn hình (`F11`), và tùy chọn thu nhỏ xuống khay hệ thống khi bấm đóng.
- **Deep Link (`online-chess://`) & Single-Instance Lock**: mở thẳng phòng đấu qua liên kết mời `online-chess://lobby?join=<MÃ_PHÒNG>`.
- **Ghi nhớ vị trí & kích thước cửa sổ**: tự động phục hồi kích thước cửa sổ và bảo vệ tọa độ khi tháo màn hình phụ.
- **Bảo mật chuẩn Electron**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, giao thức nội bộ `app://online-chess` chống path traversal, và kiểm soát chặt điều hướng / popup ngoài.

## Cấu hình URL máy chủ khi build (`.env`)

Để file `.exe` sau khi đóng gói tự động kết nối thẳng tới máy chủ bạn đã deploy:

1. Mở file `apps/desktop/.env` (hoặc tạo từ `apps/desktop/.env.example`):
   ```env
   DESKTOP_SERVER_URL=https://chess.yourdomain.com
   ```
   *(Thứ tự ưu tiên khi build: biến môi trường CLI > `apps/desktop/.env.production` > `apps/desktop/.env` > `.env` ở root > `http://localhost:4000`.)*
2. Đóng gói lại file `.exe`:
   ```bash
   npm run dist:desktop:win
   ```
   Script build sẽ tự động:
   - Ghi URL mặc định vào `apps/desktop/dist/build-config.json` (được đóng gói trong `app.asar`).
   - Biên dịch `apps/web` với `VITE_API_URL=<DESKTOP_SERVER_URL>/api/v1` và `VITE_SOCKET_URL=<DESKTOP_SERVER_URL>`.
   - Đóng gói ra các file `.exe` trong `apps/desktop/release/`.

## Lệnh phát triển & đóng gói

Chạy từ thư mục gốc monorepo:

```bash
# 1. Chạy phát triển (Web Vite HMR + Electron)
npm run dev:desktop

# 2. Chạy toàn bộ hệ thống (Backend Server + Web Vite + Electron)
npm run dev:desktop:full

# 3. Build production (Shared + Web + Electron main/preload + copy renderer)
npm run build:desktop

# 4. Chạy thử bản production desktop cục bộ
npm run start:desktop

# 5. Đóng gói thư mục ứng dụng không cần installer (test packaging nhanh)
npm run pack:desktop

# 6. Đóng gói bộ cài đặt Windows (NSIS .exe + Portable .exe)
npm run dist:desktop:win

# 7. Chạy unit test cho desktop
npm run test --workspace=apps/desktop
```

## Tạo lại bộ icon desktop

Bộ icon (`assets/icon.png`, `assets/tray-icon.png`, `assets/icon.ico`) được sinh tự động từ `apps/web/public/chess-icon.svg`:

```bash
npm run icons:generate --workspace=apps/desktop
```
