import { ButtonLink } from '@/components/ui';
import { LogoMark } from '@/components/navigation/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="size-10" />
      <div className="mt-6 font-serif text-6xl font-semibold text-brand-600">404</div>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted">The page you’re looking for doesn’t exist or is no longer available.</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/test-series" variant="secondary">Test series</ButtonLink>
      </div>
    </div>
  );
}
