# NGUỒN DỮ LIỆU VẬN HÀNH TRUNG TÂM HÙNG CƯỜNG

> Mục đích: Làm nguồn dữ liệu gốc (Master Data) phục vụ vận hành trung tâm và khởi tạo dữ liệu cho các tháng mới.
>
> Phạm vi: Chỉ lưu thông tin lớp học, học sinh và giáo viên/trợ giảng.
>
> Không bao gồm: học phí, doanh thu, thu/chi, lương, số buổi theo tháng, điểm danh tháng cũ hoặc các dữ liệu kế toán khác.

---

## 1. Danh sách lớp

| Mã lớp | Tên lớp | Khối | Môn | Lịch học | Giáo viên chính | Trợ giảng |
|---|---|---:|---|---|---|---|
| L06 | Lớp 6 Thầy Cường | 6 | Toán | Thứ 5, Chủ nhật | Nguyễn Mạnh Cường | Nguyễn Hà Anh |
| L07 | Toán 7 Thầy Cường | 7 | Toán | Thứ 3, Thứ 6 | Nguyễn Mạnh Cường | Đào Quang Duy |
| L08 | Toán 8 Thầy Cường | 8 | Toán | Thứ 3, Chủ nhật | Nguyễn Mạnh Cường | Đào Phương Anh |
| L09 | Toán 9 Thầy Cường | 9 | Toán | Thứ 2, Thứ 5 | Nguyễn Mạnh Cường | Đào Phương Anh |

**Tổng số lớp đang hoạt động: 4 lớp.**

---

## 2. Danh sách học sinh theo lớp

### 2.1. L06 — Lớp 6 Thầy Cường

**Sĩ số: 18 học sinh**

| STT | Họ và tên |
|---:|---|
| 1 | Đào Thị Kim Ngân |
| 2 | Đặng Phương Anh |
| 3 | Nguyễn Gia Bảo |
| 4 | Nguyễn Đặng Gia Bảo |
| 5 | Tuệ Lâm |
| 6 | Đặng Khánh Linh |
| 7 | Nguyễn Ngọc Diệp |
| 8 | Nguyễn Ngọc Cẩm Tú |
| 9 | Đào Thế Hoàng |
| 10 | Đào Nguyễn Bình An |
| 11 | Nguyễn Trà My |
| 12 | Bảo Dũng |
| 13 | Đào Quang Minh |
| 14 | Duy |
| 15 | Phúc |
| 16 | Linh |
| 17 | Hân |
| 18 | Kiều Anh |

---

### 2.2. L07 — Toán 7 Thầy Cường

**Sĩ số: 13 học sinh**

| STT | Họ và tên |
|---:|---|
| 1 | Lê Ngọc Ánh |
| 2 | Nguyễn Thị Hồng Hạnh |
| 3 | Nguyễn Văn Phúc |
| 4 | Đào Thành Lê |
| 5 | Nguyễn Thành Công |
| 6 | Bùi Bảo Minh Anh |
| 7 | Cao Nhật Minh |
| 8 | Phạm Mạnh Hùng |
| 9 | Hiếu |
| 10 | Cẩm Tiên |
| 11 | Bảo An |
| 12 | Đăng |
| 13 | Lan |

---

### 2.3. L08 — Toán 8 Thầy Cường

**Sĩ số: 7 học sinh**

| STT | Họ và tên |
|---:|---|
| 1 | Minh Thư |
| 2 | Nguyễn Đình Phát |
| 3 | Đỗ Thị Mai Ngọc |
| 4 | Bùi Hiền Nhi |
| 5 | Nguyễn Đặng Gia Hân |
| 6 | Đào Ngọc Khánh |
| 7 | Nhân |

---

### 2.4. L09 — Toán 9 Thầy Cường

**Sĩ số: 12 học sinh**

| STT | Họ và tên |
|---:|---|
| 1 | Trường An |
| 2 | Như Quỳnh |
| 3 | Huy Đức |
| 4 | Anh Trọng |
| 5 | Nguyễn Gia Bảo |
| 6 | Phạm Đức Hùng |
| 7 | Quân |
| 8 | Châu |
| 9 | Phương Nhi |
| 10 | Lê Bảo Châm |
| 11 | Tuấn |
| 12 | Xuân Quỳnh |

---

### 2.5. Tổng hợp sĩ số

| Lớp | Sĩ số |
|---|---:|
| L06 | 18 |
| L07 | 13 |
| L08 | 7 |
| L09 | 12 |
| **Tổng** | **50** |

