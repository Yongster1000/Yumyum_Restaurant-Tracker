import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Path, Polygon, Rect } from 'react-native-svg';

// Lucide-style line icons (24x24 viewBox, 2.75 stroke) matching the icon set
// used throughout the redesign. `Compass` substitutes for a custom tab-bar
// image asset from the design that isn't available to pull into the repo.

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function LineIcon({
  size = 24,
  color = '#201e1d',
  strokeWidth = 2.75,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child, {
              stroke: color,
              strokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              fill: 'none',
            } as Record<string, unknown>)
          : child,
      )}
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.3-4.3" />
    </LineIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </LineIcon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </LineIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="m15 18-6-6 6-6" />
    </LineIcon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <Circle cx={12} cy={13} r={3.5} />
    </LineIcon>
  );
}

export function UtensilsIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <Path d="M7 2v20" />
      <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
      <Path d="M21 15v7" />
    </LineIcon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z" />
      <Path d="m15 5 4 4" />
    </LineIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M20 6 9 17l-5-5" />
    </LineIcon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17 21 12 16 7" />
      <Path d="M21 12H9" />
    </LineIcon>
  );
}

export function CompassIcon(props: IconProps) {
  const { size = 24, color = '#201e1d', strokeWidth = 2.75 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth} />
      <Polygon
        points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Filled when `active` (or when `fraction` >= 1), outlined neutral when not.
 * `fraction` (0-1) takes priority over `active` and supports a half-filled
 * star — used both for the plain 5-star rating row and, via a fractional
 * value, half-star ratings (entry rating + per-dish ratings).
 */
export function StarIcon({
  size = 24,
  active = false,
  fraction,
  color = '#c67139',
  inactiveColor = '#c0b6a5',
}: {
  size?: number;
  active?: boolean;
  fraction?: number;
  color?: string;
  inactiveColor?: string;
}) {
  const d = 'M11.5 2.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3 8.7l5.9-.8z';
  const clamped = Math.max(0, Math.min(1, fraction ?? (active ? 1 : 0)));
  // clipPath ids share a single namespace per-document on web, so a plain
  // literal id would clip every half-filled star in a list to whichever one
  // rendered its <ClipPath> last — useId keeps each instance unique.
  const clipId = `star-clip-${useId()}`;

  if (clamped <= 0) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={d} fill="none" stroke={inactiveColor} strokeWidth={2} />
      </Svg>
    );
  }

  if (clamped >= 1) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={d} fill={color} stroke={color} strokeWidth={2.75} strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} fill="none" stroke={inactiveColor} strokeWidth={2} />
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={0} y={0} width={24 * clamped} height={24} />
        </ClipPath>
      </Defs>
      <Path d={d} fill={color} stroke={color} strokeWidth={2.75} strokeLinejoin="round" clipPath={`url(#${clipId})`} />
    </Svg>
  );
}
