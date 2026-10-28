import { defineRouteConfig } from '@medusajs/admin-sdk';
import { MagnifierAlert } from '@medusajs/icons';
import {
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STEERING_SIDES, VEHICLE_DRIVES } from '@podbor/catalog-contract';
import { z } from 'zod';

import {
  LINKABLE_CODE_TYPES,
  MAX_LINKED_VEHICLES,
} from '../../../lib/vin/linkable';
import { DrawerHeader } from '../../components/dialog-header';
import { ListLoading, PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { acknowledged, adminFetch, useWriting } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';
import {
  labelledVehicleSchema,
  type TFunction,
  vehicleLabel,
} from '../../lib/vehicle-label';

const SHOWN_VEHICLES = 100;

const referenceSchema = z.object({
  chassis: z.string(),
  model: z.string(),
  body: z.string().nullable(),
  engine: z.string().nullable(),
  power_kw: z.number().nullable(),
  drivetrain: z.enum(VEHICLE_DRIVES).nullable(),
  steering: z.enum(STEERING_SIDES),
  from: z.string().nullable(),
  to: z.string().nullable(),
});

type Reference = z.infer<typeof referenceSchema>;

const unresolvedCodeSchema = z.object({
  make: z.string(),
  code: z.string(),
  count: z.number(),
  last_seen: z.string(),
  reference: referenceSchema.nullable(),
});

type UnresolvedCode = z.infer<typeof unresolvedCodeSchema>;

const codesSchema = z.object({ codes: z.array(unresolvedCodeSchema) });

const linkableVehicleSchema = labelledVehicleSchema.extend({
  model: labelledVehicleSchema.shape.model.extend({
    chassis: z.object({
      code: z.string(),
      series: z.object({
        name: z.string(),
        make: z.object({ slug: z.string(), name: z.string() }),
      }),
    }),
  }),
});

type LinkableVehicle = z.infer<typeof linkableVehicleSchema>;

const vehiclesSchema = z.object({
  vehicles: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const vehicle = linkableVehicleSchema.safeParse(row);
      return vehicle.success ? [vehicle.data] : [];
    }),
  ),
});

const linkedSchema = z.object({ linked: z.number() });

const referenceYears = (t: TFunction, { from, to }: Reference) => {
  if (from && to) return t('vehicleLabel.between', { from, to });
  if (from) return t('vehicleLabel.since', { from });
  return to ? t('vehicleLabel.until', { to }) : null;
};

const referenceLine = (t: TFunction, reference: Reference) =>
  [
    [reference.chassis, reference.model, reference.body]
      .filter(Boolean)
      .join(' '),
    reference.engine,
    reference.power_kw && t('vehicleLabel.kw', { kw: reference.power_kw }),
    reference.drivetrain && t(`vehicles.values.drive.${reference.drivetrain}`),
    t(`vehicleLabel.steering.${reference.steering}`),
    referenceYears(t, reference),
  ]
    .filter(Boolean)
    .join(', ');

