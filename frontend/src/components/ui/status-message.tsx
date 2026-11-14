type StatusMessageProps = {
  children: React.ReactNode;
};

export function StatusMessage({ children }: StatusMessageProps) {
  return <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400" role="status">{children}</p>;
}
