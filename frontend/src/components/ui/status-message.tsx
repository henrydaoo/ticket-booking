type StatusMessageProps = {
  children: React.ReactNode;
};

export function StatusMessage({ children }: StatusMessageProps) {
  return <p role="status">{children}</p>;
}
