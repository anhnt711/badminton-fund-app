# Badminton Fund App

Web app quản lý công nợ đội cầu lông:

- Dashboard công khai: `/`
- Nhập buổi từ JSON do AI chuẩn hóa từ ảnh: `/admin/import?key=ADMIN_IMPORT_KEY`
- Cấu hình thành viên/bảng giá: `/admin/setup?key=ADMIN_IMPORT_KEY`
- Kế toán nhập thu chi: `/ke-toan?key=ACCOUNTANT_KEY`

## Cài Supabase

1. Tạo project Supabase.
2. Mở SQL Editor, chạy toàn bộ file `supabase/schema.sql`.
3. Vào Project Settings > API, lấy:
   - Project URL
   - `service_role` key

## Cấu hình Vercel

Tạo các Environment Variables:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_IMPORT_KEY=...
ACCOUNTANT_KEY=...
```

`ADMIN_IMPORT_KEY` và `ACCOUNTANT_KEY` là chuỗi bí mật bạn tự đặt. Ai có link chứa key thì có thể nhập dữ liệu tương ứng.

## Dữ liệu import mẫu

```json
{
  "date": "2026-06-22",
  "title": "Tối thứ 2",
  "shuttleCount": 4,
  "bottleCount": 18,
  "waterExpense": 120000,
  "players": [
    { "name": "Thành viên 01", "potDue": 30000 },
    { "name": "Thành viên 02", "potDue": 20000 },
    { "name": "Thành viên 20", "potDue": 25000 }
  ],
  "note": "Dữ liệu nhập từ ảnh sau buổi"
}
```

Với thành viên vãng lai, app tự cộng phí buổi theo giới tính. Với thành viên cố định, app chỉ cộng tiền kèo của buổi.

## Luồng vận hành

### Một lần sau khi deploy

1. Mở `/admin/setup?key=ADMIN_IMPORT_KEY`.
2. Bấm `Tải cấu hình`.
3. Sửa danh sách thành viên CSV theo dạng:

```csv
code,name,gender,membership_type,active
TV01,Nguyễn Văn A,Nam,monthly,true
TV02,Trần Thị B,Nữ,half_month,true
TV03,Lê Văn C,Nam,guest,true
```

`membership_type` nhận một trong ba giá trị:

- `monthly`: cố định tháng
- `half_month`: cố định nửa tháng
- `guest`: vãng lai

4. Chỉnh bảng giá nếu cần.
5. Bấm `Lưu cấu hình`.

### Sau mỗi buổi

1. Chủ đội chụp ảnh danh sách người chơi và tiền kèo từng người.
2. AI đọc ảnh và trả JSON theo prompt trong `docs/ai-import-prompt.md`.
3. Mở `/admin/import?key=ADMIN_IMPORT_KEY`.
4. Dán JSON, bấm `Kiểm tra`.
5. Nếu không báo tên sai, bấm `Lưu buổi`.

### Kế toán

Kế toán mở `/ke-toan?key=ACCOUNTANT_KEY` và nhập các khoản:

- Thành viên đóng tiền
- Tiền sân
- Mua cầu
- Mua nước
- Chi phí phát sinh

### Thành viên

Thành viên mở `/` để xem công nợ công khai, tổng quỹ, tổng kèo, tiền nước đã mua và kèo còn lại.
