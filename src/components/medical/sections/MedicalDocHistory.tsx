import { FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '../../ui/Card';

interface MedicalDocHistoryProps {
  documents: any[];
}

export default function MedicalDocHistory({ documents }: MedicalDocHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display">4. Historia Dokumentów</h2>
        <p className="text-2xs text-text-muted mt-0.5">Oryginalne dokumenty i surowe raporty laboratoryjne jako źródło prawdy</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map(doc => {
          // Status indicators
          const isProcessed = doc.document_type === 'processed' || doc.clinical_validity === 'clinical';
          
          return (
            <Card
              key={doc.id}
              variant="outline"
              padding="1rem"
              className="bg-background/25 border-border-custom hover:bg-background/40 transition-all flex flex-col justify-between h-40"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                    <FileText size={14} className="text-text-muted shrink-0" />
                    <span className="truncate max-w-[180px]" title={doc.source_name}>
                      {doc.source_name}
                    </span>
                  </div>
                  <span className={`text-3xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    isProcessed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    {isProcessed ? 'Zaimportowany' : 'Weryfikacja'}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-3xs font-semibold text-text-secondary">
                  <p>
                    <span className="text-text-muted uppercase font-black">Data badania:</span> {doc.document_date}
                  </p>
                  <p>
                    <span className="text-text-muted uppercase font-black">Laboratorium:</span> {doc.provider || 'Nieznane'}
                  </p>
                  {doc.summary && (
                    <p className="text-text-muted italic truncate mt-1">
                      "{doc.summary}"
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border-custom/40 pt-2.5 flex items-center justify-between text-3xs">
                <span className="text-text-muted font-bold">
                  Dodano: {doc.created_at?.slice(0, 10)}
                </span>
                
                <a
                  href={doc.source_path || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-black uppercase text-primary hover:underline cursor-pointer"
                >
                  <Download size={10} /> Pobierz źródło
                </a>
              </div>
            </Card>
          );
        })}

        {documents.length === 0 && (
          <div className="col-span-2 rounded-xl border border-dashed border-border-custom py-12 text-center">
            <p className="text-xs text-text-muted italic">Brak zapisanych oryginalnych dokumentów PDF.</p>
          </div>
        )}
      </div>
    </div>
  );
}
