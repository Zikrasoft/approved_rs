import { defineRouteConfig } from '@medusajs/admin-sdk';
import { MagnifierAlert } from '@medusajs/icons';
import { Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ListLoading, PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { acknowledged, adminFetch, useWriting } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';

const unresolvedCodeSchema = z.object({
  make: z.string(),
  code: z.string(),
  count: z.number(),
});

type UnresolvedCode = z.infer<typeof unresolvedCodeSchema>;

const codesSchema = z.object({ codes: z.array(unresolvedCodeSchema) });

const VinLookupsPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const writing = useWriting();
  const [codes, setCodes] = useState<UnresolvedCode[] | null>(null);

  const load = () =>
    adminFetch('/admin/vin-lookups/unresolved', codesSchema).then((data) => {
      if (data) setCodes(data.codes);
    });

  useEffect(() => {
    load();
  }, []);

  const dismiss = async ({ make, code }: UnresolvedCode) => {
    if (
      await confirmed({
        title: t('vinLookups.confirmDismissTitle', { code }),
        description: t('vinLookups.confirmDismissBody'),
        confirmText: t('vinLookups.dismiss'),
        done: t('vinLookups.dismissed', { code }),
        run: () =>
          adminFetch(
            `/admin/vin-lookups/unresolved/${encodeURIComponent(make)}/${encodeURIComponent(code)}`,
            acknowledged,
            { method: 'DELETE' },
          ),
      })
    ) {
      await load();
    }
  };

  return (
    <Container className="flex flex-col gap-y-4">
      <Heading level="h1">{t('vinLookups.heading')}</Heading>
      <Text className="text-ui-fg-subtle">{t('vinLookups.lead')}</Text>
      {codes === null ? (
        <ListLoading />
      ) : codes.length === 0 ? (
        <Text>{t('vinLookups.empty')}</Text>
      ) : (
        <ScrollArea pinnedEnd>
          <Table className={PINNED_ACTIONS}>
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
                <Table.HeaderCell />
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
                  <Table.Cell>
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={t('vinLookups.dismissCode', { code })}
                      disabled={writing}
                      onClick={() => dismiss({ make, code, count })}
                    >
                      {t('vinLookups.dismiss')}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </ScrollArea>
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
