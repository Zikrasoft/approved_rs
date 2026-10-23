import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Tag } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { ListLoading, PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';

const brandSchema = editedBySchema.extend({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  spellings: z.array(
    z.object({ id: z.string(), supplier_id: z.string(), value: z.string() }),
  ),
});

type Brand = z.infer<typeof brandSchema>;

type Spelling = Brand['spellings'][number];

const supplierSchema = z.object({ id: z.string(), name: z.string() });

type Supplier = z.infer<typeof supplierSchema>;

const brandsSchema = z.object({ brands: z.array(brandSchema) });
const suppliersSchema = z.object({ suppliers: z.array(supplierSchema) });

type SpellingDraft = { supplierId: string; value: string };

const EMPTY_SPELLING: SpellingDraft = { supplierId: '', value: '' };

const BrandsPage = () => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();

  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [spellingDrafts, setSpellingDrafts] = useState<
    Record<string, SpellingDraft>
  >({});

  const load = async () => {
    const data = await adminFetch('/admin/brands', brandsSchema);
    if (data) {
      setBrands(data.brands);
    }
  };

  useEffect(() => {
    load();
    adminFetch('/admin/suppliers', suppliersSchema).then((data) => {
      if (data) {
        setSuppliers(data.suppliers);
      }
    });
  }, []);

  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? id;

  const draftFor = (brandId: string) =>
    spellingDrafts[brandId] ?? EMPTY_SPELLING;

  const setDraft = (brandId: string, draft: Partial<SpellingDraft>) =>
    setSpellingDrafts((drafts) => ({
      ...drafts,
      [brandId]: { ...draftFor(brandId), ...draft },
    }));

  const createBrand = async () => {
    const created = await adminFetch('/admin/brands', acknowledged, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    if (created) {
      toast.success(t('brands.created', { name }));
      setName('');
      setSlug('');
      await load();
    }
  };

  const removeBrand = async (brand: Brand) => {
    if (
      await confirmed({
        title: t('brands.confirmDeleteTitle', { name: brand.name }),
        description: t('brands.confirmDeleteBody'),
        done: t('brands.deleted', { name: brand.name }),
        run: () =>
          adminFetch(`/admin/brands/${brand.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      await load();
    }
  };

  const addSpelling = async (brandId: string) => {
    const { supplierId, value } = draftFor(brandId);
    const created = await adminFetch(
      `/admin/brands/${brandId}/spellings`,
      acknowledged,
      {
        method: 'POST',
        body: JSON.stringify({ supplier_id: supplierId, value }),
      },
    );
    if (created) {
      toast.success(t('brands.spellingAdded', { spelling: value }));
      setDraft(brandId, EMPTY_SPELLING);
      await load();
    }
  };

  const removeSpelling = async (brandId: string, spelling: Spelling) => {
    if (
      await confirmed({
        title: t('brands.confirmSpellingTitle', { spelling: spelling.value }),
        description: t('brands.confirmSpellingBody'),
        done: t('brands.spellingRemoved', { spelling: spelling.value }),
        run: () =>
          adminFetch(
            `/admin/brands/${brandId}/spellings/${spelling.id}`,
            acknowledged,
            { method: 'DELETE' },
          ),
      })
    ) {
      await load();
    }
  };

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('brands.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('brands.createLabel')}</Label>
        <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder={t('brands.namePlaceholder')}
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder={t('brands.slugPlaceholder')}
            value={slug}
            maxLength={200}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Button onClick={createBrand} disabled={!name || !slug || writing}>
            {t('brands.create')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('brands.slugHint')}
        </Text>
      </div>

      {brands === null ? (
        <ListLoading />
      ) : brands.length === 0 ? (
        <Text>{t('brands.empty')}</Text>
      ) : (
        <ScrollArea pinnedEnd>
          <Table className={PINNED_ACTIONS}>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('brands.columns.name')}</Table.HeaderCell>
                <Table.HeaderCell>{t('brands.columns.slug')}</Table.HeaderCell>
                <Table.HeaderCell>
                  {t('brands.columns.spellings')}
                </Table.HeaderCell>
                <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {brands.map((brand) => (
                <Table.Row key={brand.id}>
                  <Table.Cell className="max-w-[16rem] whitespace-normal break-words">
                    {brand.name}
                  </Table.Cell>
                  <Table.Cell className="max-w-[12rem] whitespace-normal break-words">
                    {brand.slug}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-y-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {brand.spellings.map((spelling) => (
                          <Badge key={spelling.id} size="small">
                            {supplierName(spelling.supplier_id)}:{' '}
                            {spelling.value}
                            <button
                              type="button"
                              className="ml-1"
                              aria-label={t('brands.removeSpelling', {
                                spelling: spelling.value,
                              })}
                              onClick={() => removeSpelling(brand.id, spelling)}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={draftFor(brand.id).supplierId}
                          onValueChange={(supplierId) =>
                            setDraft(brand.id, { supplierId })
                          }
                        >
                          <Select.Trigger>
                            <Select.Value
                              placeholder={t('brands.supplierPlaceholder')}
                            />
                          </Select.Trigger>
                          <Select.Content>
                            {suppliers.map((supplier) => (
                              <Select.Item
                                key={supplier.id}
                                value={supplier.id}
                              >
                                {supplier.name}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                        <Input
                          size="small"
                          className="min-w-[10rem]"
                          maxLength={200}
                          placeholder={t('brands.spellingPlaceholder')}
                          value={draftFor(brand.id).value}
                          onChange={(event) =>
                            setDraft(brand.id, { value: event.target.value })
                          }
                        />
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => addSpelling(brand.id)}
                          disabled={
                            !draftFor(brand.id).supplierId ||
                            !draftFor(brand.id).value ||
                            writing
                          }
                        >
                          {t('brands.addSpelling')}
                        </Button>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <EditedBy row={brand} />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      disabled={writing}
                      size="small"
                      variant="danger"
                      onClick={() => removeBrand(brand)}
                    >
                      {t('brands.delete')}
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
  label: 'menu.brands',
  icon: Tag,
  rank: 1,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.brands');

export default BrandsPage;
