import { defineRouteConfig } from '@medusajs/admin-sdk';
import { DocumentText } from '@medusajs/icons';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ScrollArea } from '../../components/scroll-area';
import { adminFetch } from '../../lib/admin-fetch';
import {
  type BrandOption,
  brandOptionsSchema,
  isNewBrand,
} from '../../lib/brand-options';
import { breadcrumb } from '../../lib/breadcrumb';
import { type Category, categoriesSchema } from '../../lib/categories';
import {
  type LabelledVehicle,
  labelledVehicleSchema,
  vehicleSpecLabel,
} from '../../lib/vehicle-label';

const PDF_TYPE = 'application/pdf';
const MAX_QUOTE_BYTES = 10 * 1024 * 1024;
const NO_CATEGORY = 'none';
const NO_CANDIDATE = 'none';
const NO_FITMENT = 'none';
const WHOLE_GENERATION = 'generation';

const draftSchema = z.object({
  draft: z.object({
    vin: z.string().nullable(),
    vehicle_text: z.string().nullable(),
    vehicle: labelledVehicleSchema.nullable(),
    generation: z.string().nullable(),
    candidates: z.array(labelledVehicleSchema),
    lines: z.array(
      z.object({
        readable: z.boolean(),
        catalogue_part: z.boolean(),
        original_name: z.string(),
        name: z.string(),
        printed_number: z.string(),
        number: z.string(),
        quantity: z.number().nullable(),
        brand: z.string().nullable(),
        brand_confidence: z.number(),
        brand_uncertain: z.boolean(),
        category: z.object({ id: z.string(), name: z.string() }).nullable(),
        part: z.object({ id: z.string(), name: z.string() }).nullable(),
        candidates: z.array(
          z.object({
            part_id: z.string(),
            name: z.string(),
            brand: z.string(),
            number: z.string(),
          }),
        ),
      }),
    ),
  }),
});

const confirmedSchema = z.object({
  confirmed: z.object({
    vehicles: z.array(labelledVehicleSchema),
    lines: z.array(z.object({ part_id: z.string(), reused: z.boolean() })),
    fitments: z.number(),
  }),
});

type Draft = z.infer<typeof draftSchema>['draft'];
type DraftLine = Draft['lines'][number];
type Confirmed = z.infer<typeof confirmedSchema>['confirmed'];

type EditedLine = {
  key: number;
  include: boolean;
  name: string;
  number: string;
  quantity: string;
  brand: string;
  candidate: string;
  suggestion: DraftLine;
  category_id: string;
};

type QuoteState = 'waiting' | 'reading' | 'ready' | 'failed' | 'created';

type Quote = {
  key: number;
  file: File;
  state: QuoteState;
  draft: Draft | null;
  lines: EditedLine[];
  fitment: string;
  confirmed: Confirmed | null;
};

const STATE_COLOR: Record<
  QuoteState,
  'grey' | 'blue' | 'orange' | 'red' | 'green'
> = {
  waiting: 'grey',
  reading: 'blue',
  ready: 'orange',
  failed: 'red',
  created: 'green',
};

const toEdited = (line: DraftLine, key: number): EditedLine => ({
  key,
  include: line.readable && line.catalogue_part,
  name: line.name,
  number: line.number,
  quantity: line.quantity === null ? '' : String(line.quantity),
  brand: line.brand_uncertain ? '' : (line.brand ?? ''),
  candidate: NO_CANDIDATE,
  suggestion: line,
  category_id: line.category?.id ?? NO_CATEGORY,
});

const vehicleChoice = (id: string) => `vehicle:${id}`;

const firstFitment = (draft: Draft) => {
  if (draft.vehicle) return vehicleChoice(draft.vehicle.id);
  return draft.candidates.length ? '' : NO_FITMENT;
};

