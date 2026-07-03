import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  colors: string[];
  className?: string;
}

export function ColorPicker({ 
  selectedColor, 
  onColorChange, 
  colors, 
  className 
}: ColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-6 gap-2", className)}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
            selectedColor === color 
              ? "border-foreground ring-2 ring-foreground ring-offset-2" 
              : "border-border"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onColorChange(color)}
          aria-label={`Select color ${color}`}
        >
          {selectedColor === color && (
            <Check className="w-4 h-4 text-white mx-auto" />
          )}
        </button>
      ))}
    </div>
  );
}
