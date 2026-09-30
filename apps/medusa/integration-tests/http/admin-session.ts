import { Modules } from '@medusajs/framework/utils';
import { createUserAccountWorkflow } from '@medusajs/medusa/core-flows';

import { anotherClient } from './store-context';

const PASSWORD = 'supersecret-test-only';

type AuthService = {
  register(
    provider: string,
    data: { body: { email: string; password: string } },
  ): Promise<{ success: boolean; authIdentity?: { id: string } }>;
};

type Api = {
  post<T>(
    path: string,
    body: object,
    options?: object,
  ): Promise<{ data: T; status: number }>;
};

let admins = 0;

export async function adminHeaders(
  api: Api,
  getContainer: () => { resolve(key: string): unknown },
): Promise<{ authorization: string }> {
  const email = `admin-${(admins += 1)}-${Date.now()}@carlab.test`;
  const auth = getContainer().resolve(Modules.AUTH) as AuthService;
  const registered = await auth.register('emailpass', {
    body: { email, password: PASSWORD },
  });
  if (!registered.authIdentity) {
    throw new Error('The test admin could not be registered');
  }

  await createUserAccountWorkflow(getContainer() as never).run({
    input: {
      authIdentityId: registered.authIdentity.id,
      userData: { email },
    },
  });

  const { data } = await api.post<{ token: string }>(
    '/auth/user/emailpass',
    { email, password: PASSWORD },
    { headers: anotherClient() },
  );

  return { authorization: `Bearer ${data.token}` };
}
