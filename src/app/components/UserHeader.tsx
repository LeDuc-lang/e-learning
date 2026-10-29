import Link from 'next/link';
import { logoutAction } from '@/app/auth/actions';

interface UserHeaderProps {
  currentPage: 'generator' | 'dashboard';
  isAdmin: boolean;
}

const linkStyle =
  'px-3 py-2 rounded-lg text-slate-600 hover:text-[#1B4332] hover:bg-white/70 transition-colors';
const activeStyle = 'px-3 py-2 rounded-lg bg-[#1B4332] text-[#FAF9F6]';

export default function UserHeader({ currentPage, isAdmin }: UserHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF9F6]/85 backdrop-blur-md border-b border-gray-200/80">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[#1B4332] flex items-center justify-center text-[#FAF9F6] font-semibold text-sm">
            S
          </span>
          <span className="font-semibold text-[#1B4332] tracking-tight text-base">
            Sylva<span className="text-[#74A18E] font-normal">Learn</span>
          </span>
        </Link>

        <nav
          className="flex items-center gap-1 text-sm font-medium"
          aria-label="Navigation principale"
        >
          <Link
            href="/"
            aria-current={currentPage === 'generator' ? 'page' : undefined}
            className={currentPage === 'generator' ? activeStyle : linkStyle}
          >
            Générateur
          </Link>
          <Link
            href="/app/dashboard"
            aria-current={currentPage === 'dashboard' ? 'page' : undefined}
            className={currentPage === 'dashboard' ? activeStyle : linkStyle}
          >
            Tableau de bord
          </Link>
          {isAdmin && (
            <Link href="/admin" className={linkStyle}>
              Administration
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className={linkStyle}>
              Déconnexion
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
