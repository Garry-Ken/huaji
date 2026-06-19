// 轻量内联 SVG 图标集（零依赖，描边跟随 currentColor）
import type { ReactNode } from 'react'

interface P {
  size?: number
  className?: string
  strokeWidth?: number
}

function S({ size = 20, className, strokeWidth = 1.8, children }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const MicIcon = (p: P) => (
  <S {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v4M8 21h8" />
  </S>
)
export const PlusIcon = (p: P) => (<S {...p}><path d="M12 5v14M5 12h14" /></S>)
export const SparkIcon = (p: P) => (
  <S {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
  </S>
)
export const EditIcon = (p: P) => (<S {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></S>)
export const TrashIcon = (p: P) => (<S {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></S>)
export const ChevronLeft = (p: P) => (<S {...p}><path d="M15 18l-6-6 6-6" /></S>)
export const ChevronRight = (p: P) => (<S {...p}><path d="M9 18l6-6-6-6" /></S>)
export const SunIcon = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>
)
export const MoonIcon = (p: P) => (<S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></S>)
export const ClipboardIcon = (p: P) => (
  <S {...p}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" /></S>
)
export const XIcon = (p: P) => (<S {...p}><path d="M18 6 6 18M6 6l12 12" /></S>)
export const HealthIcon = (p: P) => (
  <S {...p}><path d="M3 12h3l2-5 4 12 3-9 2 2h4" /></S>
)
export const PieIcon = (p: P) => (<S {...p}><path d="M12 3v9h9a9 9 0 1 1-9-9Z" /><path d="M16 3.5A9 9 0 0 1 20.5 8H16Z" /></S>)
export const ListIcon = (p: P) => (<S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>)
export const MapPinIcon = (p: P) => (<S {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></S>)
export const ClockIcon = (p: P) => (<S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>)
export const CheckIcon = (p: P) => (<S {...p}><path d="M20 6 9 17l-5-5" /></S>)
export const PencilLine = EditIcon
export const WalletIcon = (p: P) => (
  <S {...p}><path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v3" /><circle cx="17" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></S>
)
export const LockIcon = (p: P) => (
  <S {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></S>
)
export const CrownIcon = (p: P) => (
  <S {...p}><path d="M4 8l3.2 3.2L12 5l4.8 6.2L20 8l-1.4 10H5.4L4 8Z" /></S>
)
export const DownloadIcon = (p: P) => (<S {...p}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></S>)
export const CloudIcon = (p: P) => (<S {...p}><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17.5 18H7Z" /></S>)
export const UserIcon = (p: P) => (<S {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></S>)
export const GiftIcon = (p: P) => (<S {...p}><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9ZM3 7h18v4H3zM12 7v14M12 7S10.5 3 8.5 4 9 7 12 7Zm0 0s1.5-4 3.5-3-.5 3-3.5 3Z" /></S>)
