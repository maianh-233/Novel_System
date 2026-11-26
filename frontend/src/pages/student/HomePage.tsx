import { ExamShelf } from '../../components/student/ExamShelf';
import { GameSticker } from '../../components/student/GameSticker';
import { TopicShelf } from '../../components/student/TopicShelf';
import { WordOfTheDay } from '../../components/student/WordOfTheDay';
import { isGameForLearner } from '@novel/shared';
import { CATALOG, TINT_BG } from '../../games/catalog';
import { useLearner } from '../../hooks/useStudentSession';

export function HomePage() {
  const learner = useLearner();
  // Chỉ hiện game dành cho khối của em; nhóm không còn game nào (vd: Vui học ở cấp 2) thì ẩn cả nhóm.
  const groups = CATALOG.map((g) => ({
    ...g,
    games: g.games.filter((game) => isGameForLearner(game, learner)),
  })).filter((g) => g.games.length > 0);

  return (
    <div className="flex flex-col gap-14">
      <ExamShelf />

      <WordOfTheDay />

      <TopicShelf />

      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className={`sticker grid size-14 shrink-0 place-items-center ${TINT_BG[group.tint]}`}
              >
                <GroupIcon className="size-7" strokeWidth={2.5} />
              </span>
              <div>
                <h2
                  id={`group-${group.id}`}
                  className="font-display text-3xl leading-tight font-extrabold"
                >
                  {group.title}
                </h2>
                <p className="text-ink/70">{group.blurb}</p>
              </div>
            </div>

            <ul className="mt-6 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {group.games.map((game, i) => (
                <li key={game.slug}>
                  <GameSticker game={game} tint={group.tint} index={i} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
