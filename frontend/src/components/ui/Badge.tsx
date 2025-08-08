import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ level, className }) => {
  const classNames = [
    styles.badge,
    styles[level.toLowerCase()],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classNames}>
      {level}
    </span>
  );
};