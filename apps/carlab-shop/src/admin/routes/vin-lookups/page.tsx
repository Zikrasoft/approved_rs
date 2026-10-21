import { defineRouteConfig } from '@medusajs/admin-sdk';
import { MagnifierAlert } from '@medusajs/icons';
import { Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';

const unresolvedCodeSchema = z.object({
  make: z.string(),
  code: z.string(),
  count: z.number(),
});

type UnresolvedCode = z.infer<typeof unresolvedCodeSchema>;

const codesSchema = z.object({ codes: z.array(unresolvedCodeSchema) });

const VinLookupsPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const [codes, setCodes] = useState<UnresolvedCode[]>([]);

  useEffect(() => {
    adminFetch('/admin/vin-lookups/unresolved', codesSchema).then((data) => {
      if (data) setCodes(data.codes);
    });
  }, []);

  return (
    <Container className="flex flex-col gap-y-4">
      <Heading level="h1">{t('vinLookups.heading')}</Heading>
      <Text className="text-ui-fg-subtle">{t('vinLookups.lead')}</Text>
      {codes.length === 0 ? (
        <Text>{t('vinLookups.empty')}</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                {t('vinLookups.columns.make')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('vinLookups.columns.code')}
              </Table.HeaderCell>
              <Table.HeaderCell>
                {t('vinLookups.columns.count')}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {codes.map(({ make, code, count }) => (
              <Table.Row key={`${make}-${code}`}>
                <Table.Cell>
                  {t(`vinLookups.makes.${make}`, { defaultValue: make })}
                </Table.Cell>
                <Table.Cell>{code}</Table.Cell>
                <Table.Cell>{count.toLocaleString(i18n.language)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.vinLookups',
  icon: MagnifierAlert,
  rank: 8,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.vinLookups');

export default VinLookupsPage;
