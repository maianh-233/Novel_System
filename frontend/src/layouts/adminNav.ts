import {
  BarChart3,
  BookOpen,
  ClipboardList,
  CircleHelp,
  Gamepad2,
  KeyRound,
  LayoutDashboard,
  Library,
  NotebookPen,
  School,
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
  },
  {
    path: 'categories',
    label: 'Chủ đề',
    icon: Shapes,
  },
  {
    path: 'lessons',
    label: 'Bài học',
    icon: Library,
  },
  {
    path: 'questions',
    label: 'Câu hỏi',
    icon: CircleHelp,
  },
  {
    path: 'exams',
    label: 'Đề thi',
    icon: ClipboardList,
  },
  {
    path: 'assignments',
    label: 'Bài tập',
    icon: NotebookPen,
  },
  {
    path: 'games',
    label: 'Trò chơi',
    icon: Gamepad2,
  },
  {
    path: 'classes',
    label: 'Lớp học',
    icon: School,
  },
  {
    path: 'students',
    label: 'Học sinh',
    icon: Users,
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
