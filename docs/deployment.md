# Hướng Dẫn Đóng Gói và Triển Khai (Deployment Guide)

Tài liệu này cung cấp hướng dẫn từng bước để đóng gói, cấu hình và triển khai nền tảng **Online Chess Platform** lên môi trường Production để người dùng cuối có thể truy cập chơi cờ trực tuyến từ mọi thiết bị (máy tính, điện thoại, máy tính bảng).

---

## 1. Kiến Trúc Triển Khai (Deployment Architecture)

Dự án là một Monorepo gồm 3 thành phần chính:
1. **PostgreSQL 16**: Cơ sở dữ liệu quan hệ lưu trữ tài khoản, lịch sử ván đấu, chỉ số Elo, thông tin phòng.
2. **Backend Server (`apps/server`)**: Ứng dụng Node.js + Express + Prisma ORM + Socket.IO (chạy port 4000) xử lý luật cờ server-authoritative, đồng hồ thi đấu, phòng đấu và bot AI Minimax.
3. **Frontend Web (`apps/web`)**: Ứng dụng React 18 + Vite + Tailwind CSS đóng gói thành file tĩnh qua Nginx (chạy port 80). Nginx đóng vai trò **Reverse Proxy**, điều hướng:
   - Các request tĩnh & SPA routing: `/` -> `dist/index.html`
   - Các request REST API: `/api/` -> `http://server:4000/api/`
   - Các kết nối thời gian thực: `/socket.io/` -> `http://server:4000/socket.io/` (WebSocket Upgrade)

```mermaid
flowchart TD
    UserClient["Người dùng (Web Browser / Mobile)"] -->|HTTPS / Port 443 / 80| Gateway["Nginx Web Container"]
    subgraph Docker_Network["Docker Internal Network"]
        Gateway -->|Static Files| SPA["React SPA Files"]
        Gateway -->|/api/* (REST)| Backend["Backend Container (Port 4000)"]
        Gateway -->|/socket.io/* (WebSocket)| Backend
        Backend -->|Port 5432| Postgres[("PostgreSQL 16 Database")]
        Postgres --- Vol["Persistent Volume (postgres_data)"]
    end
```

> **Lợi ích kiến trúc Reverse Proxy:**
> - Gom toàn bộ Frontend, API và WebSocket về **duy nhất 1 domain / port** (80 hoặc 443).
> - Triệt tiêu 100% lỗi CORS (Cross-Origin Resource Sharing).
> - Tránh lộ port database (5432) và backend (4000) ra ngoài Internet.
> - Hỗ trợ chứng chỉ SSL (HTTPS) một cách dễ dàng và đồng nhất.

---

## 2. Phương Án 1: Triển Khai Lên Máy Chủ VPS Bằng Docker Compose (Khuyên Dùng Nhất)

Đây là phương án chuẩn nhất cho các ứng dụng Real-time (Socket.IO + PostgreSQL) vì tính ổn định cao, không bị giới hạn thời gian chạy ngầm (no cold start, no auto-sleep), chi phí thấp ($3 - $5/tháng trên Hetzner, DigitalOcean, Linode, OVH, Vietnix,...).

### Bước 1: Chuẩn bị máy chủ VPS
1. Tạo 1 VPS chạy hệ điều hành **Ubuntu 22.04 LTS** hoặc **Ubuntu 24.04 LTS**.
2. SSH vào VPS:
   ```bash
   ssh root@<IP_VPS_CUA_BAN>
   ```
