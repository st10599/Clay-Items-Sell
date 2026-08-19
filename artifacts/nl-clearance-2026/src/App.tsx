import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Papa from 'papaparse';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  ImageOff,
  MessageCircle,
  PackageOpen,
  RefreshCw,
  Tag,
  X,
} from 'lucide-react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTchJgQTW17h4h2lth4uxyYdkrrWzUH2P26j4bTmjdfxoP3quq6EADxevlTniWIKJXTfMlzgCP46Bf0/pub?gid=1231845176&single=true&output=csv';
const LINE_URL = 'https://line.me/R/ti/p/~crab880720';
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=100003494572990';

type ItemStatus = 'available' | 'reserved' | 'sold';
type Item = {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: string;
  status: ItemStatus;
  rawStatus: string;
};

type ContactItem = Pick<Item, 'name' | 'price'>;

const keyAliases = {
  name: ['物品名稱', '品名', '物品名', 'name', 'itemname', 'title'],
  description: ['說明', '描述', '商品說明', 'description', 'desc', 'details'],
  images: ['照片', '圖片', '照片網址', '圖片網址', 'imageurl', 'image_url', 'images', 'photo'],
  price: ['價格', '售價', 'price', 'cost'],
  status: ['目前狀態', '狀態', '商品狀態', 'status', 'condition'],
} as const;

function normalizeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_\-./()（）[\]{}:：]/g, '');
}

function valueFor(row: Record<string, string>, aliases: readonly string[]) {
  const match = Object.keys(row).find((key) => {
    const normalized = normalizeKey(key);
    return aliases.some((alias) => normalizeKey(alias) === normalized);
  });
  return match ? String(row[match] ?? '').trim() : '';
}

function parseStatus(value: string): ItemStatus {
  const normalized = value.toLocaleLowerCase().replace(/\s/g, '');
  if (/未售出|未售|available|forsale|待售/.test(normalized)) return 'available';
  if (/已售出|售出|sold|soldout|已成交/.test(normalized)) return 'sold';
  if (/已預訂|已预订|預訂|预订|預約|预留|候補|候补|reserved|pending|hold/.test(normalized)) return 'reserved';
  return 'available';
}

function parseImages(value: string) {
  return value
    .replace(/\]\s*\(/g, '\n')
    .split(/[\n,]+/)
    .map((image) => image.trim())
    .filter(Boolean)
    .map((image) => {
      const cleanedImage = image.replace(/^!?\[[^\]]*\]\(/, '').replace(/[)\]]+$/, '');
      const driveFileMatch =
        cleanedImage.match(/drive\.google\.com\/file\/d\/([^/?]+)/i) ??
        cleanedImage.match(/file\/d\/([^/?]+)/i);
      const driveQueryMatch = cleanedImage.match(/[?&]id=([^&)\]]+)/i);
      const driveId = driveFileMatch?.[1] ?? driveQueryMatch?.[1];
      return driveId ? `https://lh3.googleusercontent.com/d/${driveId}` : cleanedImage;
    });
}

function formatPrice(value: string) {
  const clean = value.trim();
  if (!clean) return '價格請私訊';
  return /€|eur/i.test(clean) ? clean : `€${clean}`;
}

function parseItems(rows: Record<string, string>[]) {
  const items = rows
    .map((row, index): Item | null => {
      const name = valueFor(row, keyAliases.name);
      if (!name) return null;
      const rawStatus = valueFor(row, keyAliases.status);
      return {
        id: `${normalizeKey(name)}-${index}`,
        name,
        description: valueFor(row, keyAliases.description) || '這件物品正在等待下一個好好使用它的人。',
        images: parseImages(valueFor(row, keyAliases.images)),
        price: formatPrice(valueFor(row, keyAliases.price)),
        status: parseStatus(rawStatus),
        rawStatus,
      };
    })
    .filter((item): item is Item => Boolean(item));

  // The sheet can retain older status rows for the same item. Since the
  // newest row is appended last, keep the last entry for each product name.
  return Array.from(
    items.reduce((latest, item) => latest.set(normalizeKey(item.name), item), new Map<string, Item>()).values(),
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const label = status === 'available' ? '未售出' : status === 'reserved' ? '已預訂' : '已售出';
  const color =
    status === 'available'
      ? 'bg-emerald-600 text-white'
      : status === 'reserved'
        ? 'bg-amber-500 text-[#422d1c]'
        : 'bg-rose-600 text-white';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-[.08em] ${color}`}>
      {label}
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="loading-grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="overflow-hidden rounded-[1.2rem] border border-[#eadfce] bg-[#fffdf9]" key={index}>
          <div className="skeleton aspect-[4/3]" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="flex justify-between pt-2">
              <div className="skeleton h-8 w-20 rounded-full" />
              <div className="skeleton h-8 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageFrame({
  src,
  alt,
  className = '',
  loading = 'lazy',
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-[#eee5d8] text-[#b08e67] ${className}`} data-testid="image-fallback">
        <div className="flex flex-col items-center gap-2">
          <ImageOff size={27} strokeWidth={1.4} />
          <span className="text-[10px] font-semibold tracking-[.12em]">尚未提供照片</span>
        </div>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
      loading={loading}
    />
  );
}

