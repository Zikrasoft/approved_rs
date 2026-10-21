import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Table } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type Supplier = {
  id: string;
  name: string;
  markup_percentage: number;
};

const SuppliersPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const data = await adminFetch<{ suppliers: Supplier[] }>(
      '/admin/suppliers',
    );
    if (data) {
      setSuppliers(data.suppliers);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: string) => {
    const markup_percentage = Number(drafts[id]);
    if (!Number.isFinite(markup_percentage)) {
      return;
    }

    setSavingId(id);
    await adminFetch(`/admin/suppliers/${id}`, {
      method: 'POST',
      body: JSON.stringify({ markup_percentage }),
    });
    setSavingId(null);
    await load();
  };

  return (
    <Container>
      <Heading level="h1">{t('suppliers.heading')}</Heading>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{t('suppliers.columns.name')}</Table.HeaderCell>
            <Table.HeaderCell>{t('suppliers.columns.markup')}</Table.HeaderCell>
            <Table.HeaderCell />
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
                  onClick={() => save(supplier.id)}
                >
                  {t('suppliers.save')}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.suppliers',
  translationNs: 'carlabAdmin',
});

export default SuppliersPage;