3. Cập nhật hệ thống và cài đặt Docker + Docker Compose:
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt install -y docker-compose-plugin
   ```
4. Kiểm tra cài đặt:
   ```bash
   docker --version
   docker compose version
   ```

### Bước 2: Tải mã nguồn lên VPS
```bash
# Clone repo từ GitHub/GitLab
git clone <URL_REPO_CUA_BAN> /var/www/online-chess
cd /var/www/online-chess
```

### Bước 3: Thiết lập biến môi trường Production
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
nano .env
```
Cấu hình các giá trị thực tế:
```env
# 1. Cấu hình Database
POSTGRES_USER=online_chess_admin
POSTGRES_PASSWORD=MatKhauDatabaseBaoMat123!
POSTGRES_DB=online_chess

# 2. Cấu hình Server
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
WEB_PORT=80

# 3. Domain hoặc IP của trang web
# Nếu có domain: https://chess.yourdomain.com
# Nếu dùng IP: http://<IP_VPS>
CORS_ORIGIN=http://<IP_VPS>
CLIENT_APP_URL=http://<IP_VPS>

# 4. Bảo mật JWT (Dùng openssl rand -hex 32 để sinh chuỗi ngẫu nhiên)
JWT_SECRET=b7f8e3d09a1246c59e7821034bcdef90123456789abcdef0123456789abcdef0
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=c8a9e2f10b2357d60f8932145cdef0123456789abcdef0123456789abcdef01
REFRESH_TOKEN_EXPIRES_IN=7d

# 5. Tài khoản Quản Trị Viên (Admin) khởi tạo ban đầu
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=MatKhauAdminBaoMat123!

# 6. Cấu hình gửi Mail OTP (Tùy chọn - nếu dùng Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password-from-google
SMTP_FROM="Online Chess <no-reply@yourdomain.com>"
```

### Bước 4: Khởi chạy ứng dụng
Chạy lệnh đóng gói và khởi động tất cả container:
```bash
docker compose up -d --build
```

Kiểm tra trạng thái các container:
```bash
docker compose ps
docker compose logs -f server
```
Khi thấy log thông báo:
```
Server is running at http://localhost:4000
Socket.IO listening on port 4000
Database connected successfully
```
Nghĩa là hệ thống đã hoạt động hoàn hảo! Bây giờ bạn có thể mở trình duyệt và truy cập vào `http://<IP_VPS>` để bắt đầu chơi.

### Bước 5: Cài đặt Tên miền & Chứng chỉ SSL HTTPS Miễn phí (Khuyên dùng)
Để người dùng truy cập bằng `https://chess.yourdomain.com`:
1. Trỏ DNS record `A` của tên miền về `<IP_VPS>`.
2. Đổi cổng `WEB_PORT=8080` trong `.env` và `docker-compose.yml`.
3. Cài Nginx trên máy chủ VPS làm SSL Reverse Proxy:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
4. Tạo cấu hình `/etc/nginx/sites-available/chess`:
   ```nginx
   server {
       server_name chess.yourdomain.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
5. Kích hoạt và cấp chứng chỉ SSL tự động:
   ```bash
   sudo ln -s /etc/nginx/sites-available/chess /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d chess.yourdomain.com
   ```

---

## 3. Phương Án 2: Triển Khai Miễn Phí Trên Nền Tảng Cloud (PaaS)

Nếu bạn không muốn thuê hoặc quản trị VPS, bạn có thể triển khai hệ thống tách biệt trên các dịch vụ miễn phí (Free Tier):

### 1. Cơ sở dữ liệu: Neon.tech hoặc Supabase (PostgreSQL miễn phí)
1. Đăng ký tài khoản tại [Neon.tech](https://neon.tech) hoặc [Supabase.com](https://supabase.com).
2. Tạo database mới và sao chép chuỗi kết nối `DATABASE_URL` (ví dụ: `postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require`).

### 2. Backend & WebSocket: Render.com
1. Đăng ký tài khoản tại [Render.com](https://render.com).
2. Chọn **New +** -> **Web Service** -> Kết nối Git repository của bạn.
3. Thiết lập:
   - **Environment**: `Docker`
   - **Dockerfile Path**: `apps/server/Dockerfile`
   - **Context Directory**: `.` (thư mục gốc)
   - **Environment Variables**:
     - `DATABASE_URL`: URL từ Neon/Supabase ở trên.
     - `PORT`: `4000`
     - `NODE_ENV`: `production`
     - `JWT_SECRET`: Chuỗi bảo mật 32+ ký tự.
     - `CORS_ORIGIN`: URL của Vercel (bước 3).
     - `CLIENT_APP_URL`: URL của Vercel (bước 3).
4. Nhấn **Create Web Service**. Sau khi build xong, bạn sẽ có domain: `https://online-chess-server.onrender.com`.

