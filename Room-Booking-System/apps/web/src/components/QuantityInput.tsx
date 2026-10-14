import { useState, type ComponentProps } from 'react';

type QuantityInputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'defaultValue'> & {
  value: number;
};

/** Keep an empty editing value separate from the numeric quantity. */
export function QuantityInput({ value, onFocus, onChange, onBlur, ...props }: QuantityInputProps) {
  const [empty, setEmpty] = useState(false);

  return <input {...props} type="number" value={empty && value === 0 ? '' : value}
    onFocus={event => {
      if (value === 0) setEmpty(true);
      onFocus?.(event);
    }}
    onChange={event => {
      setEmpty(event.target.value === '');
      onChange?.(event);
    }}
    onBlur={event => {
      setEmpty(false);
      onBlur?.(event);
    }} />;
}
