import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Tag } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { ListLoading, PINNED_ACTIONS, RowActions } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { SlugRename } from '../../components/slug-rename';
import {
  Spellings,
  spellingSchema,
  type Supplier,
  suppliersSchema,
} from '../../components/spellings';
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
  spellings: z.array(spellingSchema),
});

type Brand = z.infer<typeof brandSchema>;

const brandsSchema = z.object({ brands: z.array(brandSchema) });

const BrandsPage = () => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();

  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

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
                  <Table.Cell className="max-w-[12rem]">
                    <SlugRename
                      kind="brand"
                      id={brand.id}
                      slug={brand.slug}
                      name={brand.name}
                      reload={load}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Spellings
                      path={`/admin/brands/${brand.id}/spellings`}
                      copy="brands"
                      spellings={brand.spellings}
                      suppliers={suppliers}
                      reload={load}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <EditedBy row={brand} />
                  </Table.Cell>
                  <Table.Cell>
                    <RowActions
                      label={t('common.actionsFor', { name: brand.name })}
                      disabled={writing}
                      deleteLabel={t('brands.delete')}
                      onDelete={() => removeBrand(brand)}
                    />
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