### 3. Frontend Web: Vercel
1. Đăng ký tài khoản tại [Vercel.com](https://vercel.com).
2. Import Git repository.
3. Cấu hình dự án trên Vercel:
   - **Root Directory**: `apps/web` (hoặc để root và chọn framework `Vite`).
   - **Build Command**: `cd ../.. && npm run build:shared && cd apps/web && npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL`: `https://online-chess-server.onrender.com/api/v1`
     - `VITE_SOCKET_URL`: `https://online-chess-server.onrender.com`
4. Nhấn **Deploy**. Bạn sẽ nhận được link chia sẻ người dùng: `https://online-chess-web.vercel.app`.

---

## 4. Phương Án 3: Mở Link Chơi Thử Nhanh Từ Máy Cá Nhân (Trong 2 Phút)

Nếu bạn vừa hoàn thành dự án và muốn gửi ngay cho bạn bè, giảng viên hoặc đồng nghiệp chơi thử ván cờ mà chưa cần mua domain hay thuê server:

### Dùng Cloudflare Tunnel (Miễn phí, có HTTPS, không cần mở cổng modem):
1. Tải công cụ `cloudflared`:
   - Windows: Tải từ [Cloudflare Downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) hoặc qua `winget install Cloudflare.cloudflared`.
2. Khởi động dự án trên máy của bạn (`npm run dev:server` và `npm run dev:web`).
3. Mở terminal mới và gõ lệnh:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
4. Cloudflare sẽ cấp cho bạn một đường link công khai dạng:
   `https://random-subdomain.trycloudflare.com`
5. Gửi đường link này cho bạn bè, họ có thể truy cập từ điện thoại hoặc máy tính bất kỳ để chơi cùng bạn!

---

## 5. Danh Sách Kiểm Tra An Toàn Trước Khi Đưa Lên Môi Trường Sản Xuất (Go-Live Checklist)

- [ ] **Bảo mật JWT**: Đã thay đổi `JWT_SECRET` và `REFRESH_TOKEN_SECRET` mặc định bằng chuỗi mã hóa ngẫu nhiên mạnh.
- [ ] **Mật khẩu Quản trị**: Đã thay đổi `ADMIN_PASSWORD` khỏi giá trị mặc định.
- [ ] **Tắt Debug Logs**: Đảm bảo `NODE_ENV=production` và `LOG_LEVEL=info` hoặc `warn`.
- [ ] **CORS Strict**: Cấu hình `CORS_ORIGIN` khớp chính xác với domain của người dùng.
- [ ] **HTTPS / SSL**: Toàn bộ lưu lượng truy cập nên qua giao thức mã hóa HTTPS để bảo mật phiên chơi và token đăng nhập.
- [ ] **Database Backup định kỳ**: Thiết lập lệnh sao lưu định kỳ cho thư mục volume PostgreSQL (`docker exec -t online_chess_postgres pg_dumpall -c -U postgres > backup.sql`).

---

## 6. Lệnh Vận Hành & Cập Nhật Mã Nguồn

```bash
# Xem log hệ thống thời gian thực
docker compose logs -f --tail=100

# Khởi động lại dịch vụ khi cập nhật cấu hình
docker compose restart

# Dừng hệ thống
docker compose down

# Cập nhật phiên bản mới nhất từ Git và build lại
git pull origin main
docker compose up -d --build
```
