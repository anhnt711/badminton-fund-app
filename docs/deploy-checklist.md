# Deploy checklist

## 1. Supabase

Bạn cần thao tác trong Supabase dashboard vì phiên Codex hiện không có Supabase connector/tool chạy SQL.

1. Tạo project Supabase.
2. Vào `SQL Editor`.
3. Mở file `supabase/schema.sql` trong project này.
4. Copy toàn bộ nội dung và chạy trong SQL Editor.
5. Vào `Project Settings > API`, lấy:
   - `Project URL`
   - `service_role` key

## 2. Vercel

Phiên Codex hiện có Vercel connector nhưng connector chỉ trả hướng dẫn `vercel deploy`, không thực thi deploy trực tiếp. Máy hiện cũng chưa có `npm`/`vercel` CLI.

Cách deploy ít lỗi nhất:

1. Đưa thư mục `badminton-fund-app` lên GitHub repository.
2. Vào Vercel dashboard.
3. `Add New > Project`.
4. Import repository đó.
5. Framework preset: `Other`.
6. Root Directory: để mặc định nếu repo chỉ chứa app này; nếu repo chứa cả workspace thì chọn `badminton-fund-app`.
7. Thêm Environment Variables:

```text
SUPABASE_URL=Project URL từ Supabase
SUPABASE_SERVICE_ROLE_KEY=service_role key từ Supabase
ADMIN_IMPORT_KEY=tự đặt chuỗi bí mật cho admin
ACCOUNTANT_KEY=tự đặt chuỗi bí mật cho kế toán
```

8. Deploy.

## 3. Sau deploy

Mở các link:

```text
https://your-app.vercel.app/
https://your-app.vercel.app/admin/setup?key=ADMIN_IMPORT_KEY
https://your-app.vercel.app/admin/import?key=ADMIN_IMPORT_KEY
https://your-app.vercel.app/ke-toan?key=ACCOUNTANT_KEY
```

## 4. Cấu hình lần đầu

1. Mở `/admin/setup?key=ADMIN_IMPORT_KEY`.
2. Bấm `Tải cấu hình`.
3. Thay 30 thành viên mẫu bằng danh sách thật.
4. Chỉnh bảng giá.
5. Bấm `Lưu cấu hình`.

## 5. Kiểm thử nhanh

1. Mở `/admin/import?key=ADMIN_IMPORT_KEY`.
2. Dán JSON mẫu trong `README.md`.
3. Bấm `Kiểm tra`.
4. Nếu không lỗi tên, bấm `Lưu buổi`.
5. Mở `/` xem dashboard đã có công nợ/kèo chưa.
6. Mở `/ke-toan?key=ACCOUNTANT_KEY`, nhập thử một khoản thu.
7. Mở lại `/` xem số đã đóng/quỹ cập nhật.
