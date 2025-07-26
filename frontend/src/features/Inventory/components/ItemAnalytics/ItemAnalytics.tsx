import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import styles from './ItemAnalytics.module.css';
import SimpleChart from './SimpleChart';
import SlidingDrawer from '@shared/components/SlidingDrawer/SlidingDrawer';
import { InventoryHistoryItem } from '@/types/inventoryTypes';

interface ItemAnalyticsProps {
  itemId: string;
  itemName: string;
  category: string;
  history: InventoryHistoryItem[];
  isOpen: boolean;
  onClose: () => void;
}

const ItemAnalytics: React.FC<ItemAnalyticsProps> = ({
  itemId,
  itemName,
  category,
  history = [],
  isOpen,
  onClose
}) => {
  // Подготавливаем данные для анализа
  const safeHistory = Array.isArray(history) ? history : [];
  const hasData = safeHistory.length > 0;

  // Анализируем данные для выводов
  const analytics = useMemo(() => {
    if (!safeHistory || safeHistory.length === 0) return null;

    // Добавляем отладку для понимания структуры данных
    console.log('🔍 [Analytics] Анализируем историю:', safeHistory);
    console.log('🔍 [Analytics] Доступные поля action:', Array.from(new Set(safeHistory.map(h => h.action).filter(Boolean))));

    // Анализируем по изменению количества (если old_quantity != new_quantity)
    const changes = safeHistory.filter(h => 
      h.old_quantity !== undefined && h.new_quantity !== undefined && h.old_quantity !== h.new_quantity
    ).length;
    
    // Считаем добавления (когда old_quantity = 0 или undefined, а new_quantity > 0)
    const additions = safeHistory.filter(h => 
      (!h.old_quantity || h.old_quantity === 0) && h.new_quantity && h.new_quantity > 0
    ).length;
    
    // Считаем удаления (когда old_quantity > 0, а new_quantity = 0)
    const removals = safeHistory.filter(h => 
      h.old_quantity && h.old_quantity > 0 && (!h.new_quantity || h.new_quantity === 0)
    ).length;

    console.log('🔍 [Analytics] Результаты фильтрации:', { changes, additions, removals });

    // Ищем большие изменения (>50% от предыдущего значения)
    const bigChanges = safeHistory.filter((record, index) => {
      if (index === 0 || !record.old_quantity || !record.new_quantity) return false;
      const changePercent = Math.abs(record.new_quantity - record.old_quantity) / record.old_quantity * 100;
      return changePercent > 50;
    });

    // Находим самые активные дни
    const dayActivity: { [key: string]: number } = {};
    safeHistory.forEach(record => {
      const day = format(new Date(record.timestamp), 'dd.MM.yyyy', { locale: ru });
      dayActivity[day] = (dayActivity[day] || 0) + 1;
    });

    const mostActiveDay = Object.entries(dayActivity)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      totalChanges: changes + additions + removals,
      changes,
      additions,
      removals,
      bigChanges: bigChanges.length,
      mostActiveDay: mostActiveDay ? `${mostActiveDay[0]} (${mostActiveDay[1]} изменений)` : 'Нет данных',
      averageValue: safeHistory.length > 0 
        ? Math.round(safeHistory.reduce((sum, h) => sum + (h.new_quantity || 0), 0) / safeHistory.length)
        : 0
    };
  }, [safeHistory]);



  if (!isOpen) return null;

  return (
    <SlidingDrawer onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>📊 Аналитика товара</h2>
        </div>

        <div className={styles.content}>
          {/* Основная статистика */}
          {analytics && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{analytics.totalChanges}</span>
                <span className={styles.statLabel}>Всего изменений</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{analytics.averageValue}</span>
                <span className={styles.statLabel}>Среднее количество</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{analytics.bigChanges}</span>
                <span className={styles.statLabel}>Больших изменений</span>
              </div>
            </div>
          )}

          {/* График */}
          <div className={styles.chartSection}>
            <h3 className={styles.chartTitle}>📈 История изменений: {itemName}</h3>
            <SimpleChart history={safeHistory} />
          </div>

          {/* Дополнительная аналитика */}
          {analytics && (
            <div className={styles.insights}>
              <h3>🔍 Выводы</h3>
              <ul>
                <li>Обновлений: {analytics.changes}</li>
                <li>Добавлений: {analytics.additions}</li>
                <li>Удалений: {analytics.removals}</li>
                <li>Самый активный день: {analytics.mostActiveDay}</li>
                {analytics.bigChanges > 0 && (
                  <li className={styles.warning}>
                    ⚠️ Обнаружено {analytics.bigChanges} резких изменений (&gt;50%)
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </SlidingDrawer>
  );
};

export default ItemAnalytics; 