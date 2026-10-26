import { Input } from './Input'

export function DatePicker(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="date" {...props} />
}
