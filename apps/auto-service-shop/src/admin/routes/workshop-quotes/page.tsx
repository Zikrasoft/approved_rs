import { defineRouteConfig } from '@medusajs/admin-sdk';
import { DocumentText, Trash } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Select,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { vinSchema } from '@podbor/catalog-contract';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ScrollArea } from '../../components/scroll-area';
import { adminFetch } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { type Category, categoriesSchema } from '../../lib/categories';
import { labelledVehicleSchema, vehicleLabel } from '../../lib/vehicle-label';

const PDF_TYPE = 'application/pdf';
const MAX_QUOTE_BYTES = 10 * 1024 * 1024;
const NO_CATEGORY = 'none';

const draftSchema = z.object({
  draft: z.object({
    vin: z.string().nullable(),
    vehicle_text: z.string().nullable(),
    vehicle: labelledVehicleSchema.nullable(),
    lines: z.array(
      z.object({
        name: z.string(),
        number: z.string(),
        quantity: z.number(),
        brand: z.string().nullable(),
        brand_confidence: z.number(),
        brand_uncertain: z.boolean(),
        category: z.object({ id: z.string(), name: z.string() }).nullable(),
      }),
    ),
  }),
});

const confirmedSchema = z.object({
  confirmed: z.object({
    vehicle: labelledVehicleSchema.nullable(),
    lines: z.array(z.object({ part_id: z.string(), reused: z.boolean() })),
    fitments: z.number(),
  }),
});

type Draft = z.infer<typeof draftSchema>['draft'];
type DraftLine = Draft['lines'][number];
type Confirmed = z.infer<typeof confirmedSchema>['confirmed'];

type EditedLine = {
  key: number;
  name: string;
  number: string;
  quantity: string;
  brand: string;
  suggestion: DraftLine;
  category_id: string;
};

