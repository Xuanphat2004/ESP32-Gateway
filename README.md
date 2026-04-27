
# Hệ thống giám sát năng lượng mặt trời

Hệ thống giám sát năng lượng mặt trời thời gian thực, được xây dựng bằng Django, Django Channels, PostgreSQL, Redis và React. Ứng dụng thu thập dữ liệu inverter, meter và weather station, đẩy cập nhật qua WebSocket và hiển thị các chỉ số thời gian thực trên giao diện web.
## Đặc điểm

- Cập Nhật Thời Gian Thực: Sử dụng Django Channels và WebSocket để đẩy dữ liệu tới frontend.
- Giao Diện Frontend: Giao diện được hiện thực bằng Reactjs, hiển thị các thông tin về site, inverter, meter và weather station do người dùng quản lí, cập nhật thời gian thực qua WebSocket.
- Cơ Sở Dữ Liệu: PostgreSQL lưu trữ dữ liệu của user, site, inverter, meter và weather station với.

## Cấu trúc dự án
- backend
    - account: phần authentication sẽ sử dụng bảng User có sẵn trong django.contrib.auth.models nên các file admin, apps, models, tests sẽ không có gì.
    - data:
        - models: định nghĩa các models (bảng) site, inverter, meter và weather station.
        - tests: định nghĩa các hàm dùng để test từng models.
        - views: định nghĩa các hàm dùng để xử lí các api tương ứng với inverter, meter và weather station được định nghĩa trong urls.py.
        - admin: dùng để đăng kí các models.
        - apps:
        - connectpsql (chưa sử dụng)
        - redis_cache: định nghĩa các hàm tương tác với redis server.
        - routing: định nghĩa các urls để kết nối đến backend qua WebSocket.
        - senddata (chưa sử dụng)
        - serializers (chưa sử dụng)
        - signals: khi sự thay đổi trong dữ liệu Inverter, Meter, Weather_station thì sẽ gửi tín hiệu đến cho consumers.py để thực hiện việt gửi dữ liệu đến frontend. 
        - urls: định nghĩa các api.
    - SolarMonitoring
        - asgi: dùng để cấu hình cho Django app để có thể chạy đồng thời HTTP và WebSocket
        - settings: cấu hình trung tâm cho project.
        - urls: nó quyết định khi user gõ một URL → Django sẽ gọi app nào, view nào để xử lý.
        - wsgi: dùng để là kết nối giữa server và Django app qua HTTP.
    - manage.py
        - Chạy server phát triển (runserver).
        - Quản lý cơ sở dữ liệu (makemigrations, migrate).
        - Tạo superuser để đăng nhập admin.
        - Chạy shell Django (python manage.py shell).
        - Quản lý app (startapp, startproject).
    - requirements.txt: dùng để liệt kê tất cả các thư viện (dependencies) mà project cần để chạy đúng.

- frontend
    - ApiComponent: định nghĩa các hàm để gọi api.
    - assets: lưu trữ các hình ảnh, tài liệu, ...
    - Auth: dùng cho việc đăng nhập, đăng xuất và xác minh quyền truy cập các thành phần.
    - ChartComponents: Định nghĩa các template biểu đồ và sử dụng thông qua việc truyền tham số.
    - DataComponents: 
    - InteractComponents: định nghĩa của template các nút nhấn, lịch, bảng,...
    - OptionComponents: định nghĩa các page cho website.
    - TableDevice: chứa các template bảng (có thể cho vào InteractComponents)
    - App.css: dùng để tạo kiểu cho App.jsx.
    - App.jsx: là entry chính để định nghĩa routing, bảo mật, và theme cho toàn bộ frontend React app.
    - Axios.jsx: là file cấu hình một “Axios Client” để tái sử dụng, giúp code ngắn gọn và dễ quản lý khi gọi API.
    - index.jsx: dùng để tạo kiểu cho App.jsx (có thể xóa).
    - main.jsx: là file gốc để khởi động ứng dụng React, mount App.jsx vào DOM và cấu hình các provider toàn cục.
    - theme.jsx: định nghĩa theme.
    - themeContext.jsx: dùng để đổi theme cho website.

## Yêu cầu

- Python 3.11
- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- Django 4.x, Django Channels, asyncpg, redis-py
## Cài đặt
**Clone Repository**
```bash
git clone https://github.com/thanhduy1806/solar.git
cd solar
```
**Cài đặt backend**
1. Chuyển đến thư mục backend
```bash
cd backend
```
2. Tạo và kích hoạt môi trường ảo
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
# hoặc
source venv/bin/activate  # Linux/Mac
```
3. Cài đặt các thư viện
```bash
pip install -r requirements.txt
```
4. Cấu hình Postgresql
- Tạo database trong PostgreSQL (ví dụ: solar_db).
- Cập nhật backend/SolarMontoring/settings.py với thông tin database:
```bash
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'solar_db',
        'USER': 'your_db_user',
        'PASSWORD': 'your_db_password',
        'HOST': '127.0.0.1',
        'PORT': '5432',
    }
}
```
5. Chạy migrations
```bash
python manage.py makemigrations
python manage.py migrate
```
**Cài đặt Redis**
1. Cài Redis
- Windows: Tải và cài Redis từ Redis releases.
- Linux/Mac: Sử dụng trình quản lý gói (ví dụ: sudo apt install redis-server).
- Có thể dùng WSL (giống Linux) để cài đặt redis server chạy trên Windows
2. Khởi động Redis
```bash
redis-server
redis-cli ping  # Phải trả về "PONG"
```
**Cài đặt frontend**
1. Chuyển đến thư mục frontend
```bash
cd frontend
```
2. Cài đặt các thư viện
```bash
npm install
```

## Chạy ứng dụng

Khởi động frontend

```bash
  cd frontend
  npm run dev
```

Khởi động backend

```bash
  cd backend
  ./venv/Scripts/activate  # Cho Windows
  daphne -b 0.0.0.0 -p 8000 SolarMontoring.asgi:application
```
Truy cập ứng dụng
- Mở http://localhost:5173 trên trình duyệt.
- Sử dụng DevTools (F12 > Console) để theo dõi tin nhắn WebSocket.

Kiểm tra
- Mô phỏng cập nhật dữ liệu cho inverter trong DeviceList
```bash
cd backend
python manage.py shell
```
- Trong shell
```bash
from data.tests.inverter_test import simulate_inverter_updates
simulate_inverter_updates(site_id=1, num_updates=5)
```
