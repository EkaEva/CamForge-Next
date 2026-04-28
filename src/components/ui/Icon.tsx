import { JSX } from 'solid-js';

interface IconProps {
  name: string;
  class?: string;
  size?: number;
  fill?: boolean;
  weight?: number;
  style?: JSX.CSSProperties;
}

export function Icon(props: IconProps) {
  const size = () => props.size ?? 20;
  const weight = () => props.weight ?? 400;
  const fill = () => props.fill ? 1 : 0;

  return (
    <span
      class={`material-symbols-outlined inline-block select-none ${props.class ?? ''}`}
      style={{
        'font-size': `${size()}px`,
        'font-variation-settings': `'FILL' ${fill()}, 'wght' ${weight()}, 'GRAD' 0, 'opsz' ${size()}`,
        'line-height': 1,
        width: `${size()}px`,
        height: `${size()}px`,
        ...props.style,
      }}
      aria-hidden="true"
    >
      {props.name}
    </span>
  );
}
