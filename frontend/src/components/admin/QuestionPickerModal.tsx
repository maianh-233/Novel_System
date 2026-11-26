import {
  QUESTION_TYPE_INFO,
  QUESTION_TYPES,
  type QuestionAdmin,
  type QuestionType,
} from '@novel/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import {
  useQuestionList,
  useQuestionTags,
} from '../../hooks/useQuestionsAdmin';
import { plainText } from '../../utils/questions';
import { Button, LevelBadge, LoadingBlock, Modal } from './ui';

/** Chọn nhiều câu từ ngân hàng (lọc theo dạng / chủ điểm), bỏ qua câu đã có trong đề. */
export function QuestionPickerModal({
  title,
  exclude,
  onClose,
  onPick,
}: {
  title: string;
  exclude: Set<string>;
  onClose: () => void;
  onPick: (questions: QuestionAdmin[]) => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<QuestionType | ''>('');
  const [tag, setTag] = useState('');
  const { data: tags = [] } = useQuestionTags();
  const { data, isPending, isFetching } = useQuestionList({
    q: q.trim() || undefined,
    type: type || undefined,
    grammarTag: tag || undefined,
    status: 'ACTIVE',
    pageSize: 100,
  });
  const [picked, setPicked] = useState<Map<string, QuestionAdmin>>(new Map());
  const available = data?.items.filter((x) => !exclude.has(x.id)) ?? [];

  const toggle = (x: QuestionAdmin) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(x.id)) next.delete(x.id);
      else next.set(x.id, x);
      return next;
    });

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            disabled={picked.size === 0}
            onClick={() => onPick([...picked.values()])}
          >
            Thêm {picked.size} câu
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/45"
            />
            <input
              type="search"
              aria-label="Tìm câu hỏi"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm trong đề bài"
              className="w-full rounded-lg border-2 border-admin-line py-1.5 pr-3 pl-9 outline-none focus:border-admin-accent"
            />
          </div>
          <select
            aria-label="Dạng câu"
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType | '')}
            className="rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5"
          >
            <option value="">Mọi dạng</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_INFO[t].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Chủ điểm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5"
          >
            <option value="">Mọi chủ điểm</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button
            disabled={available.length === 0}
            onClick={() =>
              setPicked((cur) => {
                const next = new Map(cur);
                for (const x of available) next.set(x.id, x);
                return next;
              })
            }
          >
            Chọn cả {available.length} câu
          </Button>
        </div>
        {isPending ? (
          <LoadingBlock />
        ) : (
          <ul
            className={`max-h-[55dvh] divide-y divide-admin-line overflow-y-auto rounded-lg border border-admin-line ${isFetching ? 'opacity-70' : ''}`}
          >
            {data?.items.length === 0 && (
              <li className="px-4 py-8 text-center text-ink/60">
                Không có câu nào khớp.
              </li>
            )}
            {data?.items.map((x) => {
              const inExam = exclude.has(x.id);
              return (
                <li key={x.id}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2 ${inExam ? 'opacity-50' : 'cursor-pointer hover:bg-admin-bg'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={inExam}
                      checked={inExam || picked.has(x.id)}
                      onChange={() => toggle(x)}
                      className="size-4 accent-admin-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {plainText(x.prompt)}
                      </span>
                      <span className="block truncate text-xs text-ink/60">
                        {QUESTION_TYPE_INFO[x.type].label}
                        {x.grammarTag ? ` · ${x.grammarTag}` : ''}
                        {inExam ? ' · đã có trong đề' : ''}
                      </span>
                    </span>
                    <LevelBadge level={x.level} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {data && data.total > data.items.length && (
          <p className="text-xs text-ink/55">
            Đang hiện {data.items.length}/{data.total} câu — lọc để thu hẹp.
          </p>
        )}
      </div>
    </Modal>
  );
}
