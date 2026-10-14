import type { SelectHTMLAttributes } from 'react';
const times = Array.from({length:48}, (_, i) => String(Math.floor(i/2)).padStart(2,'0') + ':' + (i%2 ? '30' : '00'));
export function TimeSelect({value, ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
 const selected = typeof value === 'string' ? value : '';
 const options = selected && !times.includes(selected) ? [...times,selected].sort() : times;
 return <select {...props} value={selected}><option value="">เลือกเวลา</option>{options.map(t=><option key={t} value={t}>{t}</option>)}</select>;
}
