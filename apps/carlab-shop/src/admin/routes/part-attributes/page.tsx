import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Adjustments } from '@medusajs/icons';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { PartEnrichment } from '../../components/enrichment';
import {
  adminImageSchema,
  type AdminImage,
  ImageUploads,
  uploadImage,
} from '../../components/image-uploads';
import { TranslationsDrawer } from '../../components/translations-drawer';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import {
  type Category,
  categoriesSchema,
  type CategoryField,
} from '../../lib/categories';

const attributeValueSchema = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.array(z.string()),
]);

type AttributeValue = z.infer<typeof attributeValueSchema>;

const partSchema = editedBySchema.extend({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.string().nullable(),
  attributes: z.record(z.string(), attributeValueSchema),
  installation_price: z.number().nullable(),
  no_installation: z.boolean(),
  identifiers: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
      brand: z.object({ name: z.string() }),
      images: z.array(adminImageSchema),
    }),
  ),
});

type Part = z.infer<typeof partSchema>;
type Identifier = Part['identifiers'][number];

const imagesSchema = z.object({ images: z.array(adminImageSchema) });
const partsSchema = z.object({ parts: z.array(partSchema) });

const partLabel = (part: Part) =>
  `${part.name} (${part.identifiers
    .map((identifier) => `${identifier.brand.name} ${identifier.value}`)
    .join(', ')})`;

const numberLabel = ({ brand, value }: Identifier) => `${brand.name} ${value}`;

const INSTALLATION_MODES = ['inherit', 'price', 'free', 'none'] as const;
type InstallationMode = (typeof INSTALLATION_MODES)[number];

const installationMode = (part: Part): InstallationMode =>
  part.no_installation
    ? 'none'
    : part.installation_price === null
      ? 'inherit'
      : part.installation_price === 0
        ? 'free'
        : 'price';

const installationBody = (mode: InstallationMode, price: string) => ({
  no_installation: mode === 'none',
  installation_price:
    mode === 'free' ? 0 : mode === 'price' ? Number(price) : null,
});

const ValueInput = ({
  field,
  label,
  value,
  onChange,
}: {
  field: CategoryField;
  label: string;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue | undefined) => void;
}) => {
  const { t } = useTranslation('carlabAdmin');

  switch (field.type) {
    case 'number':
      return (
        <Input
          aria-label={label}
          type="number"
          step="any"
          min={0}
          value={value === undefined ? '' : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ''
                ? undefined
                : Number(event.target.value),
            )
          }
        />
      );
    case 'text':
      return (
        <Input
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    case 'boolean':
      return (
        <Select
          value={value === undefined ? '' : String(value)}
          onValueChange={(next) => onChange(next === 'true')}
        >
          <Select.Trigger aria-label={label}>
            <Select.Value placeholder={t('partAttributes.notSet')} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="true">{t('partAttributes.yes')}</Select.Item>
            <Select.Item value="false">{t('partAttributes.no')}</Select.Item>
          </Select.Content>
        </Select>
      );
    case 'single-select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
        >
          <Select.Trigger aria-label={label}>
            <Select.Value placeholder={t('partAttributes.notSet')} />
          </Select.Trigger>
          <Select.Content>
            {field.options.map((option) => (
              <Select.Item key={option.key} value={option.key}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      );
    case 'multi-select': {
      const keys = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-3">
          {field.options.map((option) => (
            <Label key={option.key} className="flex items-center gap-x-2">
              <Checkbox
                checked={keys.includes(option.key)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...keys, option.key]
                    : keys.filter((key) => key !== option.key);
                  onChange(next.length ? next : undefined);
                }}
              />
              {option.label}
            </Label>
          ))}
        </div>
      );
    }
  }
};