function ProductCard({
  item,
  onOpen,
  onContact,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onContact: (item: Item) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const sold = item.status === 'sold';
  const buttonText =
    item.status === 'available' ? '🤝 我想購買 / 預約面交' : item.status === 'reserved' ? '🙋 我想排（候補預約）' : '已售出';

  const moveImage = (event: MouseEvent, direction: number) => {
    event.stopPropagation();
    setImageIndex((current) => (current + direction + item.images.length) % item.images.length);
  };

  return (
    <article
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-[1.2rem] border border-[#e8dccb] bg-[#fffdf9] shadow-[0_12px_35px_rgba(90,66,45,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(90,66,45,.13)] ${sold ? 'grayscale opacity-60' : ''}`}
      onClick={() => onOpen(item)}
      data-testid={`card-product-${item.id}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(item);
      }}
      role="button"
      aria-label={`查看 ${item.name} 詳情`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eee5d8]">
        <ImageFrame src={item.images[imageIndex]} alt={item.name} className="h-full w-full transition duration-500 group-hover:scale-[1.025]" />
        <div className="absolute left-4 top-4">
          <StatusBadge status={item.status} />
        </div>
        {item.images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-white transition hover:bg-black/95"
              onClick={(event) => moveImage(event, -1)}
              aria-label="上一張照片"
              data-testid={`button-prev-image-${item.id}`}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-white transition hover:bg-black/95"
              onClick={(event) => moveImage(event, 1)}
              aria-label="下一張照片"
              data-testid={`button-next-image-${item.id}`}
            >
              <ArrowRight size={17} />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white" data-testid={`text-image-count-${item.id}`}>
              {imageIndex + 1} / {item.images.length}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-[1.35rem] leading-tight text-[#5a422d]">{item.name}</h2>
          <span className="shrink-0 font-serif text-lg font-semibold text-[#75573b]" data-testid={`text-price-${item.id}`}>
            {item.price}
          </span>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#816f5d]" data-testid={`text-description-${item.id}`}>
          {item.description}
        </p>
        <div className="mt-auto border-t border-[#eee4d6] pt-4">
          <button
            type="button"
            disabled={sold}
            className={`w-full rounded-full px-4 py-2.5 text-xs font-bold tracking-[.02em] transition ${sold ? 'cursor-not-allowed bg-[#e2ddd5] text-[#9a9187]' : 'bg-[#75573b] text-[#fffaf3] hover:bg-[#5a422d] hover:shadow-md'}`}
            onClick={(event) => {
              event.stopPropagation();
               if (!sold) onContact(item);
            }}
            data-testid={`button-contact-${item.id}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </article>
  );
}

function ModalShell({
  label,
  onClose,
  children,
  className = '',
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#2d2118]/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      data-testid="modal-backdrop"
    >
      <section
        className={`modal-enter relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-[#fffdf9] shadow-2xl sm:max-w-3xl sm:rounded-[1.5rem] ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f4ede2]/90 text-[#75573b] transition hover:bg-[#e8dccb]"
          aria-label="關閉視窗"
          data-testid="button-close-modal"
        >
          <X size={19} />
        </button>
        {children}
      </section>
    </div>
  );
}

function DetailModal({
  item,
  onClose,
  onContact,
}: {
  item: Item;
  onClose: () => void;
  onContact: (item: Item) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const sold = item.status === 'sold';
  return (
    <ModalShell label={`${item.name} 詳情`} onClose={onClose} className="sm:max-w-4xl">
      <div className="grid sm:grid-cols-[1.05fr_.95fr]">
        <div className="relative min-h-[280px] bg-[#eee5d8] sm:min-h-[500px]">
          <ImageFrame src={item.images[imageIndex]} alt={item.name} loading="eager" className="h-full min-h-[280px] w-full sm:min-h-[500px]" />
          {item.images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black/95"
                onClick={() => setImageIndex((current) => (current - 1 + item.images.length) % item.images.length)}
                aria-label="上一張高解析照片"
                data-testid="button-modal-prev-image"
              >
                <ArrowLeft size={19} />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black/95"
                onClick={() => setImageIndex((current) => (current + 1) % item.images.length)}
                aria-label="下一張高解析照片"
                data-testid="button-modal-next-image"
              >
                <ArrowRight size={19} />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                {imageIndex + 1} / {item.images.length}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col p-6 sm:p-9">
          <div className="flex items-center justify-between gap-3 pr-10">
            <StatusBadge status={item.status} />
            {item.images.length > 0 && <span className="text-[11px] font-semibold tracking-[.12em] text-[#a08d78]">DETAIL / {imageIndex + 1}</span>}
          </div>
          <h2 className="mt-6 font-serif text-4xl leading-[1.05] text-[#5a422d] sm:text-5xl" data-testid={`modal-title-${item.id}`}>
            {item.name}
          </h2>
          <p className="mt-5 font-serif text-3xl text-[#75573b]" data-testid={`modal-price-${item.id}`}>
            {item.price}
          </p>
          <div className="my-6 h-px bg-[#eadfce]" />
          <p className="whitespace-pre-line text-[15px] leading-7 text-[#735f4d]" data-testid={`modal-description-${item.id}`}>
            {item.description}
          </p>
          <div className="mt-auto pt-8">
            <button
              type="button"
              disabled={sold}
              onClick={() => onContact(item)}
              className={`w-full rounded-full px-5 py-3.5 text-sm font-bold transition ${sold ? 'cursor-not-allowed bg-[#e2ddd5] text-[#9a9187]' : 'bg-[#75573b] text-[#fffaf3] hover:bg-[#5a422d]'}`}
              data-testid={`button-modal-contact-${item.id}`}
            >
              {sold ? '已售出，謝謝您的關注' : item.status === 'reserved' ? '🙋 我想排（候補預約）' : '🤝 我想購買 / 預約面交'}
            </button>
            {!sold && <p className="mt-3 text-center text-xs text-[#a08d78]">點擊後會複製一段方便傳訊的內容</p>}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ContactModal({ item, onClose }: { item: ContactItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const defaultMessage = `您好，我想詢問「${item.name}」（${item.price}）。\n方便日期時間：\n交易地點：`;

  useEffect(() => {
    let cancelled = false;
    void copyText(defaultMessage).then((success) => {
      if (!cancelled) setCopied(success);
    });
    return () => {
      cancelled = true;
    };
  }, [defaultMessage]);

  return (
    <ModalShell label="聯絡賣家" onClose={onClose} className="sm:max-w-lg">
      <div className="p-7 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eee5] text-[#3d7651]">
          <MessageCircle size={23} />
        </div>
        <p className="mt-6 text-xs font-bold tracking-[.16em] text-[#a08d78]">CONTACT / 聯絡</p>
        <p className="mt-4 text-[15px] leading-7 text-[#735f4d]">請選擇透過 LINE 或 Facebook 私訊我，並告知您方便的日期時間與地點。</p>
        <div className="mt-6 rounded-xl border border-[#e8dccb] bg-[#faf5ec] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#75573b]">
            {copied ? <Check size={15} /> : <ClipboardCheck size={15} />}
            {copied ? '已複製預設訊息' : '正在準備訊息'}
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#816f5d]" data-testid="text-contact-template">
            {defaultMessage}
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-[#fffaf3] transition hover:bg-[#5a422d] bg-[#06C755]"
            data-testid="link-open-line"
          >
            💬 LINE 聯絡 <ExternalLink size={14} />
          </a>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-[#cdbba5] px-4 py-3 text-sm font-bold text-[#75573b] transition hover:bg-[#f4ede2] border-t-[0px] border-r-[0px] border-b-[0px] border-l-[0px] bg-[1877F2]"
            data-testid="link-open-facebook"
          >
            📘 Facebook 聯絡 <ExternalLink size={14} />
          </a>
        </div>
        <p className="mt-5 text-center text-xs text-[#a08d78]">LINE ID：crab880720</p>
      </div>
    </ModalShell>
  );
}

function EmptyState({ hiddenSold }: { hiddenSold: boolean }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#d8c7b4] bg-[#fbf7f0] px-6 text-center" data-testid="empty-state">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eee5d8] text-[#9b7959]">
        <PackageOpen size={29} strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 font-serif text-3xl text-[#5a422d]">{hiddenSold ? '目前沒有可看的物品' : '清單還在整理中'}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#816f5d]">
        {hiddenSold ? '所有物品目前都已售出。可以取消勾選「隱藏已售出」，看看完整的出清紀錄。' : 'Google Sheets 目前沒有可顯示的品項，請稍後再來看看。'}
      </p>
    </div>
  );
}

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideSold, setHideSold] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [contactItem, setContactItem] = useState<ContactItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const separator = CSV_URL.includes('?') ? '&' : '?';
      const response = await fetch(`${CSV_URL}${separator}t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`CSV request failed: ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: 'greedy' });
      if (parsed.errors.length > 0 && parsed.data.length === 0) throw new Error('CSV 格式似乎無法讀取');
      setItems(parseItems(parsed.data));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法讀取出清清單');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const visibleItems = useMemo(() => (hideSold ? items.filter((item) => item.status !== 'sold') : items), [hideSold, items]);
  const counts = useMemo(
    () => ({
      total: items.length,
      available: items.filter((item) => item.status === 'available').length,
      reserved: items.filter((item) => item.status === 'reserved').length,
    }),
    [items],
  );

  const openContact = useCallback((item: Item) => {
    setSelectedItem(null);
    setContactItem(item);
  }, []);

  return (
    <main className="grain min-h-[100dvh]">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
        <header className="page-enter">
          <div className="flex flex-col gap-6 border-b border-[#e3d5c4] pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-[clamp(2.8rem,7vw,5.8rem)] leading-[.92] tracking-[-.045em] text-[#5a422d]" data-testid="text-page-title">
                2026 荷蘭出清
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-3 rounded-full border border-[#d9c8b5] bg-[#fffdf9]/70 px-4 py-2.5 text-sm text-[#735f4d]" data-testid="label-hide-sold">
                <input
                  type="checkbox"
                  checked={hideSold}
                  onChange={(event) => setHideSold(event.target.checked)}
                  className="h-4 w-4 accent-[#75573b]"
                  data-testid="checkbox-hide-sold"
                />
                隱藏已售出
              </label>
              <button
                type="button"
                onClick={() => void loadItems()}
                disabled={loading}
                className="flex items-center gap-2 rounded-full bg-[#75573b] px-4 py-2.5 text-sm font-bold text-[#fffaf3] transition hover:bg-[#5a422d] disabled:cursor-wait disabled:opacity-70"
                data-testid="button-refresh-csv"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                重新整理
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[#947e68]" data-testid="text-list-summary">
            <span className="flex items-center gap-2"><Tag size={14} /> {counts.total} 件物品</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-600" /> {counts.available} 件可預約</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> {counts.reserved} 件候補中</span>
          </div>
        </header>

        <section className="mt-10 sm:mt-14" aria-live="polite">
          {loading && (
            <>
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#8d765e]" data-testid="loading-state">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#b08e67]" />
                正在讀取最新清單…
              </div>
              <SkeletonGrid />
            </>
          )}
          {!loading && error && (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[1.5rem] border border-[#e8cfc8] bg-[#fdf2ee] px-6 text-center" data-testid="error-state">
              <CircleAlert className="text-[#b65342]" size={30} strokeWidth={1.5} />
              <h2 className="mt-4 font-serif text-3xl text-[#6f3f32]">清單暫時拿不到</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#8d5f52]">Google Sheets 可能正在更新，請再試一次。你的瀏覽器也需要允許讀取公開試算表。</p>
              <button type="button" onClick={() => void loadItems()} className="mt-5 rounded-full bg-[#75573b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5a422d]" data-testid="button-retry-csv">
                再試一次
              </button>
            </div>
          )}
          {!loading && !error && visibleItems.length === 0 && <EmptyState hiddenSold={hideSold && items.length > 0} />}
          {!loading && !error && visibleItems.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
              {visibleItems.map((item, index) => (
                <div key={item.id} className="page-enter" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
                  <ProductCard item={item} onOpen={setSelectedItem} onContact={openContact} />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onContact={openContact} />}
      {contactItem && <ContactModal item={contactItem} onClose={() => setContactItem(null)} />}
    </main>
  );
}

export default App;