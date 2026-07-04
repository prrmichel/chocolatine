import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import type { ModelInfo } from '@shared/types/models';
import styles from './ModelSelect.module.css';

interface ModelOption {
  id: string;
  label: string;
  disabled?: boolean;
}

type PriceCategory = 'low' | 'medium' | 'high' | 'very_high' | '';

interface ModelSummary {
  id: string;
  name: string;
  priceCategory: PriceCategory;
  category: string;
  inputPrice: number | null;
  cachePrice: number | null;
  outputPrice: number | null;
  disabled?: boolean;
}

interface ModelSelectProps {
  value: string;
  options: ModelOption[];
  onChange: (value: string) => void;
  className?: string;
  unavailableMessage?: string;
  /** Optional prefix for option keys to avoid React key clashes when multiple selectors exist */
  keyPrefix?: string;
  /** When true, the entire selector is disabled — the dropdown cannot be opened. */
  disabled?: boolean;
  /** Tooltip shown when the selector is disabled (e.g. explaining why the model is locked). */
  disabledMessage?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toPriceCategory(value: string | null): PriceCategory {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'very_high') {
    return value;
  }
  return '';
}

function formatPriceCategory(value: PriceCategory): string {
  if (value === 'low') return 'Low';
  if (value === 'medium') return 'Medium';
  if (value === 'high') return 'High';
  if (value === 'very_high') return 'Very High';
  return '';
}

function formatTokenPrice(value: number | null): string {
  if (value === null) {
    return '';
  }
  return `${(value / 100).toFixed(2)}$`;
}

function toModelSummary(option: ModelOption, modelCatalog: ModelInfo[]): ModelSummary {
  const model = modelCatalog.find((entry) => entry.id === option.id);
  if (!model) {
    return {
      id: option.id,
      name: option.label,
      priceCategory: '',
      category: '',
      inputPrice: null,
      cachePrice: null,
      outputPrice: null,
      disabled: option.disabled
    };
  }

  const modelRecord = model as unknown as Record<string, unknown>;
  const billingRecord = asRecord(modelRecord.billing);
  const tokenPricesRecord = asRecord(billingRecord?.tokenPrices);

  return {
    id: model.id,
    name: model.name || option.label || model.id,
    priceCategory: toPriceCategory(readString(modelRecord, 'modelPickerPriceCategory')),
    category: readString(modelRecord, 'modelPickerCategory') ?? '',
    inputPrice: tokenPricesRecord ? readNumber(tokenPricesRecord, 'inputPrice') : null,
    cachePrice: tokenPricesRecord ? readNumber(tokenPricesRecord, 'cachePrice') : null,
    outputPrice: tokenPricesRecord ? readNumber(tokenPricesRecord, 'outputPrice') : null,
    disabled: option.disabled
  };
}

