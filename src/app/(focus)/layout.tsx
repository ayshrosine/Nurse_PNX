// Distraction-free layout for the test-taking screen: no site header/footer.
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh bg-paper">{children}</main>;
}
