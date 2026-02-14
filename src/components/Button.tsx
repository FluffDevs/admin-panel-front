"use client";
import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export default function Button({ variant = 'primary', size = 'md', className = '', disabled = false, children, ...rest }: ButtonProps) {
  let base = '';
  if (variant === 'primary') base = 'btn-fluff';
  else if (variant === 'outline') base = 'btn-outline-fluff';
  else base = 'bg-transparent';

  const sizeCls = size === 'sm' ? 'btn-sm' : '';

  return (
    <button
      {...rest}
      disabled={disabled}
      className={`${base} ${sizeCls} ${className}`.trim()}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}
