import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type UnresolvedCode = { make: string; code: string; count: number };

const VinLookupsPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [codes, setCodes] = useState<UnresolvedCode[]>([]);

  useEffect(() => {
    adminFetch<{ codes: UnresolvedCode[] }>(
      '/admin/vin-lookups/unresolved',
    ).then((data) => {
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
                <Table.Cell>{make}</Table.Cell>
                <Table.Cell>{code}</Table.Cell>
                <Table.Cell>{count}</Table.Cell>
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
  translationNs: 'carlabAdmin',
});

export default VinLookupsPage;
