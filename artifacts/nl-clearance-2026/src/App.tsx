import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Papa from 'papaparse';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  ImageOff,
  MapPin,
  MessageCircle,
  PackageOpen,
  RefreshCw,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTchJgQTW17h4h2lth4uxyYdkrrWzUH2P26j4bTmjdfxoP3quq6EADxevlTniWIKJXTfMlzgCP46Bf0/pub?gid=1231845176&single=true&output=csv';
const LINE_URL = 'https://line.me/R/ti/p/~crab880720';
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=100003494572990';

type ThemeMode = 'classic' | 'deluxe';

interface ThemeContextType {
  theme: ThemeMode;
  isDeluxe: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'classic',
  isDeluxe: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

const useTheme = () => useContext(ThemeContext);


type ItemStatus = 'available' | 'reserved' | 'sold';
type Item = {
  id: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  price: string;
  status: ItemStatus;
  rawStatus: string;
};

type ContactItem = Pick<Item, 'name' | 'price' | 'status'>;

const keyAliases = {
  name: ['物品名稱', '品名', '物品名', 'name', 'itemname', 'title'],
  category: ['分類', '類別', '商品分類', 'category', 'type', 'cat'],
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

  const numericValue = parseFloat(clean.replace(/[^\d.-]/g, ''));
  if (numericValue === 0 || /^0+(\.0+)?$/.test(clean) || /^(free|免費|0\s*€|€\s*0)$/i.test(clean)) {
    return 'Free';
  }

  return /€|eur/i.test(clean) ? clean : `€${clean}`;
}

function parseItems(rows: Record<string, string>[]) {
  const items = rows
    .map((row, index): Item | null => {
      const name = valueFor(row, keyAliases.name);
      if (!name) return null;
      const rawStatus = valueFor(row, keyAliases.status);
      const category = valueFor(row, keyAliases.category) || '其他';
      return {
        id: `${normalizeKey(name)}-${index}`,
        name,
        category,
        description: valueFor(row, keyAliases.description) || '無特別敘述',
        images: parseImages(valueFor(row, keyAliases.images)),
        price: formatPrice(valueFor(row, keyAliases.price)),
        status: parseStatus(rawStatus),
        rawStatus,
      };
    })
    .filter((item): item is Item => Boolean(item));

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
  const { isDeluxe } = useTheme();
  const label = status === 'available' ? '未售出' : status === 'reserved' ? '已預訂' : '已售出';
  if (isDeluxe) {
    const color =
      status === 'available'
        ? 'border border-emerald-500/60 bg-emerald-950/80 text-emerald-300'
        : status === 'reserved'
          ? 'border border-amber-500/60 bg-amber-950/80 text-amber-300'
          : 'border border-zinc-700 bg-zinc-900/90 text-zinc-400';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[.08em] uppercase backdrop-blur-md ${color}`}>
        {label}
      </span>
    );
  }
  const color =
    status === 'available'
      ? 'bg-emerald-600 text-white'
      : status === 'reserved'
        ? 'bg-amber-500 text-[#422d1c]'
        : 'bg-rose-600 text-white';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[.04em] ${color}`}>
      {label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const { isDeluxe } = useTheme();
  if (!category || category === '其他') return null;
  if (isDeluxe) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#d4af37]/40 bg-[#191920]/90 px-2.5 py-0.5 text-[10px] font-medium tracking-[.08em] text-[#e6cb85] backdrop-blur-md">
        {category}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9c8b5] bg-[#fffdf9]/90 px-2.5 py-0.5 text-[11px] font-bold tracking-[.04em] text-[#75573b] backdrop-blur-sm">
      {category}
    </span>
  );
}

function SkeletonGrid() {
  const { isDeluxe } = useTheme();
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="loading-grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className={`overflow-hidden rounded-[1.2rem] border ${
            isDeluxe ? 'border-[#262630] bg-[#131317]' : 'border-[#eadfce] bg-[#fffdf9]'
          }`}
          key={index}
        >
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
  const { isDeluxe } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center ${
          isDeluxe ? 'bg-[#101014] text-[#d4af37]/60' : 'bg-[#eee5d8] text-[#b08e67]'
        } ${className}`}
        data-testid="image-fallback"
      >
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
  const { isDeluxe } = useTheme();
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
      className={`group flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.2rem] transition duration-300 hover:-translate-y-1 ${
        isDeluxe
          ? 'border border-[#d4af37]/25 bg-[#131318] shadow-[0_16px_40px_rgba(0,0,0,0.65)] hover:border-[#d4af37]/70 hover:shadow-[0_22px_50px_rgba(212,175,55,0.22)]'
          : 'border border-[#e8dccb] bg-[#fffdf9] shadow-[0_12px_35px_rgba(90,66,45,.07)] hover:shadow-[0_18px_45px_rgba(90,66,45,.13)]'
      } ${sold ? 'grayscale opacity-60' : ''}`}
      onClick={() => onOpen(item)}
      data-testid={`card-product-${item.id}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(item);
      }}
      role="button"
      aria-label={`查看 ${item.name} 詳情`}
    >
      <div className={`relative aspect-[4/3] shrink-0 overflow-hidden ${isDeluxe ? 'bg-[#0d0d10]' : 'bg-[#eee5d8]'}`}>
        <ImageFrame
          src={item.images[imageIndex]}
          alt={item.name}
          className="h-full w-full transition duration-500 group-hover:scale-[1.03]"
        />

        <div className="absolute left-3 top-3 z-10">
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
        <div className="flex flex-col gap-1.5">
          <h2 className={`font-serif text-[1.35rem] leading-tight ${isDeluxe ? 'text-[#f7f2ea]' : 'text-[#5a422d]'}`}>{item.name}</h2>
          <span className={`font-serif text-lg font-semibold ${isDeluxe ? 'text-[#e6cb85]' : 'text-[#75573b]'}`} data-testid={`text-price-${item.id}`}>
            {item.price}
          </span>
        </div>

        <p className={`mt-3 line-clamp-3 text-sm leading-6 ${isDeluxe ? 'text-[#a49b8e]' : 'text-[#816f5d]'}`} data-testid={`text-description-${item.id}`}>
          {item.description}
        </p>

        <div className={`mt-auto border-t pt-4 ${isDeluxe ? 'border-[#262630]' : 'border-[#eee4d6]'}`}>
          <button
            type="button"
            disabled={sold}
            className={`w-full rounded-full px-4 py-2.5 text-xs font-bold tracking-[.02em] transition ${
              sold
                ? isDeluxe
                  ? 'cursor-not-allowed bg-[#222228] text-[#6b6760] border border-[#303038]'
                  : 'cursor-not-allowed bg-[#e2ddd5] text-[#9a9187]'
                : isDeluxe
                  ? item.status === 'reserved'
                    ? 'border border-[#d4af37]/60 bg-[#1e1a12] text-[#f0dfb8] hover:bg-[#2c261b]'
                    : 'gold-shimmer-btn text-black font-bold tracking-wider uppercase'
                  : 'bg-[#75573b] text-[#fffaf3] hover:bg-[#5a422d] hover:shadow-md'
            }`}
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
  fullScreenMobile = true,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  fullScreenMobile?: boolean;
}) {
  const { isDeluxe } = useTheme();
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
      className={`fixed inset-0 z-40 flex justify-center backdrop-blur-[4px] sm:items-center sm:p-6 ${
        isDeluxe ? 'bg-black/85' : 'bg-[#2d2118]/65'
      } ${fullScreenMobile ? 'items-end p-0' : 'items-center p-4'}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      data-testid="modal-backdrop"
    >
      <section
        className={`modal-enter relative w-full overflow-y-auto shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-[1.5rem] ${
          isDeluxe ? 'border border-[#d4af37]/35 bg-[#121217] text-[#eee7dc]' : 'bg-[#fffdf9]'
        } ${
          fullScreenMobile
            ? 'h-[100dvh] max-h-[100dvh] rounded-none'
            : 'max-h-[90dvh] rounded-[1.5rem]'
        } ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md transition ${
            isDeluxe
              ? 'border border-[#d4af37]/30 bg-[#1f1f26]/90 text-[#e6cb85] hover:bg-[#d4af37] hover:text-black'
              : 'bg-[#f4ede2]/90 text-[#75573b] hover:bg-[#e8dccb]'
          }`}
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
  const { isDeluxe } = useTheme();
  const [imageIndex, setImageIndex] = useState(0);
  const sold = item.status === 'sold';

  return (
    <ModalShell label={`${item.name} 詳情`} onClose={onClose} className="sm:max-w-4xl">
      <div className="grid sm:grid-cols-[1.05fr_.95fr]">
        <div className={`relative min-h-[300px] sm:min-h-[500px] ${isDeluxe ? 'bg-[#0b0b0e]' : 'bg-[#eee5d8]'}`}>
          <ImageFrame src={item.images[imageIndex]} alt={item.name} loading="eager" className="h-full min-h-[300px] w-full sm:min-h-[500px]" />
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
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <CategoryBadge category={item.category} />
            </div>
            {item.images.length > 0 && (
              <span className={`text-[11px] font-semibold tracking-[.14em] ${isDeluxe ? 'text-[#d4af37]' : 'text-[#a08d78]'}`}>
                DETAIL / {imageIndex + 1}
              </span>
            )}
          </div>
          <h2
            className={`mt-6 font-serif text-3xl leading-[1.1] sm:text-5xl ${isDeluxe ? 'gold-gradient-text' : 'text-[#5a422d]'}`}
            data-testid={`modal-title-${item.id}`}
          >
            {item.name}
          </h2>
          <p
            className={`mt-4 font-serif text-2xl sm:text-3xl ${isDeluxe ? 'text-[#e6cb85]' : 'text-[#75573b]'}`}
            data-testid={`modal-price-${item.id}`}
          >
            {item.price}
          </p>

          <div className={`my-5 h-px ${isDeluxe ? 'bg-[#282833]' : 'bg-[#eadfce]'}`} />
          <p
            className={`whitespace-pre-line text-[15px] leading-7 ${isDeluxe ? 'text-[#bab1a4]' : 'text-[#735f4d]'}`}
            data-testid={`modal-description-${item.id}`}
          >
            {item.description}
          </p>

          <div className="mt-auto pt-8">
            <button
              type="button"
              disabled={sold}
              onClick={() => onContact(item)}
              className={`w-full rounded-full px-5 py-3.5 text-sm font-bold transition ${
                sold
                  ? isDeluxe
                    ? 'cursor-not-allowed bg-[#222228] text-[#6b6760] border border-[#303038]'
                    : 'cursor-not-allowed bg-[#e2ddd5] text-[#9a9187]'
                  : isDeluxe
                    ? item.status === 'reserved'
                      ? 'border border-[#d4af37]/60 bg-[#1e1a12] text-[#f0dfb8] hover:bg-[#2c261b]'
                      : 'gold-shimmer-btn text-black font-bold tracking-wider uppercase'
                    : 'bg-[#75573b] text-[#fffaf3] hover:bg-[#5a422d]'
              }`}
              data-testid={`button-modal-contact-${item.id}`}
            >
              {sold ? '已售出，謝謝您的關注' : item.status === 'reserved' ? '🙋 我想排（候補預約）' : '🤝 我想購買 / 預約面交'}
            </button>
            {!sold && (
              <p className={`mt-3 text-center text-xs ${isDeluxe ? 'text-[#9c9386]' : 'text-[#a08d78]'}`}>
                點擊後會複製一段方便傳訊的內容
              </p>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ContactModal({ item, onClose }: { item: ContactItem; onClose: () => void }) {
  const { isDeluxe } = useTheme();
  const [copied, setCopied] = useState(false);

  const defaultMessage =
    item.status === 'reserved'
      ? `您好，我想候補 ${item.name}（價格：${item.price}）\n面交地點選擇：\n方便日期時間：`
      : `您好，我想購買 ${item.name}（價格：${item.price}）\n面交地點選擇：\n方便日期時間：`;

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
    <ModalShell label="聯絡賣家" onClose={onClose} fullScreenMobile={false} className="sm:max-w-lg">
      <div className="p-7 sm:p-9">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
          isDeluxe ? 'border border-emerald-500/40 bg-[#162419] text-emerald-400' : 'bg-[#e8eee5] text-[#3d7651]'
        }`}>
          <MessageCircle size={23} />
        </div>
        <p className={`mt-6 text-xs font-bold tracking-[.16em] ${isDeluxe ? 'text-[#d4af37]' : 'text-[#a08d78]'}`}>
          CONTACT / 聯絡
        </p>

        <p className={`mt-4 text-[15px] leading-7 ${isDeluxe ? 'text-[#ccc3b6]' : 'text-[#735f4d]'}`}>
          請選擇透過 LINE 或 Facebook 私訊我，並告知您方便的日期時間與地點。
        </p>

        {/* 面交地點與時間方塊 */}
        <div className={`mt-4 rounded-xl border p-3.5 text-xs space-y-1.5 ${
          isDeluxe
            ? 'border-[#d4af37]/30 bg-[#181820] text-[#d6cdbf]'
            : 'border-[#e8dccb] bg-[#f5ede3] text-[#75573b]'
        }`}>
          <div className="flex items-start gap-2">
            <MapPin size={15} className={`mt-0.5 shrink-0 ${isDeluxe ? 'text-[#d4af37]' : 'text-[#b08e67]'}`} />
            <span>面交地點：Eindhoven Centraal Station 或是 5641 AT</span>
          </div>
          <div className="flex items-start gap-2">
            <Calendar size={15} className={`mt-0.5 shrink-0 ${isDeluxe ? 'text-[#d4af37]' : 'text-[#b08e67]'}`} />
            <span>
              面交時間：9/21 起（<span className="font-semibold text-rose-500">9/27, 10/2-4 無法</span>）
            </span>
          </div>
        </div>

        <div className={`mt-6 rounded-xl border p-4 ${
          isDeluxe
            ? 'border-[#2d2d38] bg-[#16161c]'
            : 'border-[#e8dccb] bg-[#faf5ec]'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold ${
            isDeluxe ? 'text-[#e6cb85]' : 'text-[#75573b]'
          }`}>
            {copied ? <Check size={15} /> : <ClipboardCheck size={15} />}
            {copied ? '已複製預設訊息' : '正在準備訊息'}
          </div>
          <p className={`mt-3 whitespace-pre-line text-sm leading-6 ${
            isDeluxe ? 'text-[#b5aca1]' : 'text-[#816f5d]'
          }`} data-testid="text-contact-template">
            {defaultMessage}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 py-3 text-sm font-bold text-white transition hover:brightness-105"
            data-testid="link-open-line"
          >
            LINE 聯絡 <ExternalLink size={14} />
          </a>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-[#1877F2] px-4 py-3 text-sm font-bold text-white transition hover:brightness-105"
            data-testid="link-open-facebook"
          >
            Facebook 聯絡 <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </ModalShell>
  );
}

function EmptyState({ hiddenSold }: { hiddenSold: boolean }) {
  const { isDeluxe } = useTheme();
  return (
    <div
      className={`flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-6 text-center ${
        isDeluxe
          ? 'border-[#333340] bg-[#141419]'
          : 'border-[#d8c7b4] bg-[#fbf7f0]'
      }`}
      data-testid="empty-state"
    >
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
        isDeluxe ? 'bg-[#22222c] text-[#d4af37]' : 'bg-[#eee5d8] text-[#9b7959]'
      }`}>
        <PackageOpen size={29} strokeWidth={1.5} />
      </div>
      <h2 className={`mt-5 font-serif text-3xl ${isDeluxe ? 'gold-gradient-text' : 'text-[#5a422d]'}`}>
        {hiddenSold ? '目前沒有可看的物品' : '清單還在整理中'}
      </h2>
      <p className={`mt-2 max-w-md text-sm leading-6 ${isDeluxe ? 'text-[#9c9386]' : 'text-[#816f5d]'}`}>
        {hiddenSold ? '所有物品目前都已售出。可以取消勾選「隱藏已售出」，看看完整的出清紀錄。' : 'Google Sheets 目前沒有可顯示的品項，請稍後再來看看。'}
      </p>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('nl_clearance_theme');
      return saved === 'deluxe' ? 'deluxe' : 'classic';
    } catch {
      return 'classic';
    }
  });

  const isDeluxe = theme === 'deluxe';

  const handleSetTheme = useCallback((mode: ThemeMode) => {
    setTheme(mode);
    try {
      localStorage.setItem('nl_clearance_theme', mode);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    handleSetTheme(theme === 'classic' ? 'deluxe' : 'classic');
  }, [theme, handleSetTheme]);

  const themeContextValue = useMemo(
    () => ({
      theme,
      isDeluxe,
      setTheme: handleSetTheme,
      toggleTheme,
    }),
    [theme, isDeluxe, handleSetTheme, toggleTheme],
  );

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideSold, setHideSold] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return ['全部', ...Array.from(set)];
  }, [items]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSold = hideSold ? item.status !== 'sold' : true;
      const matchesCategory = selectedCategory === '全部' ? true : item.category === selectedCategory;
      return matchesSold && matchesCategory;
    });
  }, [hideSold, selectedCategory, items]);

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
    <ThemeContext.Provider value={themeContextValue}>
      <main className={`grain min-h-[100dvh] transition-colors duration-500 ${isDeluxe ? 'theme-deluxe' : ''}`}>
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
          <header className="page-enter">
            {/* Top Bar with Style Switcher */}
            <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
              isDeluxe ? 'border-[#2b2b36]' : 'border-[#ebdcd0]'
            }`}>
              <div className="flex items-center gap-2">
                {isDeluxe ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#d4af37]">
                    <Sparkles size={14} /> ÉDITION PRIVÉE • THE CLEARANCE SALON
                  </span>
                ) : (
                  <span className="text-xs font-semibold tracking-[0.08em] text-[#8c745f]">
                    荷蘭生活出清選物 • 2026
                  </span>
                )}
              </div>

              {/* Theme Switcher Toggle */}
              <div
                className={`flex items-center rounded-full p-1 border shadow-sm transition-colors ${
                  isDeluxe ? 'border-[#d4af37]/40 bg-[#16161c]' : 'border-[#d9c8b5] bg-[#fffdf9]'
                }`}
                role="radiogroup"
                aria-label="外觀風格切換"
              >
                <button
                  type="button"
                  onClick={() => handleSetTheme('classic')}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    !isDeluxe
                      ? 'bg-[#75573b] text-white shadow-sm'
                      : 'text-[#8e8577] hover:text-[#e6cb85]'
                  }`}
                  aria-checked={!isDeluxe}
                  role="radio"
                  data-testid="theme-toggle-classic"
                >
                  <span>🏺 溫潤陶藝</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTheme('deluxe')}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isDeluxe
                      ? 'gold-shimmer-btn text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                      : 'text-[#816f5d] hover:text-[#5a422d]'
                  }`}
                  aria-checked={isDeluxe}
                  role="radio"
                  data-testid="theme-toggle-deluxe"
                >
                  <Sparkles size={13} className={isDeluxe ? 'text-black' : 'text-amber-600'} />
                  <span>✨ 奢華典藏</span>
                </button>
              </div>
            </div>

            <div className={`flex flex-col gap-6 border-b pb-7 lg:flex-row lg:items-end lg:justify-between ${
              isDeluxe ? 'border-[#2b2b36]' : 'border-[#e3d5c4]'
            }`}>
              <div>
                <h1
                  className={`font-serif text-3xl sm:text-[48pt] leading-[1.1] tracking-[-0.03em] ${
                    isDeluxe ? 'gold-gradient-text' : 'text-[#5a422d]'
                  }`}
                  data-testid="text-page-title"
                >
                  2026 荷蘭出清
                </h1>

                {/* 地點與時間 */}
                <div className={`mt-3.5 space-y-1.5 ${
                  isDeluxe ? 'rounded-xl border border-[#d4af37]/25 bg-[#16161e]/80 p-3.5 shadow-md' : ''
                }`}>
                  <div className={`flex items-start gap-2 text-sm font-medium ${
                    isDeluxe ? 'text-[#ded6c9]' : 'text-[#75573b]'
                  }`}>
                    <MapPin size={16} className={`mt-0.5 shrink-0 ${isDeluxe ? 'text-[#d4af37]' : 'text-[#b08e67]'}`} />
                    <span className="leading-snug">面交地點：Eindhoven Centraal Station 或是 5641 AT</span>
                  </div>
                  <div className={`flex items-start gap-2 text-sm font-medium ${
                    isDeluxe ? 'text-[#ded6c9]' : 'text-[#75573b]'
                  }`}>
                    <Calendar size={16} className={`mt-0.5 shrink-0 ${isDeluxe ? 'text-[#d4af37]' : 'text-[#b08e67]'}`} />
                    <span className="leading-snug">
                      面交時間：9/21 起（<span className="font-semibold text-rose-500">9/27, 10/2-4 無法</span>）
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-full border px-4 py-2.5 text-sm transition ${
                    isDeluxe
                      ? 'border-[#383844] bg-[#16161c] text-[#d4cbbe]'
                      : 'border-[#d9c8b5] bg-[#fffdf9]/70 text-[#735f4d]'
                  }`}
                  data-testid="label-hide-sold"
                >
                  <input
                    type="checkbox"
                    checked={hideSold}
                    onChange={(event) => setHideSold(event.target.checked)}
                    className={`h-4 w-4 ${isDeluxe ? 'accent-[#d4af37]' : 'accent-[#75573b]'}`}
                    data-testid="checkbox-hide-sold"
                  />
                  隱藏已售出
                </label>
                <button
                  type="button"
                  onClick={() => void loadItems()}
                  disabled={loading}
                  className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                    isDeluxe
                      ? 'gold-shimmer-btn text-black font-semibold'
                      : 'bg-[#75573b] text-[#fffaf3] hover:bg-[#5a422d]'
                  }`}
                  data-testid="button-refresh-csv"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  重新整理
                </button>
              </div>
            </div>

            {categories.length > 1 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      selectedCategory === cat
                        ? isDeluxe
                          ? 'border border-[#d4af37] bg-gradient-to-r from-[#d4af37] to-[#b38728] text-black shadow-[0_0_15px_rgba(212,175,55,0.35)]'
                          : 'bg-[#75573b] text-[#fffaf3]'
                        : isDeluxe
                          ? 'border border-[#2d2d38] bg-[#141418] text-[#a49b8e] hover:border-[#d4af37]/60 hover:text-white'
                          : 'border border-[#eadfce] bg-[#fffdf9] text-[#735f4d] hover:border-[#d9c8b5]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className={`mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs ${
              isDeluxe ? 'text-[#a1978a]' : 'text-[#947e68]'
            }`} data-testid="text-list-summary">
              <span className="flex items-center gap-2">
                <Tag size={14} className={isDeluxe ? 'text-[#d4af37]' : ''} /> {counts.total} 件物品
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {counts.available} 件可預約
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> {counts.reserved} 件候補中
              </span>
            </div>
          </header>

          <section className="mt-10 sm:mt-14" aria-live="polite">
            {loading && (
              <>
                <div className={`mb-5 flex items-center gap-2 text-sm font-semibold ${
                  isDeluxe ? 'text-[#d4af37]' : 'text-[#8d765e]'
                }`} data-testid="loading-state">
                  <span className={`h-2 w-2 animate-pulse rounded-full ${
                    isDeluxe ? 'bg-[#d4af37]' : 'bg-[#b08e67]'
                  }`} />
                  正在讀取最新清單…
                </div>
                <SkeletonGrid />
              </>
            )}
            {!loading && error && (
              <div className={`flex min-h-[300px] flex-col items-center justify-center rounded-[1.5rem] border px-6 text-center ${
                isDeluxe
                  ? 'border-[#4a2624] bg-[#1a1212]'
                  : 'border-[#e8cfc8] bg-[#fdf2ee]'
              }`} data-testid="error-state">
                <CircleAlert className={isDeluxe ? 'text-rose-400' : 'text-[#b65342]'} size={30} strokeWidth={1.5} />
                <h2 className={`mt-4 font-serif text-3xl ${isDeluxe ? 'text-rose-300' : 'text-[#6f3f32]'}`}>
                  清單暫時拿不到
                </h2>
                <p className={`mt-2 max-w-md text-sm leading-6 ${isDeluxe ? 'text-[#d4a8a4]' : 'text-[#8d5f52]'}`}>
                  Google Sheets 可能正在更新，請再試一次。你的瀏覽器也需要允許讀取公開試算表。
                </p>
                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className={`mt-5 rounded-full px-5 py-2.5 text-sm font-bold text-white transition ${
                    isDeluxe ? 'gold-shimmer-btn text-black font-semibold' : 'bg-[#75573b] hover:bg-[#5a422d]'
                  }`}
                  data-testid="button-retry-csv"
                >
                  再試一次
                </button>
              </div>
            )}
            {!loading && !error && visibleItems.length === 0 && <EmptyState hiddenSold={hideSold && items.length > 0} />}
            {!loading && !error && visibleItems.length > 0 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
                {visibleItems.map((item, index) => (
                  <div key={item.id} className="page-enter h-full" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
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
    </ThemeContext.Provider>
  );
}

export default App;