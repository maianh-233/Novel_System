import {
  BarChart3,
  BookOpen,
  Gamepad2,
  KeyRound,
  LayoutDashboard,
  Library,
  Shapes,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  path: string; // tương đối với /admin; '' = trang tổng quan
  label: string;
  icon: LucideIcon;
  /** Có giá trị = mục chưa làm, hiển thị trang tạm với mô tả này. */
  upcoming?: { description: string; phase: string };
}

export const ADMIN_NAV: AdminNavItem[] = [
  { path: '', label: 'Tổng quan', icon: LayoutDashboard },
  {
    path: 'vocabulary',
    label: 'Từ vựng',
    icon: BookOpen,
    upcoming: {
      description:
        'Thêm, sửa, ẩn từ vựng kèm nghĩa, phiên âm, hình ảnh và âm thanh; nhập hàng loạt từ file CSV.',
      phase: 'Giai đoạn 2 — Quản trị nội dung',
    },
  },
  {
    path: 'categories',
    label: 'Chủ đề',
    icon: Shapes,
    upcoming: {
      description: 'Tạo, sắp xếp và ẩn các chủ đề như Animals, Fruits, Colors…',
      phase: 'Giai đoạn 2 — Quản trị nội dung',
    },
  },
  {
    path: 'lessons',
    label: 'Bài học',
    icon: Library,
    upcoming: {
      description:
        'Gom từ vựng từ nhiều chủ đề thành bộ bài học, chọn bài học cho từng trò chơi.',
      phase: 'Giai đoạn 2 — Quản trị nội dung',
    },
  },
  {
    path: 'games',
    label: 'Trò chơi',
    icon: Gamepad2,
    upcoming: {
      description:
        'Bật/tắt trò chơi, chọn số từ mỗi lượt, thời gian và độ khó.',
      phase: 'Giai đoạn 2 — Quản trị nội dung',
    },
  },
  {
    path: 'students',
    label: 'Học sinh',
    icon: Users,
    upcoming: {
      description:
        'Tạo tài khoản học sinh, xem lịch sử chơi và tiến độ của từng em.',
      phase: 'Giai đoạn 3 và 5',
    },
  },
  {
    path: 'analytics',
    label: 'Thống kê',
    icon: BarChart3,
    upcoming: {
      description:
        'Số lượt chơi, tỉ lệ đúng/sai, những từ các em hay sai nhất, tiến bộ theo tuần.',
      phase: 'Giai đoạn 5 — Thành tích & thống kê',
    },
  },
];

export const ADMIN_SETTINGS_NAV: AdminNavItem = {
  path: 'settings',
  label: 'Đổi mật khẩu',
  icon: KeyRound,
};
