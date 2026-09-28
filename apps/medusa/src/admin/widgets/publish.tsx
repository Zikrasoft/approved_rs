import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Text, toast } from '@medusajs/ui';
import { CARLAB } from '@podbor/brands';
import { useState } from 'react';

const PublishWidget = () => {
  const [sending, setSending] = useState(false);

  const publish = async () => {
    setSending(true);
    try {
      const response = await fetch('/admin/publish', {
        method: 'POST',
        credentials: 'include',
      });
      const answer: { message?: string } = await response
        .json()
        .catch(() => ({}));
      if (response.ok) {
        toast.success('Публикация запущена', {
          description:
            answer.message ?? 'Сайт обновится в течение нескольких минут.',
        });
      } else {
        toast.error('Публикация не запущена', {
          description: answer.message ?? 'Попробуйте ещё раз через минуту.',
        });
      }
    } catch {
      toast.error('Публикация не запущена', {
        description: 'Сервер не ответил. Проверьте связь и попробуйте ещё раз.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container className="mb-2 flex items-center justify-between gap-4">
      <div>
        <Heading level="h2">Сайт {CARLAB.domain}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Правки товаров, цен и переводов попадают на сайт после публикации.
        </Text>
      </div>
      <Button onClick={publish} isLoading={sending} disabled={sending}>
        Опубликовать на сайте
      </Button>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: 'product.list.before' });

export default PublishWidget;
