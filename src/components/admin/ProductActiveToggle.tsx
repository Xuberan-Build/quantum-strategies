'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';

interface ProductActiveToggleProps {
  productSlug: string;
  productName: string;
  initialActive: boolean;
}

export default function ProductActiveToggle({
  productSlug,
  productName,
  initialActive,
}: ProductActiveToggleProps) {
  const [isActive, setIsActive] = useState(initialActive);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    const newValue = !isActive;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/products/${productSlug}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      setIsActive(newValue);
    } catch (error) {
      console.error('Toggle failed:', error);
      // Revert on error
      setIsActive(isActive);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <label className={styles.toggle} title={`${isActive ? 'Deactivate' : 'Activate'} ${productName}`}>
      <input
        type="checkbox"
        className={styles.toggleInput}
        checked={isActive}
        onChange={handleToggle}
        disabled={isLoading}
      />
      <span className={styles.toggleSlider} />
    </label>
  );
}
