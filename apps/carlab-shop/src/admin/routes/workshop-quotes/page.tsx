import { defineRouteConfig } from '@medusajs/admin-sdk';
import { DocumentText } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { type ReactNode, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ScrollArea } from '../../components/scroll-area';
import { adminFetch } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { labelledVehicleSchema, vehicleLabel } from '../../lib/vehicle-label';

const PDF_TYPE = 'application/pdf';
const MAX_QUOTE_BYTES = 10 * 1024 * 1024;

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

type Draft = z.infer<typeof draftSchema>['draft'];

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
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

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
  };

  const uncertain = draft?.lines.filter((line) => line.brand_uncertain) ?? [];
  const percent = (value: number) =>
    value.toLocaleString(i18n.language, { style: 'percent' });

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
          aria-describedby={hintId}
          isLoading={reading}
          disabled={reading}
          onClick={() => input.current?.click()}
        >
          {t(draft ? 'workshopQuotes.uploadAnother' : 'workshopQuotes.upload')}
        </Button>
        <Text id={hintId} size="small" className="text-ui-fg-subtle">
          {t(reading ? 'workshopQuotes.reading' : 'workshopQuotes.hint')}
        </Text>
      </div>
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
          {draft.lines.length === 0 ? (
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
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {draft.lines.map((line, index) => (
                      <Table.Row key={`${line.number}-${index}`}>
                        <Table.Cell>{line.name}</Table.Cell>
                        <Table.Cell className="font-mono">
                          {line.number}
                        </Table.Cell>
                        <Table.Cell>
                          {line.quantity.toLocaleString(i18n.language)}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {line.brand ?? t('workshopQuotes.noBrand')}
                            </span>
                            {line.brand && (
                              <Text
                                as="span"
                                size="xsmall"
                                className="text-ui-fg-subtle"
                              >
                                {percent(line.brand_confidence)}
                              </Text>
                            )}
                            {line.brand_uncertain && (
                              <Badge size="2xsmall" color="orange">
                                {t('workshopQuotes.checkBrand')}
                              </Badge>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell
                          className={
                            line.category ? undefined : 'text-ui-fg-subtle'
                          }
                        >
                          {line.category?.name ??
                            t('workshopQuotes.noCategory')}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </ScrollArea>
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
