import React from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  children,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonProps) {
  const baseClass = 'button';
  const variantClass =
    variant === 'secondary' ? 'button-secondary' : variant === 'danger' ? 'button-danger' : '';
  const sizeClass = size === 'sm' ? 'button-sm' : '';

  return (
    <button
      disabled={disabled}
      className={cn(baseClass, variantClass, sizeClass, className)}
      {...rest}
    >
      <span className="button-label">{children}</span>
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder = '',
  type = 'text',
  disabled = false,
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn('input', className)}
      {...rest}
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  rows = 4,
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={cn('textarea', className)}
      {...rest}
    />
  );
}

export function Card({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <article className={cn('card', className)} {...rest}>
      {children}
    </article>
  );
}

export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="section-header" style={{ marginBottom: '2rem' }}>
      <p className="section-kicker">Recovery Flow</p>
      <h1>{title}</h1>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </header>
  );
}

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}) {
  const variantClass = `badge-${variant !== 'default' ? variant : ''}`;
  return (
    <span className={cn('pill', variantClass, className)}>
      {children}
    </span>
  );
}

export function Pill({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('pill', className)}>{children}</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        {icon && <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>}
        <h3>{title}</h3>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-tertiary)' }}>{description}</p>
        {action && (
          <Button onClick={action.onClick} style={{ marginTop: '1rem' }}>
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  const bgColor =
    type === 'error'
      ? 'rgba(var(--error-rgb), 0.2)'
      : type === 'info'
        ? 'rgba(var(--warning-rgb), 0.2)'
        : 'rgba(var(--success-rgb), 0.2)';
  const textColor =
    type === 'error' ? 'var(--error)' : type === 'info' ? 'var(--warning)' : 'var(--success)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        background: bgColor,
        color: textColor,
        borderRadius: '0.5rem',
        border: `1px solid ${textColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        minWidth: '300px',
        animation: 'slideUp 0.3s ease',
        zIndex: 1000,
      }}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: '1.5rem',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height, marginBottom: '1rem' }}
      {...rest}
    />
  );
}

export function LoadingSpinner() {
  return (
    <div className="loading-spinner" aria-label="Loading" />
  );
}

export function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const percentage = total === 0 ? 0 : (current / total) * 100;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span>{label}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {current} / {total}
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '0.5rem',
          background: 'var(--bg-tertiary)',
          borderRadius: '0.25rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: 'var(--primary-light)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}) {
  const range = max - min || 1;
  const percentage = ((value - min) / range) * 100;
  const displayValue = step < 1 ? value.toFixed(1) : String(value);

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {label && <label className="label">{label}</label>}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input
          className="smooth-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            background: `linear-gradient(90deg, var(--primary) 0 ${percentage}%, var(--bg-tertiary) ${percentage}% 100%)`,
          }}
        />
        <span className="slider-value-pill">
          {displayValue} / {max}
        </span>
      </div>
    </div>
  );
}

export function Grid({
  children,
  cols = 1,
  gap = '1rem',
  className = '',
}: {
  children: React.ReactNode;
  cols?: number;
  gap?: string;
  className?: string;
}) {
  return (
    <section
      className={cn('flow-grid', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
      }}
    >
      {children}
    </section>
  );
}
