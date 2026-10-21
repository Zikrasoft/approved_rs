import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import {
  STAGED_DATA_KINDS,
  type StagedDataKind,
} from '@podbor/catalog-contract';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type Supplier = {
  id: string;
  name: string;
  markup_percentage: number;
  released_kinds: StagedDataKind[];
};

type Category = { id: string; name: string };

type Mapping = { id: string; code: string; category_id: string };

type ImportSummary = {
  supplier: string;
  imported: number;
  created: number;
  skipped: number;
};

const SuppliersPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappedSupplierId, setMappedSupplierId] = useState('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const load = async () => {
    const data = await adminFetch<{ suppliers: Supplier[] }>(
      '/admin/suppliers',
    );
    if (data) {
      setSuppliers(data.suppliers);
    }
  };

  const loadMappings = async (supplierId: string) => {
    const data = await adminFetch<{ categories: Mapping[] }>(
      `/admin/suppliers/${supplierId}/categories`,
    );
    if (data) {
      setMappings(data.categories);
    }
  };

  useEffect(() => {
    load();
    adminFetch<{ categories: Category[] }>('/admin/categories').then((data) => {
      if (data) {
        setCategories(data.categories);
      }
    });
  }, []);

  const update = async (id: string, body: Partial<Supplier>) => {
    setSavingId(id);
    await adminFetch(`/admin/suppliers/${id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSavingId(null);
    await load();
  };

  const saveMarkup = (id: string) => {
    const markup_percentage = Number(drafts[id]);
    if (Number.isFinite(markup_percentage)) {
      update(id, { markup_percentage });
    }
  };

  const toggleRelease = (supplier: Supplier, kind: StagedDataKind) =>
    update(supplier.id, {
      released_kinds: supplier.released_kinds.includes(kind)
        ? supplier.released_kinds.filter((released) => released !== kind)
        : [...supplier.released_kinds, kind],
    });

  const runImport = async () => {
    setImporting(true);
    const data = await adminFetch<{ imports: ImportSummary[] }>(
      '/admin/supplier-imports',
      { method: 'POST' },
    );
    setImporting(false);
    if (data) {
      toast.success(
        data.imports.length
          ? data.imports
              .map((summary) => t('suppliers.importSummary', summary))
              .join('\n')
          : t('suppliers.importNoAdapters'),
      );
    }
  };

  const chooseSupplier = (supplierId: string) => {
    setMappedSupplierId(supplierId);
    loadMappings(supplierId);
  };

  const addMapping = async () => {
    const created = await adminFetch(
      `/admin/suppliers/${mappedSupplierId}/categories`,
      {
        method: 'POST',
        body: JSON.stringify({ code, category_id: categoryId }),
      },
    );
    if (created) {
      setCode('');
      setCategoryId('');
      await loadMappings(mappedSupplierId);
    }
  };

  const removeMapping = async (id: string) => {
    await adminFetch(`/admin/suppliers/${mappedSupplierId}/categories/${id}`, {
      method: 'DELETE',
    });
    await loadMappings(mappedSupplierId);
  };

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-4">
        <div className="flex items-start justify-between gap-x-4">
          <div className="flex flex-col gap-y-1">
            <Heading level="h1">{t('suppliers.heading')}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {t('suppliers.importLead')}
            </Text>
          </div>
          <Button variant="secondary" isLoading={importing} onClick={runImport}>
            {t('suppliers.import')}
          </Button>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t('suppliers.columns.name')}</Table.HeaderCell>
              <Table.HeaderCell>
                {t('suppliers.columns.markup')}
              </Table.HeaderCell>
              <Table.HeaderCell />
              <Table.HeaderCell>
                {t('suppliers.columns.released')}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {suppliers.map((supplier) => (
              <Table.Row key={supplier.id}>
                <Table.Cell>{supplier.name}</Table.Cell>
                <Table.Cell>
                  <Input
                    type="number"
                    value={
                      drafts[supplier.id] ?? String(supplier.markup_percentage)
                    }
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [supplier.id]: event.target.value,
                      }))
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    isLoading={savingId === supplier.id}
                    onClick={() => saveMarkup(supplier.id)}
                  >
                    {t('suppliers.save')}
                  </Button>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-y-1 py-2">
                    {STAGED_DATA_KINDS.map((kind) => (
                      <div key={kind} className="flex items-center gap-x-2">
                        <Checkbox
                          id={`${supplier.id}-${kind}`}
                          checked={supplier.released_kinds.includes(kind)}
                          disabled={savingId === supplier.id}
                          onCheckedChange={() => toggleRelease(supplier, kind)}
                        />
                        <Label size="small" htmlFor={`${supplier.id}-${kind}`}>
                          {t(`suppliers.kinds.${kind}`)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <Text size="small" className="text-ui-fg-subtle">
          {t('suppliers.releasedHint')}
        </Text>
      </Container>

      <Container className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">{t('suppliers.mappings.heading')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t('suppliers.mappings.lead')}
          </Text>
        </div>
        <div className="max-w-xs">
          <Select value={mappedSupplierId} onValueChange={chooseSupplier}>
            <Select.Trigger>
              <Select.Value
                placeholder={t('suppliers.mappings.supplierPlaceholder')}
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
        </div>
        {mappedSupplierId && (
          <>
            {mappings.length ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>
                      {t('suppliers.mappings.code')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('suppliers.mappings.category')}
                    </Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {mappings.map((mapping) => (
                    <Table.Row key={mapping.id}>
                      <Table.Cell>{mapping.code}</Table.Cell>
                      <Table.Cell>
                        {categoryName(mapping.category_id)}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => removeMapping(mapping.id)}
                        >
                          {t('suppliers.mappings.remove')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <Text size="small">{t('suppliers.mappings.empty')}</Text>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                size="small"
                className="max-w-xs"
                placeholder={t('suppliers.mappings.codePlaceholder')}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <div className="w-64">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <Select.Trigger>
                    <Select.Value
                      placeholder={t('suppliers.mappings.categoryPlaceholder')}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {categories.map((category) => (
                      <Select.Item key={category.id} value={category.id}>
                        {category.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <Button
                size="small"
                disabled={!code.trim() || !categoryId}
                onClick={addMapping}
              >
                {t('suppliers.mappings.add')}
              </Button>
            </div>
          </>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'menu.suppliers',
  translationNs: 'carlabAdmin',
});

export default SuppliersPage;
