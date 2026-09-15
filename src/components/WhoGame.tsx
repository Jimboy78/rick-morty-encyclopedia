import { useCallback, useEffect, useState } from "react";
import { fetchCharacters, type Character } from "../services/api";

const ROUNDS = 10;
const BEST_KEY = "who-game-best";

const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0);
  } catch {
    return 0;
  }
}

/** "Who's that being?" — guess the character from a silhouette. Pool = the first, most iconic pages. */
export default function WhoGame() {
  const [pool, setPool] = useState<Character[]>([]);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<Character | null>(null);
  const [options, setOptions] = useState<Character[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(readBest);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([1, 2, 3].map((p) => fetchCharacters(p, {})))
      .then((pages) => setPool(pages.flatMap((p) => p.results)))
      .catch(() => setError(true));
  }, []);

  const nextRound = useCallback(() => {
    if (pool.length < 4) return;
    const [a, ...rest] = shuffle(pool);
    const decoys = shuffle(rest.filter((c) => c.name !== a.name)).slice(0, 3);
    setAnswer(a);
    setOptions(shuffle([a, ...decoys]));
    setPicked(null);
    setRound((r) => r + 1);
  }, [pool]);

  useEffect(() => {
    if (pool.length && round === 0) nextRound();
  }, [pool, round, nextRound]);

  const pick = (c: Character) => {
    if (picked !== null || !answer) return;
    setPicked(c.id);
    if (c.id === answer.id) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const finished = round >= ROUNDS && picked !== null;

  useEffect(() => {
    if (finished && score > best) {
      setBest(score);
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        /* ignore */
      }
    }
  }, [finished, score, best]);

  const restart = () => {
    setScore(0);
    setStreak(0);
    setRound(0);
  };

  if (error) return <p className="empty">Couldn't reach the Citadel database.</p>;
  if (!answer) return <div className="loader" />;

  const revealed = picked !== null;

  return (
    <section className="game">
      <header className="game__hud">
        <h2 className="display">Who's that being?</h2>
        <div className="hud">
          <span>Round <b>{Math.min(round, ROUNDS)}/{ROUNDS}</b></span>
          <span>Score <b>{score}</b></span>
          <span>Streak <b>{streak}🔥</b></span>
          <span>Best <b>{best}</b></span>
        </div>
      </header>

      <div className={`silhouette ${revealed ? "silhouette--revealed" : ""}`}>
        <img src={answer.image} alt={revealed ? answer.name : "Mystery character"} draggable={false} />
      </div>

      {finished ? (
        <div className="game__end">
          <p className="display">{score >= 8 ? "Wubba lubba dub dub!" : score >= 5 ? "Not bad, Morty." : "Aw geez…"}</p>
          <p>You scored {score}/{ROUNDS}.</p>
          <button className="btn btn--big" onClick={restart}>Play again</button>
        </div>
      ) : (
        <>
          <div className="options">
            {options.map((c) => {
              const state = !revealed ? "" : c.id === answer.id ? "opt--right" : c.id === picked ? "opt--wrong" : "opt--dim";
              return (
                <button key={c.id} className={`opt ${state}`} onClick={() => pick(c)} disabled={revealed}>
                  {c.name}
                </button>
              );
            })}
          </div>
          {revealed && (
            <button className="btn" onClick={nextRound}>
              {round >= ROUNDS ? "See results" : "Next portal →"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
