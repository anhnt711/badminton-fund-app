# Prompt nhập buổi từ ảnh

Dùng prompt này khi bạn gửi ảnh danh sách người chơi và tiền kèo:

```text
Hãy đọc ảnh danh sách buổi cầu lông này và trả về JSON đúng format bên dưới.

Yêu cầu:
- Chỉ trả về JSON, không giải thích.
- Tên thành viên phải giữ đúng như trong danh sách app nếu nhận diện được.
- Nếu tên nào không chắc, đưa vào note của player đó.
- potDue là tổng tiền kèo người đó phải đóng trong buổi.
- Nếu không thấy số cầu/nước/tiền nước thì để 0.
- Không tự cộng tiền cố định tháng/nửa tháng; app sẽ tự tính.
- Với người vãng lai, app sẽ tự cộng phí buổi theo giới tính.

Format:
{
  "date": "YYYY-MM-DD",
  "title": "Tên buổi",
  "shuttleCount": 0,
  "bottleCount": 0,
  "waterExpense": 0,
  "potExpense": 0,
  "players": [
    { "name": "Tên thành viên", "potDue": 0, "note": "" }
  ],
  "note": ""
}
```

Sau khi có JSON, mở:

```text
/admin/import?key=ADMIN_IMPORT_KEY
```

Dán JSON, bấm `Kiểm tra`, nếu không báo tên sai thì bấm `Lưu buổi`.
