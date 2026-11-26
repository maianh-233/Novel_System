import { GRADES, STAGE_LABEL, stageOfGrade, type Stage } from '@novel/shared';
import { audienceLabel, type Audience } from '../../utils/audience';
import { Badge, SelectField } from './ui';

export type { Audience };

export function AudienceBadge(a: Audience) {
  return (
    <Badge tone={a.stage === 'secondary' ? 'blue' : 'neutral'}>
      {audienceLabel(a)}
    </Badge>
  );
}

const STAGE_VALUE = { primary: 'primary', secondary: 'secondary', both: '' };

/** Hai ô chọn: cấp học, rồi khối (chỉ các khối của cấp học đó). Đổi cấp học thì bỏ khối. */
export function AudienceFields({
  value,
  onChange,
  error,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  error?: string;
}) {
  const grades = value.stage
    ? GRADES.filter((g) => stageOfGrade(g) === value.stage)
    : [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Dành cho"
        value={value.stage ?? STAGE_VALUE.both}
        onChange={(e) =>
          onChange({
            stage: (e.target.value || null) as Stage | null,
            grade: null,
          })
        }
      >
        <option value={STAGE_VALUE.primary}>{STAGE_LABEL.primary}</option>
        <option value={STAGE_VALUE.secondary}>{STAGE_LABEL.secondary}</option>
        <option value={STAGE_VALUE.both}>Cả hai cấp</option>
      </SelectField>
      <SelectField
        label="Khối"
        value={value.grade ?? ''}
        disabled={value.stage === null}
        error={error}
        onChange={(e) =>
          onChange({
            ...value,
            grade: e.target.value ? Number(e.target.value) : null,
          })
        }
      >
        <option value="">Mọi khối</option>
        {grades.map((g) => (
          <option key={g} value={g}>
            Khối {g}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
