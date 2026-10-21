import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Table,
  Text,
} from '@medusajs/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type PartIdentifier = {
  id: string;
  value: string;
  superseded: boolean;
  brand: { name: string };
};

type Part = {
  id: string;
  name: string;
  replaced_by: { id: string; name: string } | null;
  identifiers: PartIdentifier[];
};

const searchParts = async (q: string): Promise<Part[]> =>
  (
    await adminFetch<{ parts: Part[] }>(
      `/admin/parts?q=${encodeURIComponent(q)}`,
    )
  )?.parts ?? [];

const numbersOf = (part: Part): string =>
  part.identifiers
    .map((identifier) => `${identifier.brand.name} ${identifier.value}`)
    .join(', ');

const SupersessionPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<Part[] | null>(null);
  const [selected, setSelected] = useState<Part | null>(null);
  const [replacementQuery, setReplacementQuery] = useState('');
  const [candidates, setCandidates] = useState<Part[] | null>(null);

  const [searchedQuery, setSearchedQuery] = useState('');

  const refresh = async (partId: string) => {
    const fresh = await searchParts(searchedQuery);
    setParts(fresh);
    setSelected(fresh.find((part) => part.id === partId) ?? null);
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setSearchedQuery(query);
    setParts(await searchParts(query));
  };

  const searchReplacement = async (event: FormEvent) => {
    event.preventDefault();
    const found = await searchParts(replacementQuery);
    setCandidates(found.filter((part) => part.id !== selected?.id));
  };

  const select = (part: Part) => {
    setSelected(part);
    setCandidates(null);
    setReplacementQuery('');
  };

  const setSuperseded = async (identifierId: string, superseded: boolean) => {
    const saved = await adminFetch(`/admin/part-identifiers/${identifierId}`, {
      method: 'POST',
      body: JSON.stringify({ superseded }),
    });
    if (saved && selected) {
      await refresh(selected.id);
    }
  };

  const setReplacement = async (replacedById: string | null) => {
    if (!selected) {
      return;
    }
    const saved = await adminFetch(`/admin/parts/${selected.id}`, {
      method: 'POST',
      body: JSON.stringify({ replaced_by_id: replacedById }),
    });
    if (saved) {
      setCandidates(null);
      setReplacementQuery('');
      await refresh(selected.id);
    }
  };

  return (
    <Container className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-1">
        <Heading level="h1">{t('supersession.heading')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('supersession.intro')}
        </Text>
      </div>

      <form className="flex flex-col gap-y-2" onSubmit={search}>
        <Label>{t('supersession.findLabel')}</Label>
        <div className="flex gap-x-2">
          <Input
            placeholder={t('supersession.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" disabled={!query.trim()}>
            {t('supersession.search')}
          </Button>
        </div>
      </form>

      {parts?.length === 0 && <Text>{t('supersession.noMatch')}</Text>}
      {parts && parts.length > 0 && (
        <div className="flex flex-col gap-y-2">
          {parts.map((part) => (
            <Button
              key={part.id}
              variant={part.id === selected?.id ? 'primary' : 'secondary'}
              className="justify-start"
              onClick={() => select(part)}
            >
              {part.name}: {numbersOf(part)}
            </Button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-2">
            <Heading level="h2">{selected.name}</Heading>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>
                    {t('supersession.columns.number')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('supersession.columns.superseded')}
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {selected.identifiers.map((identifier) => (
                  <Table.Row key={identifier.id}>
                    <Table.Cell>
                      {identifier.brand.name} {identifier.value}
                    </Table.Cell>
                    <Table.Cell>
                      <Switch
                        checked={identifier.superseded}
                        aria-label={t('supersession.markSuperseded', {
                          number: identifier.value,
                        })}
                        onCheckedChange={(checked) =>
                          setSuperseded(identifier.id, checked)
                        }
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label>{t('supersession.replacedByLabel')}</Label>
            {selected.replaced_by ? (
              <div className="flex items-center gap-x-2">
                <Badge>{selected.replaced_by.name}</Badge>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setReplacement(null)}
                >
                  {t('supersession.clearReplacement')}
                </Button>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                {t('supersession.notReplaced')}
              </Text>
            )}
            <form className="flex gap-x-2" onSubmit={searchReplacement}>
              <Input
                placeholder={t('supersession.replacementPlaceholder')}
                value={replacementQuery}
                onChange={(event) => setReplacementQuery(event.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!replacementQuery.trim()}
              >
                {t('supersession.search')}
              </Button>
            </form>
            {candidates?.length === 0 && (
              <Text>{t('supersession.noMatch')}</Text>
            )}
            {candidates?.map((candidate) => (
              <Button
                key={candidate.id}
                variant="secondary"
                className="justify-start"
                onClick={() => setReplacement(candidate.id)}
              >
                {t('supersession.replaceWith', {
                  part: `${candidate.name}: ${numbersOf(candidate)}`,
                })}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.supersession',
  translationNs: 'carlabAdmin',
});

export default SupersessionPage;
