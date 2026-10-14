import { useState, type ComponentProps } from 'react';

type QuantityInputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'defaultValue'> & {
  value: number;
};

/** Keep an empty editing value separate from the numeric quantity. */
export function QuantityInput({ value, onFocus, onChange, onBlur, onKeyDown, onPaste, ...props }: QuantityInputProps) {
  const [empty, setEmpty] = useState(false);

  return <input {...props} type="number" value={empty && value === 0 ? '' : value}
    onKeyDown={event => {
      if (event.key === '-') event.preventDefault();
      onKeyDown?.(event);
    }}
    onPaste={event => {
      if (event.clipboardData.getData('text').includes('-')) event.preventDefault();
      onPaste?.(event);
    }}
    onFocus={event => {
      if (value === 0) setEmpty(true);
      onFocus?.(event);
    }}
    onChange={event => {
      // Also reject negative values entered by mobile keyboards or other input methods.
      if (event.target.value.includes('-') || event.target.validity.badInput) {
        event.target.value = empty && value === 0 ? '' : String(value === 0 ? 0 : value);
        return;
      }
      setEmpty(event.target.value === '');
      onChange?.(event);
    }}
    onBlur={event => {
      setEmpty(false);
      onBlur?.(event);
    }} />;
}