const toEdited = (line: DraftLine, key: number): EditedLine => ({
  key,
  name: line.name,
  number: line.number,
  quantity: String(line.quantity),
  brand: line.brand_uncertain ? '' : (line.brand ?? ''),
  suggestion: line,
  category_id: line.category?.id ?? NO_CATEGORY,
});

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
  const hintId = useId();
  const blockedId = useId();
  const [reading, setReading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lines, setLines] = useState<EditedLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  useEffect(() => {
    adminFetch('/admin/categories', categoriesSchema).then((data) => {
      if (data) setCategories(data.categories);
    });
  }, []);

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.type !== PDF_TYPE) {
      toast.error(t('workshopQuotes.wrongType', { name: file.name }));
      return;
    }
    if (file.size > MAX_QUOTE_BYTES) {
      toast.error(t('workshopQuotes.tooLarge', { name: file.name }));
      return;
    }
    setReading(true);
    const answer = await adminFetch(
      '/admin/workshop-quotes/draft',
      draftSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': PDF_TYPE },
        body: file,
      },
    );
    setReading(false);
    if (!answer) return;
    setFileName(file.name);
    setDraft(answer.draft);
    setLines(answer.draft.lines.map(toEdited));
    setConfirmed(null);
  };

  const edit = (key: number, fields: Partial<EditedLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...fields } : line)),
    );

  const remove = (key: number) =>
    setLines((current) => current.filter((line) => line.key !== key));

  const create = async () => {
    if (!draft) return;
    setCreating(true);
    const answer = await adminFetch('/admin/workshop-quotes', confirmedSchema, {
      method: 'POST',
      body: JSON.stringify({
        vin: vinSchema.safeParse(draft.vin).data ?? null,
        lines: lines.map((line) => ({
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
    setConfirmed(answer.confirmed);
    setDraft(null);
    setLines([]);
  };

  const uncertain = lines.filter(
    (line) => line.suggestion.brand_uncertain && !line.brand.trim(),
  );
  const ready = lines.length > 0 && lines.every(isReady);
  const percent = (value: number) =>
    value.toLocaleString(i18n.language, { style: 'percent' });
  const cellLabel = (column: string, line: EditedLine) =>
    t('workshopQuotes.cellLabel', {
      column: t(`workshopQuotes.columns.${column}`),
      number: line.number || line.suggestion.number,
    });

  return (
    <Container className="flex flex-col gap-y-4">
      <Heading level="h1">{t('workshopQuotes.heading')}</Heading>
      <Text className="text-ui-fg-subtle">{t('workshopQuotes.lead')}</Text>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          hidden
          accept={PDF_TYPE}
          onChange={(event) => upload(event.target.files?.[0])}
        />
        <Button
          size="small"
          variant={draft ? 'secondary' : 'primary'}
          aria-describedby={hintId}
          isLoading={reading}
          disabled={reading || creating}
          onClick={() => input.current?.click()}
        >
          {t(draft ? 'workshopQuotes.uploadAnother' : 'workshopQuotes.upload')}
        </Button>
        <Text id={hintId} size="small" className="text-ui-fg-subtle">
          {t(reading ? 'workshopQuotes.reading' : 'workshopQuotes.hint')}
        </Text>
      </div>
      {confirmed && (
        <section
          aria-labelledby="workshop-quote-result"
          className="flex flex-col gap-y-3 border-t border-ui-border-base pt-4"
        >
          <Heading level="h2" id="workshop-quote-result">
            {t('workshopQuotes.resultHeading', { name: fileName })}
          </Heading>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            <Term>{t('workshopQuotes.resultNew')}</Term>
            <dd>
              <Text size="small">
                {confirmed.lines.filter((line) => !line.reused).length}
              </Text>
            </dd>
            <Term>{t('workshopQuotes.resultReused')}</Term>
            <dd>
              <Text size="small">
                {confirmed.lines.filter((line) => line.reused).length}
              </Text>
            </dd>
            <Term>{t('workshopQuotes.resultFitments')}</Term>
            <dd>
              <Text size="small">
                {confirmed.vehicle
                  ? t('workshopQuotes.resultFitmentsOn', {
                      count: confirmed.fitments,
                      vehicle: vehicleLabel(t, confirmed.vehicle),
                    })
                  : confirmed.fitments}
              </Text>
            </dd>
          </dl>
          {!confirmed.vehicle && (
            <div className="flex flex-col items-start gap-y-1">
              <Badge size="2xsmall" color="orange">
                {t('workshopQuotes.noVehicle')}
              </Badge>
              <Text size="small" className="text-ui-fg-subtle">
                {t('workshopQuotes.resultNoVehicle')}
              </Text>
            </div>
          )}
        </section>
      )}
      {draft && (
        <section
          aria-labelledby="workshop-quote-draft"
          className="flex flex-col gap-y-4 border-t border-ui-border-base pt-4"
        >
          <div className="flex flex-col gap-y-1">
            <Heading level="h2" id="workshop-quote-draft">
              {t('workshopQuotes.draftHeading', { name: fileName })}
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
            <Term>{t('workshopQuotes.vehicle')}</Term>
            <dd>
              {draft.vehicle ? (
                <Text size="small">{vehicleLabel(t, draft.vehicle)}</Text>
              ) : (
                <div className="flex flex-col items-start gap-y-1">
                  <Badge size="2xsmall" color="orange">
                    {t('workshopQuotes.noVehicle')}
                  </Badge>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('workshopQuotes.noVehicleHint')}
                  </Text>
                </div>
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
              <ScrollArea>
                <Table>
                  <Table.Header>
                    <Table.Row>
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
                      <Table.HeaderCell>
                        <span className="sr-only">
                          {t('workshopQuotes.columns.actions')}
                        </span>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lines.map((line) => {
                      const { suggestion } = line;
                      const missingBrand = !line.brand.trim();
                      return (
                        <Table.Row key={line.key} className="align-top">
                          <Table.Cell className="min-w-48 py-2">
                            <Input
                              size="small"
                              value={line.name}
                              aria-label={cellLabel('name', line)}
                              aria-invalid={!line.name.trim()}
                              onChange={(event) =>
                                edit(line.key, { name: event.target.value })
                              }
                            />
                          </Table.Cell>
                          <Table.Cell className="min-w-36 py-2">
                            <Input
                              size="small"
                              className="font-mono"
                              value={line.number}
                              aria-label={cellLabel('number', line)}
                              aria-invalid={!line.number.trim()}
                              onChange={(event) =>
                                edit(line.key, { number: event.target.value })
                              }
                            />
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
                              aria-invalid={!hasQuantity(line)}
                              onChange={(event) =>
                                edit(line.key, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                          </Table.Cell>
                          <Table.Cell className="min-w-44 py-2">
                            <div className="flex flex-col items-start gap-y-1.5">
                              <Input
                                size="small"
                                value={line.brand}
                                placeholder={t(
                                  'workshopQuotes.brandPlaceholder',
                                )}
                                aria-label={cellLabel('brand', line)}
                                aria-invalid={missingBrand}
                                onChange={(event) =>
                                  edit(line.key, { brand: event.target.value })
                                }
                              />
                              {suggestion.brand_uncertain && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge size="2xsmall" color="orange">
                                    {t('workshopQuotes.checkBrand')}
                                  </Badge>
                                  {suggestion.brand && missingBrand && (
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
                              )}
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
                          <Table.Cell className="py-2">
                            <IconButton
                              size="small"
                              variant="transparent"
                              aria-label={t('workshopQuotes.removeLine', {
                                number: line.number || suggestion.number,
                              })}
                              onClick={() => remove(line.key)}
                            >
                              <Trash />
                            </IconButton>
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
                    {t('workshopQuotes.createBlocked')}
                  </Text>
                )}
                <Button
                  size="small"
                  isLoading={creating}
                  disabled={!ready || creating || reading}
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
