import React, { useState } from 'react';
import { Sparkles, RotateCcw, Send } from 'lucide-react';
import { generateResponseDraft } from '../../lib/responseTemplates';
import { Button, Select, Textarea } from '../ui/ui';

const TONES = ['Professional', 'Friendly', 'Concise', 'Apologetic', 'Informational'];

export default function ResponseAssistant({ caseItem, customerName, onInsert }) {
  const [tone, setTone] = useState('Professional');
  const [draft, setDraft] = useState('');

  function generate() {
    setDraft(generateResponseDraft({
      customerName, category: caseItem.category, tone, missingInfo: caseItem.missingInfo || [], caseId: caseItem.id,
    }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={tone} onChange={(e) => setTone(e.target.value)} className="w-auto">
          {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Button size="sm" variant="outline" onClick={generate}>
          <Sparkles size={14} /> {draft ? 'Regenerate' : 'Generate'}
        </Button>
        {draft && <Button size="sm" variant="ghost" onClick={() => setDraft('')}><RotateCcw size={14} /> Discard</Button>}
      </div>
      {draft && (
        <>
          <Textarea rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <p className="text-xs text-ink-faint">Generated locally from a response template — review before sending. This never sends automatically.</p>
          <Button size="sm" onClick={() => { onInsert(draft); setDraft(''); }}><Send size={14} /> Mark as sent to customer</Button>
        </>
      )}
    </div>
  );
}
