import React from "react";
import styles from "./Badge.module.css";

export type BadgeLevel = "S0" | "S1" | "S2" | "S3" | "S4" | "S5";

export interface BadgeProps {
  level: BadgeLevel;
  className?: string;
  /** Hollow rather than filled: the grade has not been confirmed by a ride. */
  outlined?: boolean;
  size?: "small" | "medium" | "large";
}

export const Badge: React.FC<BadgeProps> = ({
  level,
  className,
  outlined = false,
  size = "small",
}) => {
  const classNames = [
    styles.badge,
    styles[size],
    styles[level.toLowerCase()],
    outlined && styles.outlined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Filled versus hollow is the only thing that carries the ridden state here,
  // so it has to be said out loud for anyone not seeing the swatch. The row's
  // visible UNCONF. mark is aria-hidden precisely because this covers it.
  const label = outlined
    ? `Grade ${level}, not yet ridden`
    : `Grade ${level}, ridden`;

  return (
    <span className={classNames} role="img" aria-label={label}>
      {level}
    </span>
  );
};