const vehicleIdsOf = (draft: Draft, fitment: string): string[] => {
  if (fitment === WHOLE_GENERATION) return draft.candidates.map(({ id }) => id);
  return fitment.startsWith('vehicle:')
    ? [fitment.slice('vehicle:'.length)]
    : [];
};

const quantityOf = (line: EditedLine) => Number(line.quantity);

const hasQuantity = (line: EditedLine) =>
  Number.isInteger(quantityOf(line)) && quantityOf(line) > 0;

const isReady = (line: EditedLine) =>
  line.name.trim() !== '' &&
  line.number.trim() !== '' &&
  line.brand.trim() !== '' &&
  hasQuantity(line);

const Term = ({ children }: { children: ReactNode }) => (
  <dt>
    <Text size="small" weight="plus">
      {children}
    </Text>
  </dt>
);

const WorkshopQuotesPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const input = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const started = useRef(new Set<number>());
  const hintId = useId();
  const blockedId = useId();
  const fitmentId = useId();
  const brandListId = useId();
  const [creating, setCreating] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  useEffect(() => {
    adminFetch('/admin/categories', categoriesSchema).then((data) => {
      if (data) setCategories(data.categories);
    });
  }, []);

  const loadBrands = () =>
    adminFetch('/admin/brands', brandOptionsSchema).then((data) => {
      if (data) setBrands(data.brands);
    });

  useEffect(() => {
    loadBrands();
  }, []);

  const change = (key: number, fields: Partial<Quote>) =>
    setQuotes((current) =>
      current.map((quote) =>
        quote.key === key ? { ...quote, ...fields } : quote,
      ),
    );

  const reading = quotes.some(({ state }) => state === 'reading');
  const next = quotes.find(({ state }) => state === 'waiting');

  useEffect(() => {
    if (reading || !next || started.current.has(next.key)) return;
    started.current.add(next.key);
    change(next.key, { state: 'reading' });
    adminFetch('/admin/workshop-quotes/draft', draftSchema, {
      method: 'POST',
      headers: { 'Content-Type': PDF_TYPE },
      body: next.file,
    }).then((answer) => {
      if (!answer) {
        change(next.key, { state: 'failed' });
        return;
      }
      change(next.key, {
        state: 'ready',
        draft: answer.draft,
        lines: answer.draft.lines.map(toEdited),
        fitment: firstFitment(answer.draft),
      });
      setActiveKey((current) => current ?? next.key);
    });
  }, [reading, next]);

  const enqueue = (files: File[]) => {
    if (input.current) input.current.value = '';
    const accepted = files.filter((file) => {
      if (file.type !== PDF_TYPE) {
        toast.error(t('workshopQuotes.wrongType', { name: file.name }));
        return false;
      }
      if (file.size > MAX_QUOTE_BYTES) {
        toast.error(t('workshopQuotes.tooLarge', { name: file.name }));
        return false;
      }
      return true;
    });
    setQuotes((current) => [
      ...current,
      ...accepted.map((file) => ({
        key: nextKey.current++,
        file,
        state: 'waiting' as const,
        draft: null,
        lines: [],
        fitment: '',
        confirmed: null,
      })),
    ]);
  };

  const active = quotes.find(({ key }) => key === activeKey) ?? null;
  const draft = active?.state === 'ready' ? active.draft : null;
  const lines = active?.lines ?? [];

  const edit = (key: number, fields: Partial<EditedLine>) => {
    if (!active) return;
    change(active.key, {
      lines: lines.map((line) =>
        line.key === key ? { ...line, ...fields } : line,
      ),
    });
  };

  const pickCandidate = (line: EditedLine, partId: string) => {
    const candidate = line.suggestion.candidates.find(
      ({ part_id }) => part_id === partId,
    );
    edit(
      line.key,
      candidate
        ? {
            candidate: partId,
            brand: candidate.brand,
            number: candidate.number,
            name: candidate.name,
          }
        : { candidate: NO_CANDIDATE },
    );
  };

  const included = lines.filter((line) => line.include);
  const ready =
    included.length > 0 && included.every(isReady) && active?.fitment !== '';

  const create = async () => {
    if (!active || !draft) return;
    setCreating(true);
    const answer = await adminFetch('/admin/workshop-quotes', confirmedSchema, {
      method: 'POST',
      body: JSON.stringify({
        vehicle_ids: vehicleIdsOf(draft, active.fitment),
        generation: active.fitment === WHOLE_GENERATION,
        lines: included.map((line) => ({
          name: line.name.trim(),
          number: line.number.trim(),
          quantity: quantityOf(line),
          brand: line.brand.trim(),
          category_id:
            line.category_id === NO_CATEGORY ? null : line.category_id,
        })),
      }),
    });
    setCreating(false);
    if (!answer) return;
    toast.success(t('workshopQuotes.created'));
    change(active.key, { state: 'created', confirmed: answer.confirmed });
    loadBrands();
  };

  const uncertain = included.filter(
    (line) => line.suggestion.brand_uncertain && !line.brand.trim(),
  );
  const percent = (value: number) =>
    value.toLocaleString(i18n.language, { style: 'percent' });
  const cellLabel = (column: string, line: EditedLine) =>
    t('workshopQuotes.cellLabel', {
      column: t(`workshopQuotes.columns.${column}`),
      number: line.number || line.suggestion.printed_number,
    });
  const label = (vehicle: LabelledVehicle) => vehicleSpecLabel(t, vehicle);

  const chips = (line: EditedLine) => {
    const { suggestion } = line;
    const found: {
      key: string;
      color: 'green' | 'orange' | 'red' | 'grey' | 'blue';
      text: string;
    }[] = [];
    if (!suggestion.readable) {
      found.push({
        key: 'unreadable',
        color: 'red',
        text: t('workshopQuotes.status.unreadable'),
      });
    }
    if (!suggestion.catalogue_part) {
      found.push({
        key: 'notPart',
        color: 'grey',
        text: t('workshopQuotes.status.notPart'),
      });
    }
    if (suggestion.part) {
      found.push({
        key: 'inCatalogue',
        color: 'green',
        text: t('workshopQuotes.status.inCatalogue'),
      });
    }
    if (suggestion.candidates.length) {
      found.push({
        key: 'candidates',
        color: 'orange',
        text: t('workshopQuotes.status.candidates', {
          count: suggestion.candidates.length,
        }),
      });
    }
    if (
      suggestion.quantity !== null &&
      !Number.isInteger(suggestion.quantity)
    ) {
      found.push({
        key: 'fraction',
        color: 'orange',
        text: t('workshopQuotes.status.fraction'),
      });
    }
    return found;
  };

  return (
    <Container className="flex flex-col gap-y-4">
      <Heading level="h1">{t('workshopQuotes.heading')}</Heading>
      <Text className="text-ui-fg-subtle">{t('workshopQuotes.lead')}</Text>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={PDF_TYPE}
          onChange={(event) => enqueue([...(event.target.files ?? [])])}
        />
        <Button
          size="small"
          variant={quotes.length ? 'secondary' : 'primary'}
          aria-describedby={hintId}
          disabled={creating}
          onClick={() => input.current?.click()}
        >
          {t(
            quotes.length
              ? 'workshopQuotes.uploadAnother'
              : 'workshopQuotes.upload',
          )}
        </Button>
        <Text id={hintId} size="small" className="text-ui-fg-subtle">
          {t(reading ? 'workshopQuotes.reading' : 'workshopQuotes.hint')}
        </Text>
      </div>
      {quotes.length > 0 && (
        <section
          aria-labelledby="workshop-quote-queue"
          className="flex flex-col gap-y-2"
        >
          <Heading level="h2" id="workshop-quote-queue">
            {t('workshopQuotes.queueHeading', {
              done: quotes.filter(
                ({ state }) => state !== 'waiting' && state !== 'reading',
              ).length,
              count: quotes.length,
            })}
          </Heading>
          <ul className="flex flex-col divide-y divide-ui-border-base rounded-md border border-ui-border-base">
            {quotes.map((quote) => (
              <li
                key={quote.key}
                className={`flex flex-wrap items-center gap-3 px-3 py-2 ${quote.key === activeKey ? 'bg-ui-bg-subtle' : ''}`}
                aria-current={quote.key === activeKey ? 'true' : undefined}
              >
                <Text size="small" className="min-w-0 flex-1 truncate">
                  {quote.file.name}
                </Text>
                <Badge size="2xsmall" color={STATE_COLOR[quote.state]}>
                  {t(`workshopQuotes.state.${quote.state}`)}
                </Badge>
                {(quote.state === 'ready' || quote.state === 'created') &&
                  quote.key !== activeKey && (
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => setActiveKey(quote.key)}
                    >
                      {t('workshopQuotes.open', { name: quote.file.name })}
                    </Button>
                  )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {active?.confirmed && (
        <section
          aria-labelledby="workshop-quote-result"
          className="flex flex-col gap-y-3 border-t border-ui-border-base pt-4"
        >
          <Heading level="h2" id="workshop-quote-result">
            {t('workshopQuotes.resultHeading', { name: active.file.name })}
          </Heading>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <Term>{t('workshopQuotes.resultNew')}</Term>
            <dd>
              <Text size="small">
                {active.confirmed.lines.filter((line) => !line.reused).length}
              </Text>
            </dd>
            <Term>{t('workshopQuotes.resultReused')}</Term>
            <dd>
              <Text size="small">
                {active.confirmed.lines.filter((line) => line.reused).length}
              </Text>
            </dd>
            <Term>{t('workshopQuotes.resultFitments')}</Term>
            <dd>
              <Text size="small">
                {active.confirmed.vehicles.length === 1
                  ? t('workshopQuotes.resultFitmentsOn', {
                      count: active.confirmed.fitments,
                      vehicle: label(active.confirmed.vehicles[0]!),
                    })
                  : t('workshopQuotes.resultFitmentsOnMany', {
                      count: active.confirmed.fitments,
                      vehicles: active.confirmed.vehicles.length,
                    })}
              </Text>
            </dd>
          </dl>
          {active.confirmed.vehicles.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              {t('workshopQuotes.resultNoVehicle')}
            </Text>
          )}
        </section>
      )}
      {active && draft && (
        <section
          aria-labelledby="workshop-quote-draft"
          className="flex flex-col gap-y-4 border-t border-ui-border-base pt-4"
        >
          <div className="flex flex-col gap-y-1">
            <Heading level="h2" id="workshop-quote-draft">
              {t('workshopQuotes.draftHeading', { name: active.file.name })}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {t('workshopQuotes.draftNote')}
            </Text>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <Term>{t('workshopQuotes.vin')}</Term>
            <dd>
              <Text size="small" className="font-mono">
                {draft.vin ?? t('workshopQuotes.noVin')}
              </Text>
            </dd>
            <Term>{t('workshopQuotes.vehicleText')}</Term>
            <dd>
              <Text size="small">
                {draft.vehicle_text ?? t('workshopQuotes.noVehicleText')}
              </Text>
            </dd>
            <dt>
              <label htmlFor={fitmentId}>
                <Text size="small" weight="plus">
                  {t('workshopQuotes.vehicle')}
                </Text>
              </label>
            </dt>
            <dd className="flex max-w-xl flex-col items-start gap-y-1">
              <Select
                size="small"
                value={active.fitment}
                onValueChange={(fitment) => change(active.key, { fitment })}
              >
                <Select.Trigger
                  id={fitmentId}
                  aria-invalid={active.fitment === ''}
                >
                  <Select.Value placeholder={t('workshopQuotes.pickVehicle')} />
                </Select.Trigger>
                <Select.Content>
                  {[draft.vehicle, ...draft.candidates]
                    .filter(
                      (vehicle): vehicle is LabelledVehicle => vehicle !== null,
                    )
                    .map((vehicle) => (
                      <Select.Item
                        key={vehicle.id}
                        value={vehicleChoice(vehicle.id)}
                      >
                        {label(vehicle)}
                      </Select.Item>
                    ))}
                  {draft.candidates.length > 1 && (
                    <Select.Item value={WHOLE_GENERATION}>
                      {t('workshopQuotes.wholeGeneration', {
                        generation:
                          draft.generation ?? draft.vehicle_text ?? '',
                        count: draft.candidates.length,
                      })}
                    </Select.Item>
                  )}
                  <Select.Item value={NO_FITMENT}>
                    {t('workshopQuotes.noFitment')}
                  </Select.Item>
                </Select.Content>
              </Select>
              {!draft.vehicle && (
                <Text size="small" className="text-ui-fg-subtle">
                  {draft.candidates.length
                    ? t('workshopQuotes.candidatesHint', {
                        generation: draft.generation ?? '',
                        count: draft.candidates.length,
                      })
                    : t('workshopQuotes.noVehicleHint')}
                </Text>
              )}
            </dd>
          </dl>
          {lines.length === 0 ? (
            <Text>{t('workshopQuotes.noLines')}</Text>
          ) : (
            <>
              {uncertain.length > 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  {t('workshopQuotes.uncertainSummary', {
                    count: uncertain.length,
                  })}
                </Text>
              )}
              <datalist id={brandListId}>
                {brands.map(({ name }) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <ScrollArea>
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.include')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.name')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.number')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.quantity')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.brand')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('workshopQuotes.columns.category')}
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lines.map((line) => {
                      const { suggestion } = line;
                      const missingBrand = line.include && !line.brand.trim();
                      return (
                        <Table.Row
                          key={line.key}
                          className={`align-top ${line.include ? '' : 'opacity-60'}`}
                        >
                          <Table.Cell className="py-2">
                            <Checkbox
                              checked={line.include}
                              aria-label={cellLabel('include', line)}
                              onCheckedChange={(checked) =>
                                edit(line.key, { include: checked === true })
                              }
                            />
                          </Table.Cell>
                          <Table.Cell className="min-w-56 py-2">
                            <div className="flex flex-col items-start gap-y-1.5">
                              <Input
                                size="small"
                                value={line.name}
                                aria-label={cellLabel('name', line)}
                                aria-invalid={line.include && !line.name.trim()}
                                onChange={(event) =>
                                  edit(line.key, { name: event.target.value })
                                }
                              />
                              {suggestion.original_name &&
                                suggestion.original_name !== line.name && (
                                  <Text
                                    size="xsmall"
                                    className="text-ui-fg-subtle"
                                  >
                                    {t('workshopQuotes.printedName', {
                                      name: suggestion.original_name,
                                    })}
                                  </Text>
                                )}
                              <div className="flex flex-wrap gap-1">
                                {chips(line).map((chip) => (
                                  <Badge
                                    key={chip.key}
                                    size="2xsmall"
                                    color={chip.color}
                                  >
                                    {chip.text}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="min-w-36 py-2">
                            <div className="flex flex-col items-start gap-y-1.5">
                              <Input
                                size="small"
                                className="font-mono"
                                value={line.number}
                                aria-label={cellLabel('number', line)}
                                aria-invalid={
                                  line.include && !line.number.trim()
                                }
                                onChange={(event) =>
                                  edit(line.key, { number: event.target.value })
                                }
                              />
                              {suggestion.printed_number !== line.number && (
                                <Text
                                  size="xsmall"
                                  className="font-mono text-ui-fg-subtle"
                                >
                                  {t('workshopQuotes.printedNumber', {
                                    number: suggestion.printed_number,
                                  })}
                                </Text>
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell className="w-24 py-2">
                            <Input
                              size="small"
                              type="number"
                              min={1}
                              step={1}
                              inputMode="numeric"
                              value={line.quantity}
                              aria-label={cellLabel('quantity', line)}
                              aria-invalid={line.include && !hasQuantity(line)}
                              onChange={(event) =>
                                edit(line.key, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                          </Table.Cell>
                          <Table.Cell className="min-w-52 py-2">
                            <div className="flex flex-col items-start gap-y-1.5">
                              {suggestion.candidates.length > 0 && (
                                <Select
                                  size="small"
                                  value={line.candidate}
                                  onValueChange={(partId) =>
                                    pickCandidate(line, partId)
                                  }
                                >
                                  <Select.Trigger
                                    aria-label={cellLabel('candidate', line)}
                                  >
                                    <Select.Value />
                                  </Select.Trigger>
                                  <Select.Content>
                                    <Select.Item value={NO_CANDIDATE}>
                                      {t('workshopQuotes.noCandidate')}
                                    </Select.Item>
                                    {suggestion.candidates.map((candidate) => (
                                      <Select.Item
                                        key={candidate.part_id}
                                        value={candidate.part_id}
                                      >
                                        {t(
                                          'workshopQuotes.candidate',
                                          candidate,
                                        )}
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select>
                              )}
                              <Input
                                size="small"
                                value={line.brand}
                                list={brandListId}
                                placeholder={t(
                                  'workshopQuotes.brandPlaceholder',
                                )}
                                aria-label={cellLabel('brand', line)}
                                aria-invalid={missingBrand}
                                onChange={(event) =>
                                  edit(line.key, { brand: event.target.value })
                                }
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                {isNewBrand(line.brand, brands) && (
                                  <Badge size="2xsmall" color="blue">
                                    {t('workshopQuotes.newBrand')}
                                  </Badge>
                                )}
                                {suggestion.brand_uncertain && (
                                  <Badge size="2xsmall" color="orange">
                                    {t('workshopQuotes.checkBrand')}
                                  </Badge>
                                )}
                                {suggestion.brand_uncertain &&
                                  suggestion.brand &&
                                  !line.brand.trim() && (
                                    <Button
                                      size="small"
                                      variant="transparent"
                                      className="h-auto px-1 py-0"
                                      onClick={() =>
                                        edit(line.key, {
                                          brand: suggestion.brand ?? '',
                                        })
                                      }
                                    >
                                      {t('workshopQuotes.useSuggestion', {
                                        brand: suggestion.brand,
                                        confidence: percent(
                                          suggestion.brand_confidence,
                                        ),
                                      })}
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="min-w-44 py-2">
                            <Select
                              size="small"
                              value={line.category_id}
                              onValueChange={(next) =>
                                edit(line.key, { category_id: next })
                              }
                            >
                              <Select.Trigger
                                aria-label={cellLabel('category', line)}
                              >
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content>
                                <Select.Item value={NO_CATEGORY}>
                                  {t('workshopQuotes.noCategory')}
                                </Select.Item>
                                {categories.map((category) => (
                                  <Select.Item
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </ScrollArea>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!ready && (
                  <Text
                    id={blockedId}
                    size="small"
                    className="text-ui-fg-subtle"
                  >
                    {t(
                      active.fitment === ''
                        ? 'workshopQuotes.vehicleBlocked'
                        : 'workshopQuotes.createBlocked',
                    )}
                  </Text>
                )}
                <Button
                  size="small"
                  isLoading={creating}
                  disabled={!ready || creating}
                  aria-describedby={ready ? undefined : blockedId}
                  onClick={create}
                >
                  {t('workshopQuotes.create')}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.workshopQuotes',
  icon: DocumentText,
  rank: 11,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.workshopQuotes');

export default WorkshopQuotesPage;
