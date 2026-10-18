import { Modules } from '@medusajs/framework/utils';
import type {
  IAuthModuleService,
  IUserModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';

type TestApiClient = {
  post: (path: string, body?: unknown) => Promise<{ data: { token: string } }>;
};

export const createAdminAuth = async (
  container: MedusaContainer,
  api: TestApiClient,
  email: string,
  password: string,
): Promise<{ headers: { authorization: string } }> => {
  const authModuleService: IAuthModuleService = container.resolve(Modules.AUTH);
  const userModuleService: IUserModuleService = container.resolve(Modules.USER);

  const { authIdentity } = await authModuleService.register('emailpass', {
    body: { email, password },
  });
  const user = await userModuleService.createUsers({ email });
  await authModuleService.updateAuthIdentities({
    id: authIdentity!.id,
    app_metadata: { user_id: user.id },
  });

  const loginResponse = await api.post('/auth/user/emailpass', {
    email,
    password,
  });

  return {
    headers: { authorization: `Bearer ${loginResponse.data.token}` },
  };
};
