type StatusMessageProps = {
  children: React.ReactNode;
};

export function StatusMessage({ children }: StatusMessageProps) {
  return <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400" role="status">{children}</p>;
}
