/**
 * 可点的美术资源（广东财贸职业学院 · 官方教材呈现）。
 * 点一下：弹一下 + 喵一声（WebAudio 合成）。
 */
import { useState } from 'react';
import { playMeow } from '../lib/meow';

const ART_SRC = './art/college-art.jpg';

export function MeowArt({
  className = 'meow-art',
  onMeow,
  alt = '广东财贸职业学院 官方教材呈现',
}: {
  className?: string;
  onMeow?: () => void;
  alt?: string;
}) {
  const [pop, setPop] = useState(false);

  return (
    <button
      type="button"
      className={[className, pop ? 'pop' : ''].join(' ').trim()}
      aria-label="戳一下，喵～"
      title="戳一下，喵～"
      onClick={() => {
        setPop(true);
        window.setTimeout(() => setPop(false), 420);
        playMeow();
        onMeow?.();
      }}
    >
      <img src={ART_SRC} alt={alt} />
    </button>
  );
}
