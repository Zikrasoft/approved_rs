import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Adjustments,
  EllipsisHorizontal,
  Link as LinkIcon,
  Wrench,
} from '@medusajs/icons';
import {
  Container,
  DropdownMenu,
  IconButton,
  Input,
  Select,
  Table,
  Tabs,
  Text,
} from '@medusajs/ui';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import {
  EnrichmentStatus,
  partIdentifiersSchema,
} from '../../components/enrichment';
import { LIST_TABLE, ListEmpty, ListHeader } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { adminFetch } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';

const PAGE_SIZE = 50;
const ALL = 'all';
const STATES = [ALL, 'true', 'false'] as const;

type Listing = z.infer<typeof partIdentifiersSchema>;

const categoriesSchema = z.object({
  categories: z.array(z.object({ id: z.string(), name: z.string() })),
});

const fixLink = (page: string, partId: string, number: string) =>
  `/${page}?${new URLSearchParams({ part: partId, q: number })}`;

const PartsPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [params, setParams] = useSearchParams();
  const state = STATES.find((value) => value === params.get('enriched')) ?? ALL;
  const q = params.get('q') ?? '';
  const categoryId = params.get('category') ?? ALL;
  const pageIndex = Math.max(0, Number(params.get('page')) || 0);

  const [query, setQuery] = useState(q);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [categories, setCategories] = useState<
    z.infer<typeof categoriesSchema>['categories']
  >([]);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ page: '', ...changes })) {
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    adminFetch('/admin/categories', categoriesSchema).then((data) => {
      if (data) setCategories(data.categories);
    });
  }, []);

  const loaded = listing !== null;
  useEffect(() => {
    tabsRef.current
      ?.querySelector('[role="tab"][data-state="active"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [loaded]);

  useEffect(() => {
    const search = new URLSearchParams({
      offset: String(pageIndex * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    });
    if (state !== ALL) search.set('enriched', state);
    if (q) search.set('q', q);
    if (categoryId !== ALL) search.set('category_id', categoryId);
    adminFetch(`/admin/part-identifiers?${search}`, partIdentifiersSchema).then(
      (data) => data && setListing(data),
    );
  }, [state, q, categoryId, pageIndex]);

  const counts = listing && {
    [ALL]: listing.counts.enriched + listing.counts.not_enriched,
    true: listing.counts.enriched,
    false: listing.counts.not_enriched,
  };
  const pageCount = Math.max(1, Math.ceil((listing?.count ?? 0) / PAGE_SIZE));

  return (
    <Container className="divide-y overflow-hidden p-0">
      <ListHeader
        heading={t('parts.heading')}
        level="h1"
        lead={t('parts.lead')}
      >
        <div className="flex flex-col gap-3">
          <div ref={tabsRef}>
            <ScrollArea>
              <Tabs
                value={state}
                onValueChange={(next) => update({ enriched: next })}
              >
                <Tabs.List
                  aria-label={t('parts.filterLabel')}
                  className="w-max p-0.5"
                >
                  {STATES.map((value) => (
                    <Tabs.Trigger
                      key={value}
                      value={value}
                      className="gap-x-1.5 whitespace-nowrap"
                    >
                      {t(`parts.filters.${value}`)}
                      <span className="text-ui-fg-muted inline-block min-w-[1ch] tabular-nums">
                        {counts?.[value]}
                      </span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Tabs>
            </ScrollArea>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: query.trim() });
            }}
          >
            <Input
              type="search"
              className="sm:w-80"
              aria-label={t('parts.searchLabel')}
              placeholder={t('parts.searchPlaceholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value) update({ q: '' });
              }}
            />
            <div className="sm:w-64">
              <Select
                value={categoryId}
                onValueChange={(next) => update({ category: next })}
              >
                <Select.Trigger aria-label={t('parts.categoryLabel')}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL}>
                    {t('parts.allCategories')}
                  </Select.Item>
                  {categories.map((category) => (
                    <Select.Item key={category.id} value={category.id}>
                      {category.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </form>
        </div>
      </ListHeader>
      {listing?.part_identifiers.length ? (
        <>
          <ScrollArea>
            <Table className={LIST_TABLE}>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>
                    {t('parts.columns.number')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('parts.columns.status')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('parts.columns.category')}
                  </Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    {t('parts.columns.photos')}
                  </Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    {t('parts.columns.offers')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {listing.part_identifiers.map((row) => {
                  const number = `${row.brand.name} ${row.value}`;
                  return (
                    <Table.Row
                      key={row.id}
                      className="[&_td]:py-3 [&_td]:align-top"
                    >
                      <Table.Cell className="max-w-[18rem] whitespace-normal">
                        <div className="flex flex-col">
                          <Text
                            size="small"
                            weight="plus"
                            className="whitespace-nowrap"
                          >
                            {number}
                          </Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            {row.part.name}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <EnrichmentStatus {...row} />
                      </Table.Cell>
                      <Table.Cell className="whitespace-normal">
                        {row.category?.name ?? (
                          <span className="text-ui-fg-muted">
                            {t('parts.noCategory')}
                          </span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {row.photos}
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {row.offers}
                      </Table.Cell>
                      <Table.Cell>
                        <EditedBy row={row} />
                      </Table.Cell>
                      <Table.Cell>
                        <DropdownMenu>
                          <DropdownMenu.Trigger asChild>
                            <IconButton
                              size="small"
                              variant="transparent"
                              aria-label={t('common.actionsFor', {
                                name: number,
                              })}
                            >
                              <EllipsisHorizontal />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Item className="gap-x-2" asChild>
                              <Link
                                to={fixLink(
                                  'part-attributes',
                                  row.part.id,
                                  row.value,
                                )}
                              >
                                <Adjustments className="text-ui-fg-subtle" />
                                {t('parts.fix.attributes')}
                              </Link>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="gap-x-2" asChild>
                              <Link
                                to={fixLink('fitments', row.part.id, row.value)}
                              >
                                <LinkIcon className="text-ui-fg-subtle" />
                                {t('parts.fix.fitments')}
                              </Link>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </ScrollArea>
          <Table.Pagination
            count={listing.count}
            pageSize={PAGE_SIZE}
            pageIndex={pageIndex}
            pageCount={pageCount}
            canPreviousPage={pageIndex > 0}
            canNextPage={pageIndex + 1 < pageCount}
            previousPage={() => update({ page: String(pageIndex - 1) })}
            nextPage={() => update({ page: String(pageIndex + 1) })}
            translations={{
              of: t('parts.pagination.of'),
              results: t('parts.pagination.results'),
              pages: t('parts.pagination.pages'),
              prev: t('parts.pagination.prev'),
              next: t('parts.pagination.next'),
            }}
          />
        </>
      ) : (
        listing && <ListEmpty hint={t('parts.emptyHint')} />
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.parts',
  icon: Wrench,
  rank: 0,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.parts');

export default PartsPage;
