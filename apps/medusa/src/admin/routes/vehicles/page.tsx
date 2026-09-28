import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TruckFast } from '@medusajs/icons';
import { Button, Container, Heading, Input, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';

import {
  type Draft,
  EMPTY_DRAFT,
  draftOf,
  editRequest,
} from '../../../lib/vehicle-form';
import type { Level, VehicleTree } from '../../../lib/vehicle-tree';
import { ask } from '../../lib/ask';

type Entry = { id?: string; name: string; yearFrom?: number; yearTo?: number };

type ColumnProps = {
  title: string;
  level: Level;
  entries: Entry[];
  parentId?: string;
  selected?: string;
  empty: string;
  onSelect?: (id: string | undefined) => void;
  onSaved: (tree: VehicleTree) => void;
};

const Column = ({
  title,
  level,
  entries,
  parentId,
  selected,
  empty,
  onSelect,
  onSaved,
}: ColumnProps) => {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const dated = level === 'generations';

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setEditing(undefined);
  };

  const send = async (path: string, init: RequestInit, done: string) => {
    setBusy(true);
    try {
      const { makes } = await ask(path, init);
      onSaved(makes);
      reset();
      toast.success(done);
    } catch (error) {
      toast.error('Справочник не изменён', {
        description: (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const { path, body } = editRequest(level, draft, { id: editing, parentId });
    void send(
      path,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      editing ? 'Сохранено' : 'Добавлено',
    );
  };

  const remove = (entry: Entry) => {
    if (window.confirm(`Удалить «${entry.name}» вместе со всем, что внутри?`)) {
      void send(
        `/admin/vehicles/${level}/${entry.id}`,
        { method: 'DELETE' },
        `«${entry.name}» удалено`,
      );
    }
  };

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <Heading level="h3">{title}</Heading>
      {entries.length === 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          {empty}
        </Text>
      )}
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${
              entry.id === selected ? 'bg-ui-bg-highlight' : ''
            }`}
          >
            <button
              type="button"
              className="txt-compact-small text-left"
              disabled={!onSelect}
              onClick={() => onSelect?.(entry.id)}
            >
              {entry.name}
              {dated ? ` (${entry.yearFrom}–${entry.yearTo})` : ''}
            </button>
            <span className="flex gap-1">
              <Button
                size="small"
                variant="transparent"
                onClick={() => {
                  setEditing(entry.id);
                  setDraft(draftOf(entry));
                }}
              >
                Изменить
              </Button>
              <Button
                size="small"
                variant="transparent"
                onClick={() => remove(entry)}
              >
                Удалить
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <Text size="xsmall">Название</Text>
          <Input
            size="small"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        {dated && (
          <>
            <label className="flex flex-col gap-1">
              <Text size="xsmall">С года</Text>
              <Input
                size="small"
                type="number"
                inputMode="numeric"
                className="w-24"
                value={draft.yearFrom}
                onChange={(event) =>
                  setDraft({ ...draft, yearFrom: event.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <Text size="xsmall">По год</Text>
              <Input
                size="small"
                type="number"
                inputMode="numeric"
                className="w-24"
                value={draft.yearTo}
                onChange={(event) =>
                  setDraft({ ...draft, yearTo: event.target.value })
                }
              />
            </label>
          </>
        )}
        <Button size="small" onClick={save} isLoading={busy} disabled={busy}>
          {editing ? 'Сохранить' : 'Добавить'}
        </Button>
        {editing && (
          <Button size="small" variant="secondary" onClick={reset}>
            Отмена
          </Button>
        )}
      </div>
    </div>
  );
};

const VehiclesPage = () => {
  const [tree, setTree] = useState<VehicleTree>([]);
  const [makeId, setMakeId] = useState<string>();
  const [modelId, setModelId] = useState<string>();

  useEffect(() => {
    ask('/admin/vehicles')
      .then(({ makes }) => setTree(makes))
      .catch((error: Error) =>
        toast.error('Справочник не загрузился', { description: error.message }),
      );
  }, []);

  const make = tree.find((entry) => entry.id === makeId);
  const model = make?.models.find((entry) => entry.id === modelId);

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Автомобили</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Справочник для совместимости товаров: марка, модель, поколение с
          годами выпуска. В карточке товара машины выбираются только отсюда.
          Запись, на которую опирается совместимость товара, нельзя удалить,
          переименовать или сузить по годам, пока её не уберут из карточек.
        </Text>
      </div>
      <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        <Column
          title="Марки"
          level="makes"
          entries={tree}
          selected={makeId}
          empty="Пока ни одной марки."
          onSelect={(id) => {
            setMakeId(id);
            setModelId(undefined);
          }}
          onSaved={setTree}
        />
        {make ? (
          <Column
            key={make.id}
            title={`Модели ${make.name}`}
            level="models"
            entries={make.models}
            parentId={make.id}
            selected={modelId}
            empty="У марки пока нет моделей."
            onSelect={setModelId}
            onSaved={setTree}
          />
        ) : (
          <Text size="small" className="text-ui-fg-subtle px-6 py-4">
            Выберите марку.
          </Text>
        )}
        {make && model ? (
          <Column
            key={model.id}
            title={`Поколения ${make.name} ${model.name}`}
            level="generations"
            entries={model.generations}
            parentId={model.id}
            empty="Поколений пока нет."
            onSaved={setTree}
          />
        ) : (
          <Text size="small" className="text-ui-fg-subtle px-6 py-4">
            Выберите модель.
          </Text>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Автомобили',
  icon: TruckFast,
});

export default VehiclesPage;
