import React from 'react';
import styles from './Button.module.css';

/**
 * `dangerFilled` is the confirming half of a destructive pair -- the DELETE in
 * the delete dialog -- while `danger` is the outlined trigger that opens it.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerFilled'
  | 'quiet';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  className,
  children,
  ...props
}) => {
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
};