const LinkDrawer = ({
  entry,
  onClose,
  onLinked,
}: {
  entry: UnresolvedCode | null;
  onClose: () => void;
  onLinked: () => Promise<void>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const [vehicles, setVehicles] = useState<LinkableVehicle[] | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setQuery(entry.reference?.chassis ?? '');
    setChosen(new Set());
    adminFetch('/admin/vehicles', vehiclesSchema).then((data) => {
      if (data) setVehicles(data.vehicles);
    });
  }, [entry]);

  const labelled = (vehicles ?? [])
    .filter(({ model }) => model.chassis.series.make.slug === entry?.make)
    .map((vehicle) => ({ id: vehicle.id, label: vehicleLabel(t, vehicle) }));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = labelled.filter(
    ({ id, label }) =>
      chosen.has(id) ||
      words.every((word) => label.toLowerCase().includes(word)),
  );

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const link = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    setSaving(true);
    const linked = await adminFetch(
      `/admin/vin-lookups/unresolved/${encodeURIComponent(entry.make)}/${encodeURIComponent(entry.code)}`,
      linkedSchema,
      {
        method: 'POST',
        body: JSON.stringify({ vehicle_ids: [...chosen] }),
      },
    );
    setSaving(false);
    if (linked) {
      toast.success(
        t('vinLookups.link.linked', {
          code: entry.code,
          count: chosen.size,
        }),
      );
      onClose();
      await onLinked();
    }
  };

  return (
    <Drawer open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <form onSubmit={link} className="flex flex-1 flex-col overflow-hidden">
          <DrawerHeader>
            <Drawer.Title asChild>
              <Heading>
                {t('vinLookups.link.title', { code: entry?.code })}
              </Heading>
            </Drawer.Title>
            <Drawer.Description className="txt-small text-ui-fg-subtle">
              {entry?.reference
                ? t('vinLookups.link.openData', {
                    facts: referenceLine(t, entry.reference),
                  })
                : t('vinLookups.link.noOpenData')}
            </Drawer.Description>
          </DrawerHeader>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            <Text size="small" className="text-ui-fg-subtle">
              {t('vinLookups.link.hint')}
            </Text>
            <Label size="small" weight="plus" className="flex flex-col gap-y-2">
              {t('vinLookups.link.search')}
              <Input
                type="search"
                value={query}
                placeholder={t('vinLookups.link.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Label>
            {vehicles === null ? (
              <ListLoading />
            ) : matching.length === 0 ? (
              <Text size="small">{t('vinLookups.link.noVehicles')}</Text>
            ) : (
              <ul className="flex flex-col gap-y-1">
                {matching.slice(0, SHOWN_VEHICLES).map(({ id, label }) => (
                  <li key={id}>
                    <Label
                      size="small"
                      className="hover:bg-ui-bg-base-hover flex cursor-pointer items-start gap-x-3 rounded-md px-2 py-1.5"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={chosen.has(id)}
                        disabled={
                          !chosen.has(id) && chosen.size >= MAX_LINKED_VEHICLES
                        }
                        onCheckedChange={() => toggle(id)}
                      />
                      <span>{label}</span>
                    </Label>
                  </li>
                ))}
              </ul>
            )}
            {matching.length > SHOWN_VEHICLES && (
              <Text size="small" className="text-ui-fg-subtle">
                {t('vinLookups.link.more', {
                  count: matching.length - SHOWN_VEHICLES,
                })}
              </Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={saving}>
                {t('vehicles.cancel')}
              </Button>
            </Drawer.Close>
            <Button
              size="small"
              type="submit"
              isLoading={saving}
              disabled={writing || chosen.size === 0}
            >
              {t('vinLookups.link.save', { count: chosen.size })}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

const VinLookupsPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const writing = useWriting();
  const [codes, setCodes] = useState<UnresolvedCode[] | null>(null);
  const [linking, setLinking] = useState<UnresolvedCode | null>(null);

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
                  {t('vinLookups.columns.openData')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('vinLookups.columns.count')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('vinLookups.columns.lastSeen')}
                </Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {codes.map((entry) => (
                <Table.Row key={`${entry.make}-${entry.code}`}>
                  <Table.Cell>
                    {t(`vinLookups.makes.${entry.make}`, {
                      defaultValue: entry.make,
                    })}
                  </Table.Cell>
                  <Table.Cell className="font-medium">{entry.code}</Table.Cell>
                  <Table.Cell className="max-w-[18rem] whitespace-normal break-words">
                    {entry.reference ? (
                      referenceLine(t, entry.reference)
                    ) : (
                      <span className="text-ui-fg-muted">
                        {t('vinLookups.notInOpenData')}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="tabular-nums">
                    {entry.count.toLocaleString(i18n.language)}
                  </Table.Cell>
                  <Table.Cell className="tabular-nums">
                    {new Date(entry.last_seen).toLocaleDateString(
                      i18n.language,
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center justify-end gap-x-2">
                      {LINKABLE_CODE_TYPES[entry.make] && (
                        <Button
                          size="small"
                          variant="secondary"
                          aria-label={t('vinLookups.link.action', {
                            code: entry.code,
                          })}
                          disabled={writing}
                          onClick={() => setLinking(entry)}
                        >
                          {t('vinLookups.link.button')}
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="transparent"
                        aria-label={t('vinLookups.dismissCode', {
                          code: entry.code,
                        })}
                        disabled={writing}
                        onClick={() => dismiss(entry)}
                      >
                        {t('vinLookups.dismiss')}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </ScrollArea>
      )}
      <LinkDrawer
        entry={linking}
        onClose={() => setLinking(null)}
        onLinked={load}
      />
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