---

## 3. Giáo viên và trợ giảng

| Mã nhân sự | Họ và tên | Vai trò | Phân công |
|---|---|---|---|
| GV001 | Nguyễn Mạnh Cường | Giáo viên chính | L06, L07, L08, L09 |
| GV002 | Nguyễn Thị Huệ | Giáo viên | Chưa có phân công lớp trong dữ liệu hiện tại |
| TG001 | Đào Quang Duy | Trợ giảng | L07 |
| TG002 | Đào Phương Anh | Trợ giảng | L08, L09 |
| TG003 | Nguyễn Hà Anh | Trợ giảng | L06 |

**Tổng số nhân sự giảng dạy/trợ giảng: 5 người.**

---

## 4. Quan hệ dữ liệu vận hành

### 4.1. Lớp → Học sinh

Mỗi học sinh thuộc một lớp vận hành tại một thời điểm.

Ví dụ:

- `L06` → 18 học sinh
- `L07` → 13 học sinh
- `L08` → 7 học sinh
- `L09` → 12 học sinh

### 4.2. Lớp → Giáo viên

Mỗi lớp có:

- 01 giáo viên chính.
- Có thể có hoặc không có trợ giảng.
- Một giáo viên/trợ giảng có thể phụ trách nhiều lớp.

### 4.3. Dữ liệu Master và dữ liệu theo tháng

Nguồn dữ liệu này được xem là **Master Data** của trung tâm.

Master Data chỉ nên chứa:

1. Danh sách lớp.
2. Danh sách học sinh.
3. Học sinh thuộc lớp nào.
4. Danh sách giáo viên/trợ giảng.
5. Giáo viên/trợ giảng phụ trách lớp nào.
6. Lịch học cơ bản của lớp.
7. Trạng thái hoạt động nếu hệ thống cần mở rộng sau này.

Các dữ liệu phát sinh theo từng tháng **không lưu trực tiếp vào Master Data**, ví dụ:

- Điểm danh.
- Số buổi học thực tế.
- Nghỉ học.
- Học bù.
- Học phí.
- Tiền đã đóng.
- Công nợ.
- Lương giáo viên.
- Lương trợ giảng.
- Doanh thu.
- Chi phí.
- Thưởng/phạt.
- Các khoản thu/chi khác.

---

## 5. Cấu trúc dữ liệu đề xuất

### 5.1. `classes`

```text
class_id
class_name
grade
subject
schedule
main_teacher_id
assistant_teacher_id
status
```

### 5.2. `students`

```text
student_id
full_name
class_id
status
```

### 5.3. `teachers`

```text
teacher_id
full_name
role
status
```

### 5.4. `teacher_classes`

Dùng khi một giáo viên hoặc trợ giảng phụ trách nhiều lớp.

```text
teacher_id
class_id
role_in_class
```

---

## 6. Nguyên tắc tạo dữ liệu cho tháng mới

Khi bắt đầu một tháng mới, hệ thống nên:

1. Đọc danh sách lớp đang hoạt động từ Master Data.
2. Đọc danh sách học sinh đang hoạt động của từng lớp.
3. Đọc giáo viên và trợ giảng đang phụ trách lớp.
4. Tạo dữ liệu tháng mới từ trạng thái hiện tại.
5. Không sao chép số buổi, điểm danh, học phí, công nợ hoặc dữ liệu kế toán của tháng trước.
6. Mỗi tháng là một bộ dữ liệu phát sinh độc lập.
7. Việc thay đổi học sinh/lớp/giáo viên phải cập nhật vào Master Data trước khi sinh dữ liệu tháng mới.

---

## 7. Tổng quan dữ liệu hiện tại

| Thành phần | Số lượng |
|---|---:|
| Lớp | 4 |
| Học sinh | 50 |
| Giáo viên chính | 2 |
| Trợ giảng | 3 |
| Tổng nhân sự giảng dạy | 5 |

---

## 8. Phạm vi sử dụng

File này được dùng làm nguồn chuẩn để:

- Khởi tạo tháng học mới.
- Tạo bảng điểm danh tháng.
- Tạo danh sách học sinh theo lớp.
- Phân công giáo viên/trợ giảng.
- Làm nguồn cho hệ thống quản lý trung tâm.
- Làm đầu vào để tạo dữ liệu kế toán theo từng tháng.

**Không sử dụng dữ liệu tháng cũ làm dữ liệu gốc.**
