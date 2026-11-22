// Thin-stroke icon set (decorative: aria-hidden). Keep stroke weight consistent across the site.
type P = React.SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true } as const;
export const MenuIcon = (p: P) => <svg {...base} {...p}><path d="M3 8h18M3 16h18" /></svg>;
export const SearchIcon = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>;
export const BagIcon = (p: P) => <svg {...base} {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>;
export const UserIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => <svg {...base} {...p} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></svg>;
export const ChatIcon = (p: P) => <svg {...base} {...p}><path d="M4 20l1.4-4A8 8 0 1112 20a8 8 0 01-4-1.1L4 20z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 01-1.8-1.8l.8-1-1-2L9 9.5z" /></svg>;
export const StarIcon = ({ filled = true, ...p }: P & { filled?: boolean }) => <svg {...base} {...p} fill={filled ? "currentColor" : "none"} strokeWidth={1}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></svg>;
export const ArrowIcon = (p: P) => <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const TruckIcon = (p: P) => <svg {...base} {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></svg>;
export const ShieldIcon = (p: P) => <svg {...base} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>;
export const GlobeIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg>;
export const LeafIcon = (p: P) => <svg {...base} {...p}><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19l7-7" /></svg>;
export const MinusIcon = (p: P) => <svg {...base} {...p}><path d="M6 12h12" /></svg>;
export const PlusIcon = (p: P) => <svg {...base} {...p}><path d="M12 6v12M6 12h12" /></svg>;
export const CloseIcon = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
