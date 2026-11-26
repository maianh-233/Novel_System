import { useHealth } from '../hooks/useHealth';
import { describeHealth, type Tone } from '../utils/health';

const DOT: Record<Tone, string> = {
  ok: 'bg-leaf',
  warn: 'bg-sun',
  down: 'bg-coral',
  pending: 'bg-gray-300 animate-pulse',
};

/** Chỉ báo nhỏ cho môi trường dev — xác nhận FE ↔ BE ↔ DB thông nhau. */
export function ServerStatus() {
  const { data, isError } = useHealth();
  const { tone, label } = describeHealth(data, isError);
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className={`size-2.5 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  );
}
