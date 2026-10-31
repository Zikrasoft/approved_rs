import { defineRouteConfig } from '@medusajs/admin-sdk';
import { SquaresPlus } from '@medusajs/icons';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useEffect, useId, useState } from 'react';
import { CATEGORY_FIELD_TYPES } from '@podbor/catalog-contract';
import { getI18n, useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import {
  adminImageSchema,
  ImageUploads,
  uploadImage,
} from '../../components/image-uploads';
import { ListLoading, PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { SlugRename } from '../../components/slug-rename';
import { TranslationsDrawer } from '../../components/translations-drawer';
import {
  acknowledged,
  adminFetch,
  type FieldErrorHandler,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';
import {
  type Category,
  categoriesSchema,
  type CategoryField,
  type FieldOption,
} from '../../lib/categories';

const FIELD_TYPES = CATEGORY_FIELD_TYPES;

type FieldType = (typeof FIELD_TYPES)[number];

const categoryImageSchema = z.object({ image: adminImageSchema.nullable() });
const createdCategorySchema = z.object({
  category: z.object({ id: z.string() }),
});

type FieldDraft = {
  key: string;
  type: FieldType;
  label: string;
  unit: string;
  required: boolean;
  facet: boolean;
};

const EMPTY_FIELD: FieldDraft = {
  key: '',
  type: 'number',
  label: '',
  unit: '',
  required: false,
  facet: false,
};

const isSelect = (type: FieldType) =>
  type === 'single-select' || type === 'multi-select';

const post = async (
  path: string,
  body: unknown,
  onFieldError?: FieldErrorHandler,
) => {
  const saved = await adminFetch(
    path,
    acknowledged,
    { method: 'POST', body: JSON.stringify(body) },
    onFieldError,
  );
  if (saved) toast.success(getI18n().t('common.saved', { ns: 'carlabAdmin' }));
  return saved;
};

const remove = (path: string) =>
  adminFetch(path, acknowledged, { method: 'DELETE' });

const OptionRow = ({
  path,
  option,
  onChange,
}: {
  path: string;
  option: FieldOption;
  onChange: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [label, setLabel] = useState(option.label);

  return (
    <div className="flex items-center gap-x-2">
      <Badge size="small">{option.key}</Badge>
      <Input
        size="small"
        aria-label={t('categories.optionLabel')}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Button
        size="small"
        variant="secondary"
        disabled={!label || label === option.label || writing}
        onClick={async () => {
          if (await post(`${path}/${option.id}`, { label })) await onChange();
        }}
      >
        {t('categories.rename')}
      </Button>
      <TranslationsDrawer
        entity="category_field_option"
        id={option.id}
        source={{ label: option.label }}
      />
      <Button
        disabled={writing}
        size="small"
        variant="transparent"
        onClick={async () => {
          if (
            await confirmed({
              title: t('categories.confirmDeleteOptionTitle', {
                option: option.label,
              }),
              description: t('categories.confirmDeleteOptionBody'),
              run: () => remove(`${path}/${option.id}`),
            })
          )
            await onChange();
        }}
      >
        {t('categories.deleteOption')}
      </Button>
    </div>
  );
};

const FieldRow = ({
  path,
  field,
  onChange,
}: {
  path: string;
  field: CategoryField;
  onChange: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [label, setLabel] = useState(field.label);
  const [unit, setUnit] = useState(field.unit ?? '');
  const [rank, setRank] = useState(String(field.rank));
  const [optionKey, setOptionKey] = useState('');
  const [optionLabel, setOptionLabel] = useState('');
  const optionsPath = `${path}/options`;

  const save = async (change: Record<string, unknown>) => {
    if (await post(path, change)) await onChange();
  };

  const addOption = async () => {
    const created = await post(optionsPath, {
      key: optionKey,
      label: optionLabel,
      rank: field.options.length,
    });
    if (created) {
      setOptionKey('');
      setOptionLabel('');
      await onChange();
    }
  };

  return (
    <Table.Row>
      <Table.Cell>
        <Badge size="small">{field.key}</Badge>
      </Table.Cell>
      <Table.Cell>{t(`categories.fieldTypes.${field.type}`)}</Table.Cell>
      <Table.Cell>
        <div className="flex flex-col gap-y-2 py-2">
          <Input
            size="small"
            aria-label={t('categories.fieldLabel')}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          {isSelect(field.type) && (
            <div className="flex flex-col gap-y-2">
              {field.options.map((option) => (
                <OptionRow
                  key={option.id}
                  path={optionsPath}
                  option={option}
                  onChange={onChange}
                />
              ))}
              <div className="flex gap-x-2">
                <Input
                  size="small"
                  placeholder={t('categories.optionKeyPlaceholder')}
                  value={optionKey}
                  onChange={(event) => setOptionKey(event.target.value)}
                />
                <Input
                  size="small"
                  placeholder={t('categories.optionLabelPlaceholder')}
                  value={optionLabel}
                  onChange={(event) => setOptionLabel(event.target.value)}
                />
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!optionKey || !optionLabel || writing}
                  onClick={addOption}
                >
                  {t('categories.addOption')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Table.Cell>
      <Table.Cell>
        <Input
          size="small"
          aria-label={t('categories.unit')}
          value={unit}
          disabled={field.type !== 'number'}
          onChange={(event) => setUnit(event.target.value)}
        />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          aria-label={t('categories.required')}
          checked={field.required}
          onCheckedChange={(checked) => save({ required: checked === true })}
        />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          aria-label={t('categories.facet')}
          checked={field.facet}
          onCheckedChange={(checked) => save({ facet: checked === true })}
        />
      </Table.Cell>
      <Table.Cell>
        <Input
          size="small"
          type="number"
          aria-label={t('categories.rank')}
          value={rank}
          onChange={(event) => setRank(event.target.value)}
        />
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col gap-y-2">
          <Button
            size="small"
            variant="secondary"
            disabled={!label || writing}
            onClick={() =>
              save({ label, unit: unit || null, rank: Number(rank) })
            }
          >
            {t('categories.save')}
          </Button>
          <TranslationsDrawer
            entity="category_field"
            id={field.id}
            source={{ label: field.label }}
          />
          <Button
            disabled={writing}
            size="small"
            variant="danger"
            onClick={async () => {
              if (
                await confirmed({
                  title: t('categories.confirmDeleteFieldTitle', {
                    field: field.label,
                  }),
                  description: t('categories.confirmDeleteFieldBody'),
                  run: () => remove(path),
                })
              )
                await onChange();
            }}
          >
            {t('categories.deleteField')}
          </Button>
        </div>
      </Table.Cell>
    </Table.Row>
  );
};

const CategoryEditor = ({
  category,
  onChange,
}: {
  category: Category;
  onChange: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [name, setName] = useState(category.name);
  const [text, setText] = useState(category.text);
  const [kit, setKit] = useState(category.maintenance_kit);
  const [kitRank, setKitRank] = useState(String(category.kit_rank));
  const [serviceLabel, setServiceLabel] = useState(
    category.service_label ?? '',
  );
  const [servicePrice, setServicePrice] = useState(
    category.service_price === null ? '' : String(category.service_price),
  );
  const [serviceNote, setServiceNote] = useState(category.service_note ?? '');
  const [installationPrice, setInstallationPrice] = useState(
    category.installation_price === null
      ? ''
      : String(category.installation_price),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formId = useId();
  const fieldProps = (field: string) => ({
    id: `${formId}-${field}`,
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field]
      ? `${formId}-${field}-error`
      : undefined,
  });
  const fieldError = (field: string) =>
    fieldErrors[field] && (
      <Text
        id={`${formId}-${field}-error`}
        size="small"
        className="text-ui-fg-error"
      >
        {fieldErrors[field]}
      </Text>
    );
  const [draft, setDraft] = useState<FieldDraft>(EMPTY_FIELD);
  const path = `/admin/categories/${category.id}`;

  const addField = async () => {
    const created = await post(`${path}/fields`, {
      key: draft.key,
      type: draft.type,
      label: draft.label,
      unit: draft.type === 'number' && draft.unit ? draft.unit : null,
      required: draft.required,
      facet: draft.facet,
      rank: category.fields.length,
    });
    if (created) {
      setDraft(EMPTY_FIELD);
      await onChange();
    }
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <Heading level="h2">{category.name}</Heading>
          <SlugRename
            kind="category"
            id={category.id}
            slug={category.slug}
            name={category.name}
            reload={onChange}
          />
        </div>
        <EditedBy row={category} />
        <Label>{t('categories.name')}</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Label>{t('categories.text')}</Label>
        <Textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.textHint')}
        </Text>
        <Heading level="h3" className="mt-2">
          {t('images.categoryHeading')}
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('images.categoryHint')}
        </Text>
        <ImageUploads
          images={category.image ? [category.image] : []}
          alt={category.name}
          multiple={false}
          onUpload={async (file) => {
            const saved = await uploadImage(
              `${path}/image`,
              file,
              categoryImageSchema,
            );
            if (saved) await onChange();
            return saved;
          }}
          onDelete={async () => {
            const saved = await adminFetch(
              `${path}/image`,
              categoryImageSchema,
              {
                method: 'DELETE',
              },
            );
            if (saved) await onChange();
            return saved;
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Label className="flex items-center gap-x-2">
            <Checkbox
              checked={kit}
              onCheckedChange={(checked) => setKit(checked === true)}
            />
            {t('categories.maintenanceKit')}
          </Label>
          {kit && (
            <Input
              type="number"
              aria-label={t('categories.kitRank')}
              placeholder={t('categories.kitRank')}
              value={kitRank}
              onChange={(event) => setKitRank(event.target.value)}
            />
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.maintenanceKitHint')}
        </Text>
        <Heading level="h3" className="mt-2">
          {t('categories.serviceHeading')}
        </Heading>
        <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor={`${formId}-service_label`}>
              {t('categories.serviceLabel')}
            </Label>
            <Input
              {...fieldProps('service_label')}
              placeholder={t('categories.serviceLabelPlaceholder')}
              value={serviceLabel}
              onChange={(event) => setServiceLabel(event.target.value)}
            />
            {fieldError('service_label')}
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor={`${formId}-service_price`}>
              {t('categories.servicePrice')}
            </Label>
            <Input
              {...fieldProps('service_price')}
              type="number"
              min={0}
              step={1}
              value={servicePrice}
              onChange={(event) => setServicePrice(event.target.value)}
            />
            {fieldError('service_price')}
          </div>
        </div>
        <div className="flex max-w-3xl flex-col gap-y-1">
          <Label htmlFor={`${formId}-service_note`}>
            {t('categories.serviceNote')}
          </Label>
          <Textarea
            {...fieldProps('service_note')}
            rows={3}
            placeholder={t('categories.serviceNotePlaceholder')}
            value={serviceNote}
            onChange={(event) => setServiceNote(event.target.value)}
          />
          {fieldError('service_note')}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.serviceHint')}
        </Text>
        <Heading level="h3" className="mt-2">
          {t('categories.installationHeading')}
        </Heading>
        <div className="flex max-w-xs flex-col gap-y-1">
          <Label htmlFor={`${formId}-installation_price`}>
            {t('categories.installationPrice')}
          </Label>
          <Input
            {...fieldProps('installation_price')}
            type="number"
            min={0}
            step={1}
            value={installationPrice}
            onChange={(event) => setInstallationPrice(event.target.value)}
          />
          {fieldError('installation_price')}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.installationHint')}
        </Text>
        <div className="flex gap-x-2">
          <Button
            disabled={!name || !Number.isInteger(Number(kitRank)) || writing}
            onClick={async () => {
              setFieldErrors({});
              const saved = await post(
                path,
                {
                  name,
                  text,
                  maintenance_kit: kit,
                  kit_rank: Number(kitRank),
                  service_label: serviceLabel.trim() || null,
                  service_price:
                    servicePrice.trim() === '' ? null : Number(servicePrice),
                  service_note: serviceNote.trim() || null,
                  installation_price:
                    installationPrice.trim() === ''
                      ? null
                      : Number(installationPrice),
                },
                (field, message) =>
                  setFieldErrors((errors) => ({ ...errors, [field]: message })),
              );
              if (saved) await onChange();
            }}
          >
            {t('categories.save')}
          </Button>
          <TranslationsDrawer
            entity="category"
            id={category.id}
            source={{
              name: category.name,
              text: category.text,
              ...(category.service_label && {
                service_label: category.service_label,
              }),
              ...(category.service_note && {
                service_note: category.service_note,
              }),
            }}
          />
          <Button
            disabled={writing}
            variant="danger"
            onClick={async () => {
              if (
                await confirmed({
                  title: t('categories.confirmDeleteCategoryTitle', {
                    category: category.name,
                  }),
                  description: t('categories.confirmDeleteCategoryBody'),
                  run: () => remove(path),
                })
              )
                await onChange();
            }}
          >
            {t('categories.deleteCategory')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Heading level="h3">{t('categories.fieldsHeading')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.fieldsHint')}
        </Text>
        {category.fields.length === 0 ? (
          <Text>{t('categories.noFields')}</Text>
        ) : (
          <ScrollArea pinnedEnd>
            <Table className={PINNED_ACTIONS}>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>{t('categories.key')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('categories.type')}</Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('categories.fieldLabel')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>{t('categories.unit')}</Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('categories.required')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>{t('categories.facet')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('categories.rank')}</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {category.fields.map((field) => (
                  <FieldRow
                    key={`${field.id}-${field.label}-${field.unit}-${field.rank}`}
                    path={`${path}/fields/${field.id}`}
                    field={field}
                    onChange={onChange}
                  />
                ))}
              </Table.Body>
            </Table>
          </ScrollArea>
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('categories.newField')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t('categories.keyPlaceholder')}
            value={draft.key}
            onChange={(event) =>
              setDraft({ ...draft, key: event.target.value })
            }
          />
          <Select
            value={draft.type}
            onValueChange={(type) =>
              setDraft({ ...draft, type: type as FieldType })
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {FIELD_TYPES.map((type) => (
                <Select.Item key={type} value={type}>
                  {t(`categories.fieldTypes.${type}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            placeholder={t('categories.labelPlaceholder')}
            value={draft.label}
            onChange={(event) =>
              setDraft({ ...draft, label: event.target.value })
            }
          />
          {draft.type === 'number' && (
            <Input
              placeholder={t('categories.unitPlaceholder')}
              value={draft.unit}
              onChange={(event) =>
                setDraft({ ...draft, unit: event.target.value })
              }
            />
          )}
          <Label className="flex items-center gap-x-2">
            <Checkbox
              checked={draft.required}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, required: checked === true })
              }
            />
            {t('categories.required')}
          </Label>
          <Label className="flex items-center gap-x-2">
            <Checkbox
              checked={draft.facet}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, facet: checked === true })
              }
            />
            {t('categories.facet')}
          </Label>
          <Button
            variant="secondary"
            disabled={!draft.key || !draft.label || writing}
            onClick={addField}
          >
            {t('categories.addField')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.keyHint')}
        </Text>
      </div>
    </div>
  );
};

const CategoriesPage = () => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');

  const load = async () => {
    const data = await adminFetch('/admin/categories', categoriesSchema);
    if (data) setCategories(data.categories);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const created = await adminFetch(
      '/admin/categories',
      createdCategorySchema,
      { method: 'POST', body: JSON.stringify({ slug, name }) },
    );
    if (created) {
      toast.success(t('common.saved'));
      setSlug('');
      setName('');
      setSelectedId(created.category.id);
      await load();
    }
  };

  const selected = categories?.find(({ id }) => id === selectedId);

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('categories.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('categories.createLabel')}</Label>
        <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder={t('categories.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder={t('categories.slugPlaceholder')}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Button onClick={create} disabled={!name || !slug || writing}>
            {t('categories.create')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.slugHint')}
        </Text>
      </div>

      {categories === null ? (
        <ListLoading />
      ) : categories.length === 0 ? (
        <Text>{t('categories.empty')}</Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              disabled={writing}
              key={category.id}
              size="small"
              variant={category.id === selectedId ? 'primary' : 'secondary'}
              onClick={() => setSelectedId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      {selected && (
        <CategoryEditor
          key={`${selected.id}-${selected.name}-${selected.text}-${selected.maintenance_kit}-${selected.kit_rank}-${selected.service_label}-${selected.service_price}-${selected.service_note}-${selected.installation_price}`}
          category={selected}
          onChange={load}
        />
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.categories',
  icon: SquaresPlus,
  rank: 2,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.categories');

export default CategoriesPage;
