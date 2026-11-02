import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChartBar } from '@medusajs/icons';
import { Container, Heading, Select, Table, Text } from '@medusajs/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  DEMAND_REPORT_DAYS,
  DEMAND_WEIGHTS,
} from '../../../modules/demand/ranking';
import { ListLoading } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { adminFetch } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';

const tally = {
  orders: z.number(),
  inquiries: z.number(),
  picks: z.number(),
  score: z.number(),
};

const reportSchema = z.object({
  parts: z.array(
    z.object({
      id: z.string(),
      brand: z.string(),
      number: z.string(),
      name: z.string(),
      category: z.string().nullable(),
      ...tally,
    }),
  ),
  categories: z.array(z.object({ name: z.string(), ...tally })),
  cars: z.array(
    z.object({
      make: z.string(),
      series: z.string(),
      model: z.string(),
      score: z.number(),
    }),
  ),
  missed_queries: z.array(z.object({ query: z.string(), count: z.number() })),
});

type Report = z.infer<typeof reportSchema>;

type Column<Row> = {
  label: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
};

const DemandTable = <Row,>({
  heading,
  rows,
  columns,
  rowKey,
}: {
  heading: string;
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
}) => {
  const { t } = useTranslation('carlabAdmin');
  return (
    <section className="flex flex-col gap-y-2">
      <Heading level="h2">{heading}</Heading>
      {rows.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          {t('demand.empty')}
        </Text>
      ) : (
        <ScrollArea>
          <Table>
            <Table.Header>
              <Table.Row>
                {columns.map(({ label }) => (
                  <Table.HeaderCell key={label}>{label}</Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={rowKey(row)}>
                  {columns.map(({ label, cell, numeric }) => (
                    <Table.Cell
                      key={label}
                      className={numeric ? 'tabular-nums' : undefined}
                    >
                      {cell(row)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </ScrollArea>
      )}
    </section>
  );
};

const DemandPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [days, setDays] = useState<string>('30');
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    setReport(null);
    adminFetch(`/admin/demand?days=${days}`, reportSchema).then((data) => {
      if (data) setReport(data);
    });
  }, [days]);

  const counts = <
    Row extends z.infer<z.ZodObject<typeof tally>>,
  >(): Column<Row>[] => [
    {
      label: t('demand.columns.orders'),
      cell: (row) => row.orders,
      numeric: true,
    },
    {
      label: t('demand.columns.inquiries'),
      cell: (row) => row.inquiries,
      numeric: true,
    },
    {
      label: t('demand.columns.picks'),
      cell: (row) => row.picks,
      numeric: true,
    },
    {
      label: t('demand.columns.score'),
      cell: (row) => row.score,
      numeric: true,
    },
  ];

  return (
    <Container className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h1">{t('demand.heading')}</Heading>
          <Text className="text-ui-fg-subtle max-w-2xl">
            {t('demand.lead', DEMAND_WEIGHTS)}
          </Text>
        </div>
        <Select value={days} onValueChange={setDays}>
          <Select.Trigger className="w-40" aria-label={t('demand.period')}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {DEMAND_REPORT_DAYS.map((option) => (
              <Select.Item key={option} value={String(option)}>
                {t('demand.days', { count: option })}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      {report === null ? (
        <ListLoading />
      ) : (
        <>
          <DemandTable
            heading={t('demand.parts')}
            rows={report.parts}
            rowKey={({ id }) => id}
            columns={[
              {
                label: t('demand.columns.part'),
                cell: ({ brand, number, name }) => (
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {brand} {number}
                    </span>
                    <span className="text-ui-fg-subtle">{name}</span>
                  </span>
                ),
              },
              {
                label: t('demand.columns.category'),
                cell: ({ category }) => category ?? '',
              },
              ...counts<Report['parts'][number]>(),
            ]}
          />
          <DemandTable
            heading={t('demand.categories')}
            rows={report.categories}
            rowKey={({ name }) => name}
            columns={[
              { label: t('demand.columns.category'), cell: ({ name }) => name },
              ...counts<Report['categories'][number]>(),
            ]}
          />
          <DemandTable
            heading={t('demand.cars')}
            rows={report.cars}
            rowKey={({ make, series, model }) => `${make}|${series}|${model}`}
            columns={[
              {
                label: t('demand.columns.car'),
                cell: ({ make, series, model }) =>
                  `${make} ${series}, ${model}`,
              },
              {
                label: t('demand.columns.score'),
                cell: ({ score }) => score,
                numeric: true,
              },
            ]}
          />
          <DemandTable
            heading={t('demand.missedQueries')}
            rows={report.missed_queries}
            rowKey={({ query }) => query}
            columns={[
              { label: t('demand.columns.query'), cell: ({ query }) => query },
              {
                label: t('demand.columns.searches'),
                cell: ({ count }) => count,
                numeric: true,
              },
            ]}
          />
        </>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.demand',
  icon: ChartBar,
  rank: 12,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.demand');

export default DemandPage;
