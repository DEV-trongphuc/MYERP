export function format(dateInput: Date | string | number, pattern = 'dd/MM/yyyy HH:mm'): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return pattern
    .replace('yyyy', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('dd', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}
export function subDays(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
}
export function subHours(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() - amount);
  return d;
}
export function subMinutes(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - amount);
  return d;
}
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function startOfWeek(date: Date | number = new Date(), _options?: any): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function startOfMonth(date: Date | number = new Date()): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
