import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline';
}

export function Button({
  children,
  className,
  disabled,
  variant = 'default',
  ...props
}: ButtonProps) {
  const baseStyle = 'py-3 px-4 rounded-lg items-center justify-center';
  const variantStyles = {
    default: 'bg-blue-500',
    outline: 'bg-white border border-blue-500',
  };
  const textVariantStyles = {
    default: 'text-white',
    outline: 'text-blue-500',
  };
  const disabledStyle = 'opacity-50';

  return (
    <TouchableOpacity
      className={twMerge(
        baseStyle,
        variantStyles[variant],
        disabled && disabledStyle,
        className
      )}
      disabled={disabled}
      {...props}
    >
      <Text className={twMerge(
        'font-semibold text-base',
        textVariantStyles[variant]
      )}>
        {children}
      </Text>
    </TouchableOpacity>
  );
} 