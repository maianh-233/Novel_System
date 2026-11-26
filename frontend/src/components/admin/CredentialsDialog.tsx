import type { StudentCredentials } from '@novel/shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { printCredentials } from '../../utils/printCredentials';
import { Button, ErrorNote, Modal } from './ui';

/**
 * Hiện tên đăng nhập + mật khẩu vừa tạo. Mật khẩu chỉ xem được lúc này
 * (máy chủ chỉ lưu bản băm), nên nhắc giáo viên in phiếu ngay.
 */
export function CredentialsDialog({
  title,
  list,
  onClose,
}: {
  title: string;
  list: StudentCredentials[];
  onClose: () => void;
}) {
  const [blocked, setBlocked] = useState(false);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Xong</Button>
          <Button
            variant="primary"
            icon={Printer}
            onClick={() => setBlocked(!printCredentials(list))}
          >
            In phiếu đăng nhập
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-lg bg-sun/25 px-3 py-2 text-[#5c4100]">
          Mật khẩu chỉ hiện <strong>một lần</strong> ở đây. Hãy in phiếu hoặc
          ghi lại trước khi đóng — quên thì đặt lại mật khẩu mới.
        </p>
        {blocked && (
          <ErrorNote>
            Trình duyệt đã chặn cửa sổ in. Cho phép cửa sổ bật lên (pop-up) cho
            trang này rồi bấm lại.
          </ErrorNote>
        )}
        <table className="w-full text-left">
          <thead className="text-xs text-ink/60">
            <tr>
              <th className="py-1.5 font-medium">Học sinh</th>
              <th className="py-1.5 font-medium">Tên đăng nhập</th>
              <th className="py-1.5 font-medium">Mật khẩu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {list.map((c) => (
              <tr key={c.id}>
                <td className="py-2">{c.displayName}</td>
                <td className="py-2 font-mono text-base">{c.username}</td>
                <td className="py-2 font-mono text-base">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
