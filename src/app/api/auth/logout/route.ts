import { route, ok } from '@/lib/server/http';
import { signOut } from '@/lib/server/auth';

export const POST = route(async () => {
  await signOut({ redirect: false });
  return ok({ loggedOut: true });
});