const PartAttributesPage = () => {
  const writing = useWriting();
  const { t, i18n } = useTranslation('carlabAdmin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [part, setPart] = useState<Part | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [identifierId, setIdentifierId] = useState('');
  const [values, setValues] = useState<Record<string, AttributeValue>>({});
  const [description, setDescription] = useState('');
  const [installMode, setInstallMode] = useState<InstallationMode>('inherit');
  const [installPrice, setInstallPrice] = useState('');
  const [saves, setSaves] = useState(0);
  const [params] = useSearchParams();

  const search = async (text = query) => {
    const data = await adminFetch(
      `/admin/parts?q=${encodeURIComponent(text)}`,
      partsSchema,
    );
    if (data) setParts(data.parts);
    return data?.parts ?? [];
  };

  useEffect(() => {
    adminFetch('/admin/categories', categoriesSchema).then((data) => {
      if (data) setCategories(data.categories);
    });
    const linked = params.get('part');
    const text = params.get('q');
    if (linked && text) {
      setQuery(text);
      search(text).then((found) => {
        const match = found.find(({ id }) => id === linked);
        if (match) choose(match);
      });
    }
  }, []);

  const choose = (chosen: Part) => {
    setPart(chosen);
    setIdentifierId(chosen.identifiers[0]?.id ?? '');
    setCategoryId(chosen.category_id ?? '');
    setValues(chosen.attributes);
    setDescription(chosen.description ?? '');
    setInstallMode(installationMode(chosen));
    setInstallPrice(
      chosen.installation_price ? String(chosen.installation_price) : '',
    );
  };

  const setValue = (key: string, value: AttributeValue | undefined) =>
    setValues((current) =>
      Object.fromEntries([
        ...Object.entries(current).filter(([other]) => other !== key),
        ...(value === undefined ? [] : [[key, value]]),
      ]),
    );

  const save = async () => {
    if (!part) return;
    const saved = await adminFetch(`/admin/parts/${part.id}`, acknowledged, {
      method: 'POST',
      body: JSON.stringify({
        category_id: categoryId || null,
        attributes: values,
        ...installationBody(installMode, installPrice),
        ...(description !== (part.description ?? '') && { description }),
      }),
    });
    if (saved) {
      const next = { ...part, description: description.trim() || null };
      setPart(next);
      setParts((current) =>
        current.map((found) => (found.id === next.id ? next : found)),
      );
      toast.success(t('partAttributes.saved'));
      setSaves((count) => count + 1);
    }
  };

  const showImages = (
    identifierId: string,
    images: AdminImage[] | undefined,
  ) => {
    if (!part || !images) return Boolean(images);
    const next = {
      ...part,
      identifiers: part.identifiers.map((identifier) =>
        identifier.id === identifierId ? { ...identifier, images } : identifier,
      ),
    };
    setPart(next);
    setParts((current) =>
      current.map((found) => (found.id === next.id ? next : found)),
    );
    return true;
  };

  const category = categories.find(({ id }) => id === categoryId);
  const inherited = category?.installation_price ?? null;
  const modeLabels: Record<InstallationMode, string> = {
    inherit:
      inherited === null
        ? t('partAttributes.installationInheritNone')
        : inherited === 0
          ? t('partAttributes.installationInheritFree')
          : t('partAttributes.installationInheritPrice', { price: inherited }),
    price: t('partAttributes.installationOwnPrice'),
    free: t('partAttributes.installationFree'),
    none: t('partAttributes.installationNone'),
  };
  const installPriceValid =
    installMode !== 'price' ||
    (Number.isInteger(Number(installPrice)) && Number(installPrice) > 0);
  const identifier =
    part?.identifiers.find(({ id }) => id === identifierId) ??
    part?.identifiers[0];
  const imagesPath = identifier
    ? `/admin/part-identifiers/${identifier.id}/images`
    : '';

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('partAttributes.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('partAttributes.findLabel')}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="sm:w-80"
            aria-label={t('partAttributes.findLabel')}
            placeholder={t('partAttributes.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => search()}
            disabled={!query || writing}
          >
            {t('partAttributes.search')}
          </Button>
        </div>
        <div className="flex flex-col items-start gap-y-1">
          {parts.map((found) => (
            <Button
              disabled={writing}
              key={found.id}
              size="small"
              variant={found.id === part?.id ? 'primary' : 'transparent'}
              onClick={() => choose(found)}
            >
              {partLabel(found)}
            </Button>
          ))}
        </div>
      </div>

      {part && (
        <div className="flex flex-col gap-y-4">
          <div className="flex items-start justify-between gap-x-4">
            <div className="flex flex-col gap-y-1">
              <Heading level="h2">{partLabel(part)}</Heading>
              <EditedBy row={part} />
              <PartEnrichment partId={part.id} version={saves} />
            </div>
            <TranslationsDrawer
              entity="part"
              id={part.id}
              source={{
                name: part.name,
                ...(part.description && { description: part.description }),
              }}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Heading level="h3">{t('images.partHeading')}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {t('images.numberHint')}
            </Text>
            {identifier && (
              <>
                <div className="flex flex-col gap-y-1 sm:w-80">
                  <Label>{t('images.numberLabel')}</Label>
                  <Select
                    value={identifier.id}
                    onValueChange={setIdentifierId}
                    disabled={writing}
                  >
                    <Select.Trigger aria-label={t('images.numberLabel')}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {part.identifiers.map((option) => (
                        <Select.Item key={option.id} value={option.id}>
                          {t('images.numberOption', {
                            number: numberLabel(option),
                            count: option.images.length,
                          })}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <ImageUploads
                  key={identifier.id}
                  images={identifier.images}
                  alt={`${numberLabel(identifier)}, ${part.name}`}
                  multiple
                  onUpload={async (file) =>
                    showImages(
                      identifier.id,
                      (await uploadImage(imagesPath, file, imagesSchema))
                        ?.images,
                    )
                  }
                  onDelete={async (image) =>
                    showImages(
                      identifier.id,
                      (
                        await adminFetch(
                          `${imagesPath}/${image.id}`,
                          imagesSchema,
                          { method: 'DELETE' },
                        )
                      )?.images,
                    )
                  }
                  onMove={async (image, offset) => {
                    const ids = identifier.images.map(({ id }) => id);
                    const from = ids.indexOf(image.id);
                    ids.splice(from, 1);
                    ids.splice(from + offset, 0, image.id);
                    showImages(
                      identifier.id,
                      (
                        await adminFetch(`${imagesPath}/order`, imagesSchema, {
                          method: 'POST',
                          body: JSON.stringify({ ids }),
                        })
                      )?.images,
                    );
                  }}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor={`${part.id}-description`}>
              {t('partAttributes.description')}
            </Label>
            <Textarea
              id={`${part.id}-description`}
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('partAttributes.descriptionHint')}
            </Text>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label>{t('partAttributes.category')}</Label>
            <Select
              value={categoryId}
              onValueChange={(next) => {
                setCategoryId(next);
                setValues({});
              }}
            >
              <Select.Trigger aria-label={t('partAttributes.category')}>
                <Select.Value placeholder={t('partAttributes.noCategory')} />
              </Select.Trigger>
              <Select.Content>
                {categories.map((option) => (
                  <Select.Item key={option.id} value={option.id}>
                    {option.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {category?.fields.map((field) => {
            const label = [field.label, field.unit].filter(Boolean).join(', ');
            return (
              <div key={field.key} className="flex flex-col gap-y-2">
                <Label>
                  {label}{' '}
                  {field.required && (
                    <Badge size="small">{t('partAttributes.required')}</Badge>
                  )}
                </Label>
                <ValueInput
                  field={field}
                  label={label}
                  value={values[field.key]}
                  onChange={(value) => setValue(field.key, value)}
                />
                {i18n.exists(`partAttributes.hints.${field.key}`, {
                  ns: 'carlabAdmin',
                }) && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t(`partAttributes.hints.${field.key}`)}
                  </Text>
                )}
              </div>
            );
          })}
          {category && category.fields.length === 0 && (
            <Text>{t('partAttributes.noFields')}</Text>
          )}

          <div className="flex flex-col gap-y-2">
            <Heading level="h3">
              {t('partAttributes.installationHeading')}
            </Heading>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-y-1 sm:w-80">
                <Label>{t('partAttributes.installationMode')}</Label>
                <Select
                  value={installMode}
                  onValueChange={(next) =>
                    setInstallMode(z.enum(INSTALLATION_MODES).parse(next))
                  }
                >
                  <Select.Trigger
                    aria-label={t('partAttributes.installationMode')}
                  >
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {INSTALLATION_MODES.map((mode) => (
                      <Select.Item key={mode} value={mode}>
                        {modeLabels[mode]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              {installMode === 'price' && (
                <div className="flex flex-col gap-y-1 sm:w-48">
                  <Label>{t('partAttributes.installationPrice')}</Label>
                  <Input
                    aria-label={t('partAttributes.installationPrice')}
                    type="number"
                    min={1}
                    step={1}
                    value={installPrice}
                    onChange={(event) => setInstallPrice(event.target.value)}
                  />
                </div>
              )}
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              {t('partAttributes.installationHint')}
            </Text>
          </div>

          <div>
            <Button disabled={writing || !installPriceValid} onClick={save}>
              {t('partAttributes.save')}
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.partAttributes',
  icon: Adjustments,
  rank: 3,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.partAttributes');

export default PartAttributesPage;
