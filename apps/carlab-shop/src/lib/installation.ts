export type InstallablePart = {
  installation_price: number | null;
  no_installation: boolean;
  category?: { installation_price: number | null } | null;
};

export const installationPrice = ({
  installation_price,
  no_installation,
  category,
}: InstallablePart): number | null =>
  no_installation
    ? null
    : (installation_price ?? category?.installation_price ?? null);