export default function ModelSelect({
  value,
  options,
  onChange,
  className = 'model-select',
  unavailableMessage = 'Copilot model catalog is unavailable.',
  keyPrefix = 'model',
  disabled = false,
  disabledMessage
}: ModelSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const infoTooltipContainerRef = useRef<HTMLDivElement | null>(null);
  const infoTooltipRef = useRef<HTMLDivElement | null>(null);
  const { modelCatalog } = useSettingsStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [openDropdownUpwards, setOpenDropdownUpwards] = useState(false);
  const [openInfoTooltipUpwards, setOpenInfoTooltipUpwards] = useState(false);

  const summaries = useMemo(
    () => options.map((option) => toModelSummary(option, modelCatalog)),
    [modelCatalog, options]
  );
  const selectedSummary = useMemo(
    () => summaries.find((entry) => entry.id === value) ?? summaries[0],
    [summaries, value]
  );

  const updateDropdownDirection = useCallback(() => {
    if (!rootRef.current) {
      return;
    }

    const rootRect = rootRef.current.getBoundingClientRect();
    const availableBelow = Math.max(0, window.innerHeight - rootRect.bottom);
    const availableAbove = Math.max(0, rootRect.top);
    const dropdownHeight = dropdownRef.current?.getBoundingClientRect().height ?? 280;

    setOpenDropdownUpwards(availableBelow < dropdownHeight && availableAbove > availableBelow);
  }, []);

  const updateInfoTooltipDirection = useCallback(() => {
    if (!infoTooltipContainerRef.current) {
      return;
    }

    const containerRect = infoTooltipContainerRef.current.getBoundingClientRect();
    const availableBelow = Math.max(0, window.innerHeight - containerRect.bottom);
    const availableAbove = Math.max(0, containerRect.top);
    const tooltipHeight = infoTooltipRef.current?.getBoundingClientRect().height ?? 180;

    setOpenInfoTooltipUpwards(availableBelow < tooltipHeight && availableAbove > availableBelow);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    updateDropdownDirection();

    const handleViewportChange = () => updateDropdownDirection();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isDropdownOpen, updateDropdownDirection]);

  if (options.length === 0) {
    return <div className="muted">{unavailableMessage}</div>;
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.selectorRow}>
        <div className={styles.triggerWrapper}>
        <button
          type="button"
          className={`select ${className} ${styles.trigger} ${disabled ? styles.triggerDisabled : ''}`.trim()}
          onClick={() => {
            if (disabled) {
              return;
            }
            setIsDropdownOpen((current) => {
              const nextIsOpen = !current;
              if (nextIsOpen) {
                requestAnimationFrame(updateDropdownDirection);
              }
              return nextIsOpen;
            });
          }}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          disabled={disabled}
        >
          <span className={styles.triggerColumns}>
            <span className={styles.triggerName}>{selectedSummary?.name ?? value}</span>
            <span className={styles.triggerPrice}>{formatPriceCategory(selectedSummary?.priceCategory ?? '') || '—'}</span>
            <span className={styles.triggerOutput}>{formatTokenPrice(selectedSummary?.outputPrice ?? null) || '—'}</span>
          </span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </button>
        {disabled && disabledMessage && (
          <div role="tooltip" className={styles.disabledTooltip}>{disabledMessage}</div>
        )}
        </div>

        <div
          ref={infoTooltipContainerRef}
          className={styles.infoTooltipContainer}
          onMouseEnter={updateInfoTooltipDirection}
          onFocusCapture={updateInfoTooltipDirection}
        >
          <button
            type="button"
            className={`btn ${styles.iconButton}`}
            aria-label="Show selected model information"
            title="Model information"
            disabled={!selectedSummary}
          >
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
          </button>
          {selectedSummary && (
            <div
              ref={infoTooltipRef}
              role="tooltip"
              className={`${styles.infoTooltip} ${openInfoTooltipUpwards ? styles.infoTooltipUp : ''}`.trim()}
            >
              <div className={styles.infoTooltipTitle}>{selectedSummary.name}</div>
              <div className={styles.infoTooltipRow}>
                <span>Price category</span>
                <strong>{formatPriceCategory(selectedSummary.priceCategory)}</strong>
              </div>
              <div className={styles.infoTooltipRow}>
                <span>Category</span>
                <strong>{selectedSummary.category}</strong>
              </div>
              <div className={styles.infoTooltipRow}>
                <span>Input</span>
                <strong>{formatTokenPrice(selectedSummary.inputPrice)}</strong>
              </div>
              <div className={styles.infoTooltipRow}>
                <span>Cache</span>
                <strong>{formatTokenPrice(selectedSummary.cachePrice)}</strong>
              </div>
              <div className={styles.infoTooltipRow}>
                <span>Output</span>
                <strong>{formatTokenPrice(selectedSummary.outputPrice)}</strong>
              </div>
            </div>
          )}
        </div>

      </div>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className={`${styles.dropdown} ${openDropdownUpwards ? styles.dropdownUp : ''}`.trim()}
          role="listbox"
        >
          <div className={styles.dropdownHeader}>
            <span>Name</span>
            <span>Price</span>
            <span>Output</span>
          </div>
          <div className={styles.dropdownList}>
            {summaries.map((model) => (
              <button
                key={`${keyPrefix}-${model.id}`}
                type="button"
                className={`${styles.dropdownItem} ${model.id === value ? styles.dropdownItemActive : ''}`.trim()}
                onClick={() => {
                  if (model.disabled) {
                    return;
                  }
                  onChange(model.id);
                  setIsDropdownOpen(false);
                }}
                disabled={Boolean(model.disabled)}
              >
                <span>{model.name}</span>
                <span>{formatPriceCategory(model.priceCategory) || '—'}</span>
                <span>{formatTokenPrice(model.outputPrice) || '—'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
