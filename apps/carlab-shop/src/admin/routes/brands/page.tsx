import { defineRouteConfig } from '@medusajs/admin-sdk';
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
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type BrandSpelling = {
  id: string;
  supplier_id: string;
  value: string;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  spellings: BrandSpelling[];
};

type Supplier = {
  id: string;
  name: string;
};

type SpellingDraft = { supplierId: string; value: string };

const EMPTY_SPELLING: SpellingDraft = { supplierId: '', value: '' };

const BrandsPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [spellingDrafts, setSpellingDrafts] = useState<
    Record<string, SpellingDraft>
  >({});

  const load = async () => {
    const data = await adminFetch<{ brands: Brand[] }>('/admin/brands');
    if (data) {
      setBrands(data.brands);
    }
  };

  useEffect(() => {
    load();
    adminFetch<{ suppliers: Supplier[] }>('/admin/suppliers').then((data) => {
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
    const created = await adminFetch('/admin/brands', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    if (created) {
      setName('');
      setSlug('');
      await load();
    }
  };

  const removeBrand = async (id: string) => {
    if (await adminFetch(`/admin/brands/${id}`, { method: 'DELETE' })) {
      await load();
    }
  };

  const addSpelling = async (brandId: string) => {
    const { supplierId, value } = draftFor(brandId);
    const created = await adminFetch(`/admin/brands/${brandId}/spellings`, {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId, value }),
    });
    if (created) {
      setDraft(brandId, EMPTY_SPELLING);
      await load();
    }
  };

  const removeSpelling = async (brandId: string, spellingId: string) => {
    const removed = await adminFetch(
      `/admin/brands/${brandId}/spellings/${spellingId}`,
      { method: 'DELETE' },
    );
    if (removed) {
      await load();
    }
  };

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('brands.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('brands.createLabel')}</Label>
        <div className="flex gap-x-2">
          <Input
            placeholder={t('brands.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder={t('brands.slugPlaceholder')}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Button onClick={createBrand} disabled={!name || !slug}>
            {t('brands.create')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('brands.slugHint')}
        </Text>
      </div>

      {brands.length === 0 ? (
        <Text>{t('brands.empty')}</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t('brands.columns.name')}</Table.HeaderCell>
              <Table.HeaderCell>{t('brands.columns.slug')}</Table.HeaderCell>
              <Table.HeaderCell>
                {t('brands.columns.spellings')}
              </Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brands.map((brand) => (
              <Table.Row key={brand.id}>
                <Table.Cell>{brand.name}</Table.Cell>
                <Table.Cell>{brand.slug}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-y-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {brand.spellings.map((spelling) => (
                        <Badge key={spelling.id} size="small">
                          {supplierName(spelling.supplier_id)}: {spelling.value}
                          <button
                            type="button"
                            className="ml-1"
                            aria-label={t('brands.removeSpelling', {
                              spelling: spelling.value,
                            })}
                            onClick={() =>
                              removeSpelling(brand.id, spelling.id)
                            }
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-x-2">
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
                            <Select.Item key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                      <Input
                        size="small"
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
                          !draftFor(brand.id).value
                        }
                      >
                        {t('brands.addSpelling')}
                      </Button>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => removeBrand(brand.id)}
                  >
                    {t('brands.delete')}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.brands',
  translationNs: 'carlabAdmin',
});

export default BrandsPage;
