import * as React from 'react';
import type { LegendProps } from 'recharts';
import { Legend, ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PEMBUNGKUS GRAFIK ala shadcn — disesuaikan untuk proyek ini
   ════════════════════════════════════════════════════════════════════════
   Sumbernya ditulis untuk React 19 dan sistem desain lain. Empat hal harus
   diterjemahkan, dan tiga di antaranya akan GAGAL DIAM kalau disalin apa
   adanya:

   1. `use(ChartContext)` — React 19. Proyek ini React 18, di mana `use`
      tidak ada sama sekali: build langsung gagal. Diganti `useContext`.

   2. `ref` sebagai prop biasa — juga React 19. Di React 18 ia diperlakukan
      sebagai prop bernama "ref" dan DIABAIKAN tanpa peringatan, jadi
      komponen yang mengandalkannya diam-diam kehilangan ref-nya. Diganti
      forwardRef.

   3. Kelas `text-muted-fg`, `bg-overlay`, `text-overlay-fg`, `text-fg`
      milik sistem desain intentui — tidak ada di sini. Tailwind tidak
      mengeluh soal kelas yang tidak dikenal; ia cuma tidak menghasilkan
      apa-apa, dan hasilnya teks tanpa warna di atas latar tanpa warna.
      Dipetakan ke palet zinc yang memang dipakai seluruh aplikasi.

   4. `twMerge` diganti `cn` — pembungkus yang sama, sudah dipakai di mana-
      mana, jadi tidak ada dua jalan untuk hal yang sama.

   Yang DIPERTAHANKAN dari sumbernya: penyuntikan `--color-<kunci>` lewat
   ChartStyle, dan tumpukan penimpa `[&_.recharts-*]`. Yang kedua itu justru
   inti masalahnya — Recharts menanam warna `#ccc` dan `outline` bawaan
   langsung di elemennya, dan tanpa penimpa ini grafik di latar gelap selalu
   terlihat seperti grafik terang yang dipaksa gelap.
   ════════════════════════════════════════════════════════════════════════ */

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error('useChart harus dipakai di dalam <Chart />');
  return context;
}

const Chart = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof ResponsiveContainer>['children'];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex justify-center text-xs',
          "[&_.recharts-cartesian-axis-tick_text]:fill-zinc-500",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-zinc-800",
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-zinc-800',
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          '[&_.recharts-layer]:outline-hidden',
          "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-zinc-800",
          '[&_.recharts-radial-bar-background-sector]:fill-zinc-900',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-zinc-900',
          "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-zinc-800",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          '[&_.recharts-sector]:outline-hidden',
          '[&_.recharts-surface]:outline-hidden',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
Chart.displayName = 'Chart';

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, c]) => c.theme || c.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
};

const ChartTooltip = Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Tooltip> &
    React.ComponentProps<'div'> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: 'line' | 'dot' | 'dashed';
      nameKey?: string;
      labelKey?: string;
      /** Ditulis di belakang angka — "70 / 100" lebih jelas daripada "70". */
      satuan?: string;
    }
>(
  (
    {
      active, payload, className, indicator = 'dot', hideLabel = false, hideIndicator = false,
      label, labelFormatter, labelClassName, formatter, color, nameKey, labelKey, satuan,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      const [item] = payload;
      if (!item) return null;

      const key = `${labelKey || item.dataKey || item.name || 'value'}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === 'string'
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return <div className={cn('text-zinc-400', labelClassName)}>{labelFormatter(value, payload)}</div>;
      }
      if (!value) return null;
      return <div className={cn('text-zinc-400', labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== 'dot';

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11.5px] text-zinc-100 shadow-xl',
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item: any, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload?.fill || item.color;

            return (
              <div
                key={item.dataKey ?? index}
                className={cn(
                  'flex w-full flex-wrap items-stretch gap-2',
                  indicator === 'dot' && 'items-center',
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                            indicator === 'dot' && 'size-2.5',
                            indicator === 'line' && 'w-1',
                            indicator === 'dashed' && 'w-0 border-[1.5px] border-dashed bg-transparent',
                            nestLabel && indicator === 'dashed' && 'my-0.5',
                          )}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between gap-3 leading-none',
                        nestLabel ? 'items-end' : 'items-center',
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-zinc-400">{itemConfig?.label || item.name}</span>
                      </div>
                      {item.value !== undefined && item.value !== null && (
                        <span className="angka font-medium text-zinc-100">
                          {typeof item.value === 'number' ? item.value.toLocaleString('id-ID') : item.value}
                          {satuan ? <span className="text-zinc-500">{satuan}</span> : null}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

const ChartLegend = Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> &
    Pick<LegendProps, 'payload' | 'verticalAlign'> & {
      hideIcon?: boolean;
      nameKey?: string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-center gap-4 text-[11.5px] text-zinc-400',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map((item: any) => {
        const key = `${nameKey || item.dataKey || 'value'}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div key={item.value} className="flex items-center gap-1.5">
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = 'ChartLegendContent';

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const payloadPayload =
    'payload' in payload && typeof (payload as any).payload === 'object' && (payload as any).payload !== null
      ? (payload as any).payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof (payload as any)[key] === 'string') {
    configLabelKey = (payload as any)[key];
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === 'string') {
    configLabelKey = payloadPayload[key];
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export { Chart, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
