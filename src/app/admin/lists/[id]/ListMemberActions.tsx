'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin-layout.module.css';

interface RemoveProps {
  listId: string;
  userId: string;
  mode: 'remove';
  availableUsers?: never;
}

interface AddProps {
  listId: string;
  userId?: never;
  mode: 'add';
  availableUsers: Array<{ id: string; name: string | null; email: string }>;
}

type Props = RemoveProps | AddProps;

export function ListMemberActions(props: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');

  if (props.mode === 'remove') {
    const handleRemove = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/lists/${props.listId}/members/${props.userId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove member.');
        router.refresh();
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    return (
      <div>
        <button
          onClick={handleRemove}
          disabled={isLoading}
          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
          title="Remove from list"
        >
          {isLoading ? '...' : 'Remove'}
        </button>
        {error && <p className={styles.formError} style={{ marginTop: '4px' }}>{error}</p>}
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/lists/${props.listId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add member.');
      }
      setSelectedUserId('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        disabled={isLoading}
        className={styles.formInput}
        style={{ maxWidth: '360px', flex: 1 }}
      >
        <option value="">Select a user...</option>
        {props.availableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ? `${u.name} (${u.email})` : u.email}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!selectedUserId || isLoading}
        className={`${styles.btn} ${styles.btnPrimary}`}
      >
        {isLoading ? 'Adding...' : 'Add to List'}
      </button>
      {error && <p className={styles.formError} style={{ width: '100%', margin: 0 }}>{error}</p>}
    </form>
  );
}
