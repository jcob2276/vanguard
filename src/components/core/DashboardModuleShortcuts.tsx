import { Link } from 'react-router-dom';
import { FlaskConical, GraduationCap } from 'lucide-react';
import Badge from '../ui/Badge';

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
          <span className="absolute -top-0.5 -right-0.5 shadow-sm">
            <Badge count={naukaBadge} color="var(--color-danger)" />
          </span>
        )}
      </Link>
      <Link to="/badania" className={btnClass} title="Badania">
        <FlaskConical size={15} />
      </Link>
    </div>
  );
}
