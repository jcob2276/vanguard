import { Link } from 'react-router-dom';
import { FlaskConical, GraduationCap } from 'lucide-react';

const btnClass =
  'relative rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer';

export default function DashboardModuleShortcuts({
  naukaBadge,
}: {
  naukaBadge?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link to="/rozwoj" className={btnClass} title="Nauka">
        <GraduationCap size={15} />
        {naukaBadge != null && naukaBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-black text-white shadow-sm">
            {naukaBadge > 9 ? '9+' : naukaBadge}
          </span>
        )}
      </Link>
      <Link to="/badania" className={btnClass} title="Badania">
        <FlaskConical size={15} />
      </Link>
    </div>
  );
}
