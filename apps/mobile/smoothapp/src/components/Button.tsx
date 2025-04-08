import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  className?: string;
}

export function Button({ children, className, disabled, ...props }: ButtonProps) {
  return (
    <TouchableOpacity
      className={twMerge(
        'bg-blue-500 py-3 px-4 rounded-lg items-center justify-center',
        disabled && 'opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      <Text className="text-white font-semibold text-base">
        {children}
      </Text>
    </TouchableOpacity>
  );
} 