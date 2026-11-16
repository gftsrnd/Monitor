# TFG Monitor — Hệ thống Giám sát & Phân tích Tập trung

[![CI/CD](https://github.com/gftsrnd/Monitor/actions/workflows/deploy.yml/badge.svg)](https://github.com/gftsrnd/Monitor/actions/workflows/deploy.yml)
[![CI Type & Build](https://github.com/gftsrnd/Monitor/actions/workflows/ci.yaml/badge.svg)](https://github.com/gftsrnd/Monitor/actions/workflows/ci.yaml)

**TFG Monitor** (`https://monitor.tinfundinggroup.net`) là nền tảng quản trị hạ tầng, đo lường độ trễ (uptime), thu thập telemetry máy chủ và phân tích lượt truy cập thời gian thực cho hệ sinh thái **Tin Funding Group** (bao gồm `cmo.tinfundinggroup.net`, `checkmybiz.com` và các ứng dụng liên kết).

---

## 1. Kiến trúc Hệ thống trên AlmaLinux 9 VPS (`159.198.32.57`)

Hệ thống được thiết kế theo nguyên tắc **cô lập tuyệt đối (Strict Project Isolation)**, đảm bảo cùng tồn tại an toàn với các dịch vụ đang chạy (`cmo-funding`, `checkmybiz`, `Redis`, `nextjsuser`) mà không gây xung đột tài nguyên hay cấu hình.

```
+---------------------------------------------------------------------------------------+
|  Internet / Visitors                                                                  |
|  - monitor.tinfundinggroup.net                                                        |
|  - First-Party Proxy từ cmo.tinfundinggroup.net & checkmybiz.com                      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|  Apache Reverse Proxy (httpd 2.4.62)                                                  |
|  File: /etc/httpd/conf.d/zz-tfg-monitor.conf                                          |
|  - Port 80: ACME challenge webroot (/var/www/tfg-monitor/acme) + 301 HTTPS            |
|  - Port 443: <IfFile> TLS guard (không lỗi nếu chưa có cert), upgrade=websocket       |
|  - Anti-Spoofing: Unset spoofed headers -> mod_proxy_http sets X-Forwarded-For        |
|  - Block public metrics: ProxyPass /_prom ! (chặn lộ metrics nội bộ)                  |
+---------------------------------------------------------------------------------------+
                                           | (127.0.0.1:12345)
                                           v
+---------------------------------------------------------------------------------------+
|  Podman Container: tfg-monitor (Image: ghcr.io/gftsrnd/monitor:current)                |
|  - Runtime: Node.js 22 (Alpine), capped V8 heap 512MB, RAM limit 600MB                |
|  - Network: --network host, binds strictly HOST=127.0.0.1 (không bind 0.0.0.0)        |
|  - PID 1: Exec node main.js (chuyển trực tiếp SIGTERM khi dừng service)               |
|  - Background: tianji-reporter tự động thu thập CPU/RAM/Disk/Network VPS host         |
+---------------------------------------------------------------------------------------+
                                           | (127.0.0.1:5432)
                                           v
+---------------------------------------------------------------------------------------+
|  PostgreSQL 15 (Local)                                                                |
|  - Role: tfg_monitor (cô lập, CONNECTION LIMIT 25, không quyền superuser/createdb)    |
|  - Database: tfg_monitor (sở hữu riêng bởi role tfg_monitor)                          |
+---------------------------------------------------------------------------------------+
```

---

## 2. Quy trình CI/CD Tự động (`.github/workflows/deploy.yml`)

Mỗi khi mã nguồn được push lên nhánh `master` hoặc kích hoạt qua `workflow_dispatch`:

1. **Job 1 (`build_and_push`):**
   - Khởi tạo service container **PostgreSQL 15** trên GitHub Actions runner.
   - Biên dịch `Dockerfile` bằng **Docker Buildx** với bộ nhớ cache `gha` tốc độ cao.
   - **PostgreSQL 15 Smoke Test thực tế**: Khởi chạy container vừa build, tự động áp dụng Prisma migrations, kiểm tra endpoint `/health` (tối đa 60 lần) và xác minh tracker script tùy biến `/tj.js`.
   - Nếu smoke test thành công, container image được đẩy lên GitHub Container Registry:
     - `ghcr.io/gftsrnd/monitor:sha-${GITHUB_SHA}`
     - `ghcr.io/gftsrnd/monitor:latest`

2. **Job 2 (`deploy`):**
   - Kết nối an toàn qua SSH (`appleboy/ssh-action@v1`).
   - Nếu `/etc/systemd/system/tfg-monitor.service` chưa tồn tại trên VPS (chưa bootstrap), job in hướng dẫn rõ ràng và trả về mã thành công `0` (không làm fail build đầu tiên).
   - Khi service đã tồn tại:
     - Kéo chính xác digest `ghcr.io/gftsrnd/monitor:sha-${RELEASE_SHA}`.
     - Lưu phiên bản hiện tại thành `:previous` (hỗ trợ rollback tức thì).
     - Gắn tag mới thành `:current` và khởi động lại `tfg-monitor.service`.
     - Thăm dò kiểm tra sức khỏe `http://127.0.0.1:12345/health` (30 lần).
     - Nếu không phản hồi: tự động rollback về `:previous`, khởi động lại service và ghi log lỗi.
     - Nếu thành công: dọn dẹp các container images cũ không còn sử dụng.

---

## 3. Hướng dẫn Khởi tạo VPS Lần đầu (Turnkey Bootstrap)

Chỉ cần chạy **1 lệnh duy nhất** trên VPS với quyền `root` (sau khi clone repo hoặc tải thư mục `deploy/`):

```bash
sudo bash deploy/setup-vps.sh
```

### Các tác vụ script tự động thực hiện:
- **Tạo Database & Role độc lập**: Khởi tạo người dùng `tfg_monitor` với mật khẩu ngẫu nhiên 32-hex và cơ sở dữ liệu `tfg_monitor` (giữ nguyên mật khẩu nếu script chạy lại).
- **Cấu hình Môi trường Bảo mật**: Tạo file `/etc/tfg-monitor/monitor.env` (phân quyền `0600 root:root`) chứa `PORT=12345`, `HOST=127.0.0.1`, `CACHE_MEMORY_ONLY=true`, `JWT_SECRET`, v.v.
- **Zero-Window Password Rotation**: Tự động sinh mật khẩu quản trị ngẫu nhiên `ADMIN_INITIAL_PASSWORD`, cập nhật tài khoản `admin` ngay lần khởi động đầu tiên (xóa bỏ mật khẩu mặc định của upstream) và đổi tên workspace mặc định thành `TFG Monitor`.
- **Cài đặt Systemd Service**: Tạo `/etc/systemd/system/tfg-monitor.service` với cờ `--memory=600m`, `--network host`, `--security-opt=no-new-privileges:true`.
- **Cài đặt Apache Vhost**: Copy `deploy/httpd/zz-tfg-monitor.conf` vào `/etc/httpd/conf.d/`, tạo thư mục ACME webroot `/var/www/tfg-monitor/acme`, kiểm tra cú pháp `httpd -t` và reload Apache.
- **Kiểm tra An toàn Website đang chạy**: Tự động kiểm tra HTTP response code của `cmo.tinfundinggroup.net` và `checkmybiz.com` để đảm bảo các trang hiện tại không bị ảnh hưởng.

### Cấp phát Chứng chỉ SSL (Certbot):
Sau khi cấu hình bản ghi DNS `A` trỏ domain `monitor.tinfundinggroup.net` về `159.198.32.57`, chạy:

```bash
sudo certbot certonly --webroot -w /var/www/tfg-monitor/acme -d monitor.tinfundinggroup.net --deploy-hook "systemctl reload httpd"
```
Nhờ directive `<IfFile>`, Apache sẽ tự động nhận diện chứng chỉ và kích hoạt VirtualHost HTTPS `:443` ngay lập tức!

---

## 4. Tích hợp First-Party Tracker trên CMO & CMB

Để tránh bị các tiện ích AdBlock chặn mã theo dõi và bảo vệ quyền riêng tư người dùng, TFG Monitor cung cấp script tracker với tên tùy biến:

### 4.1. Nhúng trực tiếp vào Frontend:
Thêm đoạn mã sau vào thẻ `<head>` của website:

```html
<script 
  defer 
  data-website-id="<WEBSITE_ID_CUA_BAN>" 
  src="https://monitor.tinfundinggroup.net/tj.js">
</script>
```

### 4.2. Proxy First-Party qua Apache (Khuyến nghị cho CMO & CMB):
Để chuyển toàn bộ request theo dõi thành cùng domain (first-party):

Trong cấu hình Apache của `checkmybiz.com` hoặc `cmo.tinfundinggroup.net`:
```apache
# Proxy tracking script & batched event endpoints (First-Party)
ProxyPass /tj.js http://127.0.0.1:12345/tj.js retry=0 timeout=5
ProxyPassReverse /tj.js http://127.0.0.1:12345/tj.js
ProxyPass /api/website/send http://127.0.0.1:12345/api/website/send retry=0 timeout=5
ProxyPassReverse /api/website/send http://127.0.0.1:12345/api/website/send
ProxyPass /api/website/batch http://127.0.0.1:12345/api/website/batch retry=0 timeout=5
ProxyPassReverse /api/website/batch http://127.0.0.1:12345/api/website/batch
```

Và trên trang web chỉ cần cấu hình biến `VITE_MONITOR_WEBSITE_ID` (bộ nạp `frontend/src/utils/monitor.js` đã tích hợp sẵn) hoặc gọi:
```html
<script defer data-website-id="<WEBSITE_ID_CUA_BAN>" src="/tj.js"></script>
```

### 4.3. Cơ chế Nhận diện IP Khách truy cập & Chống Giả mạo (Anti-Spoofing):
- Apache tại tầng biên loại bỏ toàn bộ các header giả mạo do client gửi lên:
  `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Real-IP`, `X-Client-IP`, `CF-Connecting-IP`, `True-Client-IP`.
- Module `mod_proxy_http` của Apache (`ProxyAddHeaders On`) tự động ghi địa chỉ IP kết nối thực tế từ TCP socket vào `X-Forwarded-For`.
- Server Express khóa cứng `app.set('trust proxy', 1)` (chỉ tin cậy duy nhất 1 bước proxy nội bộ Apache), đảm bảo vị trí địa lý (GeoIP), thống kê phiên và bộ giới hạn tốc độ đăng nhập (`authRateLimit`) luôn phản ánh IP thực 100%, **hoàn toàn loại bỏ nguy cơ IP spoofing**.

---

## 5. Theo dõi Sự kiện Tùy biến (Custom Event Tracking)

TFG Monitor cho phép ghi nhận các hành vi quan trọng của khách hàng (như điền form đăng ký, bấm nút CTA, chuyển đổi đơn hàng):

```javascript
// Ghi nhận sự kiện bấm nút đăng ký
window.tianji?.track('click_cta_apply', {
  source: 'homepage_hero',
  package: 'funding_advance',
  amount_vnd: 500000000
});

// Định danh người dùng sau khi xác thực thành công
window.tianji?.identify({
  email: 'customer@example.com',
  name: 'Doanh nghiệp ABC',
  tier: 'Enterprise'
});
```

---

## 6. Đồng bộ Cập nhật từ Upstream (`msgbyte/tianji`)

Remote `upstream` đã được cấu hình với push URL là `DISABLED` để bảo vệ an toàn:

```bash
# Kiểm tra remotes
git remote -v
# origin    https://github.com/gftsrnd/Monitor.git (fetch & push)
# upstream  https://github.com/msgbyte/tianji.git (fetch)
# upstream  DISABLED (push)

# Kéo cập nhật mới nhất từ upstream
git fetch upstream master

# Xem các thay đổi giữa upstream và local
git log HEAD..upstream/master --oneline

# Merge cập nhật có chọn lọc (hoặc cherry-pick)
git merge upstream/master --no-commit
# Kiểm tra các xung đột trong src/server, giải quyết và commit lên origin/master
```

---

## 7. Các Lệnh Quản trị Thường Dùng trên VPS

```bash
# Xem trạng thái container service
sudo systemctl status tfg-monitor.service

# Xem log thời gian thực
sudo journalctl -u tfg-monitor.service -f -n 100

# Khởi động lại service
sudo systemctl restart tfg-monitor.service

# Xem thông tin đăng nhập quản trị ban đầu
sudo cat /etc/tfg-monitor/admin-credentials.txt

# Kiểm tra cú pháp cấu hình Apache
sudo httpd -t
```
